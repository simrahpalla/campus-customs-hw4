"""Saved chat history for logged-in customers (the `chat_history` table)."""

import json

from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart

import tools
from db import get_db
from models import HistoryMessage

# How many saved messages to show in the widget, and how many to give the agent as context.
DISPLAY_LIMIT = 50
AGENT_CONTEXT_LIMIT = 20


def init_table() -> None:
    """Create the table on startup if it doesn't exist yet. Safe to run every time."""
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS chat_history (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content       TEXT NOT NULL,
                product_ids   TEXT,   -- JSON list of product_ids shown with an assistant reply
                results_title TEXT,   -- heading for those products, e.g. 'Hoodies'
                page_path     TEXT,   -- page the customer was on when they sent a user message
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history (user_id, id);
            """
        )


def save_exchange(
    user_id: int,
    user_message: str,
    page_path: str | None,
    reply: str,
    product_ids: list[str],
    results_title: str | None,
) -> None:
    """Store one user message and the assistant's reply together (one transaction)."""
    with get_db() as conn:
        conn.execute(
            "INSERT INTO chat_history (user_id, role, content, page_path) VALUES (?, 'user', ?, ?)",
            (user_id, user_message, page_path),
        )
        conn.execute(
            """INSERT INTO chat_history (user_id, role, content, product_ids, results_title)
               VALUES (?, 'assistant', ?, ?, ?)""",
            (user_id, reply, json.dumps(product_ids) if product_ids else None, results_title),
        )


def _recent_rows(user_id: int, limit: int) -> list:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_history WHERE user_id = ? ORDER BY id DESC LIMIT ?", (user_id, limit)
        ).fetchall()
    return list(reversed(rows))  # oldest first


def load_for_display(user_id: int) -> list[HistoryMessage]:
    """Recent messages for the widget. Product cards are rebuilt from live DB data, not a stale snapshot."""
    messages = []
    for r in _recent_rows(user_id, DISPLAY_LIMIT):
        ids = json.loads(r["product_ids"]) if r["product_ids"] else []
        messages.append(
            HistoryMessage(
                role=r["role"],
                content=r["content"],
                products=tools.results_for_ids(ids),
                results_title=r["results_title"],
                created_at=r["created_at"],
            )
        )
    return messages


def load_for_agent(user_id: int) -> list[ModelMessage]:
    """Recent messages as PydanticAI message history, so the agent remembers earlier conversations."""
    messages: list[ModelMessage] = []
    for r in _recent_rows(user_id, AGENT_CONTEXT_LIMIT):
        if r["role"] == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=r["content"])]))
        else:
            text = r["content"]
            if r["product_ids"]:
                # Remind the agent which products it showed, so "the second one" can be resolved.
                text += f"\n[Products shown: {', '.join(json.loads(r['product_ids']))}]"
            messages.append(ModelResponse(parts=[TextPart(content=text)]))
    return messages


def clear(user_id: int) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
