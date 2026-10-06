"""PydanticAI shop agent: model setup, system prompt, and tool registration."""

import os
from dataclasses import dataclass, field
from pathlib import Path

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

import tools
from models import (
    AgentReply,
    Category,
    ChatTurn,
    CustomerContext,
    PageContext,
    ProductDetails,
    ProductNotFound,
    ProductPrice,
    SearchResults,
    StockReport,
    ViewedProduct,
)

BACKEND_DIR = Path(__file__).resolve().parent
PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"
MODEL_NAME = "gpt-5.6-luna"

# Agent-loop limits per chat message: enough for search + price + stock + answer, with room for a retry,
# but a runaway loop is stopped (and audited as 'usage_limit') instead of burning requests.
RUN_LIMITS = UsageLimits(request_limit=8, tool_calls_limit=12)

load_dotenv(BACKEND_DIR.parent / ".env")  # hw4/.env if present
load_dotenv(BACKEND_DIR.parent.parent / ".env")  # otherwise the course root .env


@dataclass
class ShopDeps:
    """Per-request context passed to the agent (PydanticAI dependency injection).

    Built fresh for every chat request in main.py from the auth token and the page the shopper is on,
    so customer identity and page context reach the agent without being written into the prompt file.
    """

    customer: CustomerContext | None = None  # None for guests
    page: PageContext | None = None
    viewing: ViewedProduct | None = None  # product on the current page, looked up in the DB
    # Every product_id a tool returned during this run. Only these may be shown on the page.
    seen_ids: set[str] = field(default_factory=set)

    def __post_init__(self):
        if self.viewing:
            self.seen_ids.add(self.viewing.product_id)


def make_model() -> OpenAIResponsesModel:
    """OpenAI model routed through Portkey, using PORTKEY_API_KEY from .env."""
    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is missing from the root .env file.")
    client = AsyncOpenAI(
        api_key=key,
        base_url="https://api.portkey.ai/v1",
        default_headers={"x-portkey-api-key": key, "x-portkey-provider": "openai"},
    )
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))


shop_agent = Agent(
    make_model(),
    deps_type=ShopDeps,
    output_type=AgentReply,
    instructions=PROMPT_PATH.read_text(encoding="utf-8"),
)


@shop_agent.instructions
def customer_context(ctx: RunContext[ShopDeps]) -> str:
    c = ctx.deps.customer
    if c is None:
        return "## Customer\nThe shopper is a guest (not logged in). Their chat is not saved."
    return (
        "## Customer\n"
        f"Logged in as {c.first_name} {c.last_name} ({c.email}). "
        "Their chat history is saved, so earlier messages in this conversation may be from previous visits."
    )


@shop_agent.instructions
def page_context(ctx: RunContext[ShopDeps]) -> str:
    page, viewing = ctx.deps.page, ctx.deps.viewing
    if page is None:
        return "## Current page\nUnknown."
    lines = ["## Current page", f"The shopper is on {page.path} ({page.page_type.replace('_', ' ')} page)."]
    if viewing:
        lines.append(
            f"They are viewing the product page for **{viewing.name}** (product_id `{viewing.product_id}`, "
            f"{viewing.garment_type}, colors: {', '.join(viewing.colors)}, ${viewing.price:.0f}). "
            'Words like "this", "it", or "this one" refer to this product unless they clearly mean something else.'
        )
    elif page.results_title:
        lines.append(f'The Products page is currently showing chat results titled "{page.results_title}".')
    return "\n".join(lines)


def _remember(ctx: RunContext[ShopDeps], result):
    """Record product ids returned by a tool so the endpoint can verify the agent's product_ids."""
    if isinstance(result, SearchResults):
        ctx.deps.seen_ids.update(p.product_id for p in result.products)
    elif isinstance(result, ProductNotFound):
        ctx.deps.seen_ids.update(p.product_id for p in result.similar_products)
    else:
        ctx.deps.seen_ids.add(result.product_id)
    return result


@shop_agent.tool
def search_products(
    ctx: RunContext[ShopDeps],
    query: str = "",
    category: Category | None = None,
    limit: int = 8,
    size: str | None = None,
    include_unavailable: bool = False,
) -> SearchResults:
    """Search the Campus Customs catalogue. Inventory-aware, with a closest-match fallback.
    - `category`: one of hoodie, crewneck, t-shirt, quarter-zip, jacket, long-sleeve. Use it for "what X do
      you have?" questions. With an empty query it returns every product in that category.
    - `query`: a few keywords (e.g. "navy", "Pierson", "Yale Mom", "baseball"), ranked by relevance.
    - `limit`: max results, up to 30. Use 30 for category browsing, ~8 for specific lookups.
    - `size`: if the customer gave a size ("he wears XL"), only products in stock in that size are returned.
    - `include_unavailable`: default False hides sold-out products (listed by name in unavailable_matches).
      Set True only when the customer explicitly wants to see sold-out items too.
    Returns match_quality (exact / partial / none) with a note, total_matches, the price range, and the
    products (available first) with price, in_stock, total_stock and in-stock sizes."""
    return _remember(ctx, tools.search_products(query, category, limit, size, include_unavailable))


@shop_agent.tool
def get_product_details(ctx: RunContext[ShopDeps], product_id: str) -> ProductDetails | ProductNotFound:
    """Get the full description, garment type, colors and price of one product.
    Use for "what does it look like / what color / tell me about" questions."""
    return _remember(ctx, tools.get_product_details(product_id))


@shop_agent.tool
def get_product_price(ctx: RunContext[ShopDeps], product_id: str) -> ProductPrice | ProductNotFound:
    """Get the current price (USD) of one product. Use whenever you state a price."""
    return _remember(ctx, tools.get_product_price(product_id))


@shop_agent.tool
def check_stock(
    ctx: RunContext[ShopDeps], product_id: str, size: str | None = None
) -> StockReport | ProductNotFound:
    """Get live inventory for one product: quantity for every size, which sizes are sold out, and total stock.
    Pass `size` (e.g. "M", "large", "XXL") when the customer asks about a specific size; the result's
    requested_size_in_stock and requested_size_quantity then answer that question directly."""
    return _remember(ctx, tools.check_stock(product_id, size))


def to_message_history(history: list[ChatTurn]) -> list[ModelMessage]:
    """Convert widget chat turns into PydanticAI message history."""
    messages: list[ModelMessage] = []
    for turn in history:
        if turn.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return messages
