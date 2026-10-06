"""Campus Customs backend: catalogue, product images, accounts, and the shop chatbot.

Run from this folder with:  uvicorn main:app --reload --port 8000
"""

import json
import logging
import sqlite3

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded

import auth
import history
from audit import AuditRun
import tools
from agent import RUN_LIMITS, ShopDeps, shop_agent, to_message_history
from db import DATA_DIR, get_db
from models import ChatRequest, ChatResponse, CustomerContext, HistoryMessage, ViewedProduct

logger = logging.getLogger("campus_customs")
MAX_CHAT_RESULTS = 30
# Reply used when the model provider's content filter blocks a message (e.g. jailbreak attempts).
BLOCKED_REPLY = (
    "Sorry, I can't help with that. I'm the Campus Customs shop assistant, so I can help you find Yale merch, "
    "check prices and sizes, or suggest a gift."
)

auth.init_table()  # creates sessions if this is a fresh database
history.init_table()  # creates chat_history if this is a fresh database

app = FastAPI(title="Campus Customs API")
app.include_router(auth.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# Images live at data/products/*.jpg; image_file_path is relative to data/.
app.mount("/media", StaticFiles(directory=DATA_DIR), name="media")


def product_from_row(row: sqlite3.Row) -> dict:
    product = dict(row)
    product["colors"] = json.loads(product["colors"])
    product["search_tags"] = json.loads(product["search_tags"])
    product["image_url"] = f"/media/{product['image_file_path']}"
    product["category"] = tools.category_of(product["garment_type"])  # for the Products page filter
    return product


@app.get("/api/products")
def list_products() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
    return [product_from_row(r) for r in rows]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        stock = conn.execute(
            """SELECT size, quantity FROM inventory WHERE product_id = ?
               ORDER BY CASE size WHEN 'XS' THEN 0 WHEN 'S' THEN 1 WHEN 'M' THEN 2
                                  WHEN 'L' THEN 3 WHEN 'XL' THEN 4 WHEN 'XXL' THEN 5 END""",
            (product_id,),
        ).fetchall()
    product = product_from_row(row)
    product["inventory"] = [dict(s) for s in stock]
    return product


def viewed_product(product_id: str | None) -> ViewedProduct | None:
    """Resolve the product page the shopper is on into DB facts, ignoring ids that don't exist."""
    if not product_id:
        return None
    details = tools.get_product_details(product_id)
    if not hasattr(details, "colors"):
        return None
    return ViewedProduct(
        product_id=details.product_id,
        name=details.name,
        garment_type=details.garment_type,
        colors=details.colors,
        price=details.price,
    )


@app.post("/api/chat")
async def chat(body: ChatRequest, authorization: str | None = Header(default=None)) -> ChatResponse:
    """Send the widget's message to the shop agent, with customer and page context.

    Logged-in customers: earlier context comes from their saved chat_history and the new exchange is saved.
    Guests: earlier context comes from the widget (body.history) and nothing is saved.
    Returns the reply text plus structured product results for the page to render as cards.
    """
    user = auth.optional_user(authorization)
    customer = (
        CustomerContext(
            user_id=user["id"], first_name=user["first_name"], last_name=user["last_name"], email=user["email"]
        )
        if user
        else None
    )
    deps = ShopDeps(
        customer=customer,
        page=body.page,
        viewing=viewed_product(body.page.product_id if body.page else None),
    )
    past = history.load_for_agent(customer.user_id) if customer else to_message_history(body.history)
    audit = AuditRun(
        actor=f"user:{customer.user_id}" if customer else "guest",
        message=body.message,
        page_path=body.page.path if body.page else None,
    )
    try:
        result = await shop_agent.run(body.message, message_history=past, deps=deps, usage_limits=RUN_LIMITS)
    except ModelHTTPError as exc:
        if "content_filter" not in str(exc.body):
            logger.exception("Model request failed")
            audit.record_error(exc, stop_reason="error")
            raise HTTPException(status_code=502, detail="The assistant is unavailable right now. Please try again.")
        # The provider refused the message: answer with a polite, on-brand refusal instead of an error.
        audit.record_error(exc, stop_reason="content_filter")
        if customer:
            history.save_exchange(customer.user_id, body.message, body.page.path if body.page else None, BLOCKED_REPLY, [], None)
        return ChatResponse(reply=BLOCKED_REPLY, products=[], results_title=None)
    except UsageLimitExceeded as exc:
        audit.record_error(exc, stop_reason="usage_limit")
        raise HTTPException(status_code=502, detail="That took too many steps. Please try a simpler question.")
    except Exception as exc:
        logger.exception("Agent run failed")
        audit.record_error(exc, stop_reason="error")
        raise HTTPException(status_code=502, detail="The assistant is unavailable right now. Please try again.")
    reply = result.output
    # Only show products a tool actually returned this turn; re-read them from the DB for the cards.
    ids = [pid for pid in reply.product_ids if pid in deps.seen_ids][:MAX_CHAT_RESULTS]
    products = tools.results_for_ids(ids)
    title = (reply.results_title or "Recommended for you") if products else None
    audit.record_success(result.new_messages(), reply.message, [p.product_id for p in products])
    if customer:
        history.save_exchange(
            customer.user_id,
            body.message,
            body.page.path if body.page else None,
            reply.message,
            [p.product_id for p in products],
            title,
        )
    return ChatResponse(reply=reply.message, products=products, results_title=title)


@app.get("/api/chat/history")
def chat_history(authorization: str | None = Header(default=None)) -> list[HistoryMessage]:
    """The logged-in customer's saved chat, oldest first, for reloading the widget."""
    return history.load_for_display(auth.user_id_from_header(authorization))


@app.delete("/api/chat/history")
def clear_chat_history(authorization: str | None = Header(default=None)) -> dict:
    history.clear(auth.user_id_from_header(authorization))
    return {"ok": True}
