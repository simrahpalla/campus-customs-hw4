"""Append-only audit trail of agent-loop activity, written to output/audit_trail.json.

Each chat request becomes a small group of entries (same run_id): the user's message, every tool call
with a one-line result summary, and the final answer (or the error that ended the run). Values are
sanitized and truncated so the file never holds secrets, password hashes or full database dumps.
"""

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic_ai.messages import ModelResponse, RetryPromptPart, ToolCallPart, ToolReturnPart

from models import (
    AuditEntry,
    ProductDetails,
    ProductNotFound,
    ProductPrice,
    SearchResults,
    StockReport,
)

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
MAX_TEXT = 120  # longest string kept in any field
_lock = threading.Lock()

SENSITIVE_KEYS = re.compile(r"pass(word)?|token|secret|api[_-]?key|authorization|hash|cookie|session", re.I)
SECRET_PATTERNS = [
    re.compile(r"pbkdf2_sha256\$\S+"),  # stored password hashes
    re.compile(r"\bBearer\s+\S+", re.I),  # auth headers
    re.compile(r"\b(sk|pk)-[A-Za-z0-9_-]{12,}"),  # API-key-shaped strings
    re.compile(r"\b[A-Fa-f0-9]{32,}\b"),  # hex digests
    # Random tokens: long and mixing upper case, lower case and digits (lowercase product slugs never match).
    re.compile(r"(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*\d)\b[A-Za-z0-9_-]{24,}"),
    re.compile(r"(password|passcode|pwd)\s*(is|=|:)?\s*\S+", re.I),  # "my password is hunter2"
]
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")  # personal data: logs use actor ids instead


def _scrub(text: str) -> str:
    for secret in filter(None, [os.getenv("PORTKEY_API_KEY")]):
        text = text.replace(secret, "[REDACTED]")
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    text = EMAIL.sub("[EMAIL]", text)
    text = " ".join(text.split())  # one line
    return text if len(text) <= MAX_TEXT else text[: MAX_TEXT - 1] + "…"


def sanitize(value, key: str = ""):
    """Redact sensitive keys, scrub secret-looking strings, and shorten everything else."""
    if key and SENSITIVE_KEYS.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {k: sanitize(v, k) for k, v in list(value.items())[:10]}
    if isinstance(value, (list, tuple)):
        return [sanitize(v) for v in value[:5]] + (["…"] if len(value) > 5 else [])
    if isinstance(value, str):
        return _scrub(value)
    return value


def summarize(result) -> str:
    """One short line describing a tool result, instead of the full data."""
    if isinstance(result, SearchResults):
        ids = ", ".join(p.product_id for p in result.products[:3])
        more = f" +{result.total_matches - 3} more" if result.total_matches > 3 else ""
        hidden = f"; {len(result.unavailable_matches)} unavailable hidden" if result.unavailable_matches else ""
        return f"match={result.match_quality}; {result.total_matches} products ({ids}{more}){hidden}"
    if isinstance(result, StockReport):
        asked = (
            f"; {result.requested_size}={result.requested_size_quantity} "
            f"({'in stock' if result.requested_size_in_stock else 'sold out'})"
            if result.requested_size
            else ""
        )
        sold = f"; sold out: {','.join(result.sold_out_sizes)}" if result.sold_out_sizes else ""
        return f"{result.product_id}: in_stock={result.in_stock}, total={result.total_quantity}{asked}{sold}"
    if isinstance(result, ProductPrice):
        return f"{result.product_id}: ${result.price:.2f}"
    if isinstance(result, ProductDetails):
        return f"{result.product_id}: details ({result.garment_type}; colors: {', '.join(result.colors[:3])})"
    if isinstance(result, ProductNotFound):
        return f"not found: {result.requested}; {len(result.similar_products)} similar suggested"
    return _scrub(str(result))


def _append(entries: list[AuditEntry]) -> None:
    """Add entries to the JSON array on disk without ever discarding earlier entries."""
    with _lock:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        existing: list = []
        if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size:
            try:
                existing = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
                if not isinstance(existing, list):
                    raise ValueError("audit trail is not a JSON array")
            except ValueError:
                # Never silently wipe history: keep the unreadable file aside and start a new array.
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
                AUDIT_PATH.rename(AUDIT_PATH.with_name(f"audit_trail.corrupt-{stamp}.json"))
                existing = []
        existing.extend(e.model_dump(exclude_none=True) for e in entries)
        tmp = AUDIT_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, AUDIT_PATH)  # atomic, so a crash mid-write can't corrupt the file


class AuditRun:
    """Collects the entries for one chat request, then appends them in one write."""

    def __init__(self, actor: str, message: str, page_path: str | None):
        self.run_id = uuid.uuid4().hex[:12]
        self.actor = actor
        self.entries: list[AuditEntry] = []
        self._add(
            action="user_message",
            args=sanitize({"message": message, "page": page_path or "unknown"}),
            result=f"received ({len(message)} chars)",
        )

    def _add(self, when: datetime | None = None, **fields) -> None:
        self.entries.append(
            AuditEntry(
                timestamp=(when or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
                run_id=self.run_id,
                step=len(self.entries) + 1,
                actor=self.actor,
                **fields,
            )
        )

    def record_success(self, new_messages: list, reply_message: str, shown_ids: list[str]) -> None:
        """Log every tool call (with its result summary) and the final answer from this run."""
        returns = {
            p.tool_call_id: p
            for m in new_messages
            if not isinstance(m, ModelResponse)
            for p in m.parts
            if isinstance(p, (ToolReturnPart, RetryPromptPart))
        }
        final_stop, model = None, None
        for m in new_messages:
            if not isinstance(m, ModelResponse):
                continue
            model, final_stop = m.model_name, m.finish_reason
            for part in m.parts:
                if not isinstance(part, ToolCallPart) or part.tool_name == "final_result":
                    continue
                ret = returns.get(part.tool_call_id)
                retried = isinstance(ret, RetryPromptPart)
                self._add(
                    when=m.timestamp,
                    action="tool_retry" if retried else "tool_call",
                    tool=part.tool_name,
                    args=sanitize(part.args_as_dict()),
                    result=_scrub(str(ret.content)) if retried else summarize(ret.content) if ret else "no result",
                    stop_reason="tool_call",  # the model paused this step to have the tool run
                    model=m.model_name,
                )
        self._add(
            action="final_answer",
            tool="final_result",
            args={"reply_preview": sanitize(reply_message)},
            result=f"reply {len(reply_message)} chars; {len(shown_ids)} product cards"
            + (f" ({', '.join(shown_ids[:3])}{'…' if len(shown_ids) > 3 else ''})" if shown_ids else ""),
            stop_reason=final_stop or "stop",
            model=model,
        )
        _append(self.entries)

    def record_error(self, exc: Exception, stop_reason: str) -> None:
        self._add(action="agent_error", result=_scrub(f"{type(exc).__name__}: {exc}"), stop_reason=stop_reason)
        _append(self.entries)
