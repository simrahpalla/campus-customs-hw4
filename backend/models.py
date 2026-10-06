"""Structured types shared by the chat endpoint, the agent, and its tools."""

from typing import Literal

from pydantic import BaseModel, Field


Category = Literal["hoodie", "crewneck", "t-shirt", "quarter-zip", "jacket", "long-sleeve"]


class ProductCard(BaseModel):
    """A catalogue match, as returned to the agent by search_products."""

    product_id: str
    name: str
    category: Category | None = Field(description="Normalized garment category.")
    garment_type: str
    price: float
    image_url: str
    in_stock: bool = Field(description="True if at least one size has stock.")
    total_stock: int
    in_stock_sizes: list[str] = Field(description="Sizes with at least one unit in stock.")


class SearchResults(BaseModel):
    """What search_products returns to the agent. Counts are precomputed so the model never has to count."""

    match_quality: Literal["exact", "partial", "none"] = Field(
        description="exact: products match every search word. partial: no product matches them all, so these are "
        "the closest alternatives. none: nothing matched; these are in-stock suggestions instead."
    )
    note: str | None = Field(default=None, description="Explains partial/none results or filtering. Relay it.")
    unmatched_terms: list[str] = Field(
        default_factory=list, description="Search words no product in the catalogue matches (e.g. a color we lack)."
    )
    total_matches: int = Field(description="Number of products returned. Use this when saying how many we have.")
    min_price: float | None
    max_price: float | None
    products: list[ProductCard] = Field(description="Best first. Available items come before unavailable ones.")
    unavailable_matches: list[str] = Field(
        default_factory=list,
        description="Names of matching products left out because they're sold out (or sold out in the requested "
        "size). Mention them only if useful.",
    )


class ProductResult(ProductCard):
    """A product in the chat API response, with everything the frontend needs to draw a Products-page card."""

    description: str


# --- Lookup results returned to the agent by the tools in tools.py ---


class ProductDetails(BaseModel):
    """Descriptive facts about one product (get_product_details)."""

    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str]
    price: float = Field(description="Price in USD.")


class ProductPrice(BaseModel):
    """The price of one product (get_product_price)."""

    product_id: str
    name: str
    price: float = Field(description="Price in USD.")
    currency: Literal["USD"] = "USD"


class StockLevel(BaseModel):
    """Inventory for one size."""

    size: str = Field(description="One of XS, S, M, L, XL, XXL.")
    quantity: int
    in_stock: bool = Field(description="True if quantity > 0. False means this size is sold out.")


class StockReport(BaseModel):
    """Inventory for one product, optionally focused on one requested size (check_stock)."""

    product_id: str
    name: str
    in_stock: bool = Field(description="True if at least one size has stock.")
    total_quantity: int
    sizes: list[StockLevel] = Field(description="Every size, in XS→XXL order, including sold-out ones.")
    sold_out_sizes: list[str]
    requested_size: str | None = Field(
        default=None, description="The size asked about, normalized (e.g. 'large' → 'L'). None if no size asked."
    )
    requested_size_quantity: int | None = None
    requested_size_in_stock: bool | None = Field(
        default=None, description="Answer to 'is size X in stock?'. None if no size asked or size is invalid."
    )
    note: str | None = Field(default=None, description="Extra info, e.g. the requested size isn't one we carry.")


class ProductNotFound(BaseModel):
    """Returned when a product_id doesn't match the catalogue."""

    requested: str
    message: str
    similar_products: list[ProductCard] = Field(
        description="Closest catalogue matches, so you can confirm which one the customer meant."
    )


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PageContext(BaseModel):
    """Where the shopper is on the site when they send a message (sent by the frontend)."""

    path: str = Field(default="/", max_length=300)
    page_type: Literal["home", "products", "product_detail", "about", "login", "create_account", "other"] = "other"
    product_id: str | None = Field(default=None, max_length=200, description="Set on a product detail page.")
    results_title: str | None = Field(
        default=None, max_length=200, description="Heading of chat results shown on the Products page, if any."
    )


class ChatRequest(BaseModel):
    """What the chat widget sends: the new message, earlier turns (guests only), and page context."""

    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    page: PageContext | None = None


class CustomerContext(BaseModel):
    """Logged-in customer identity given to the agent through its dependencies."""

    user_id: int
    first_name: str
    last_name: str
    email: str


class ViewedProduct(BaseModel):
    """The product on the page the shopper is viewing, resolved from the database."""

    product_id: str
    name: str
    garment_type: str
    colors: list[str]
    price: float


class AgentReply(BaseModel):
    """The agent's structured output."""

    message: str = Field(description="Your reply to the customer, in plain text (no Markdown).")
    product_ids: list[str] = Field(
        default_factory=list,
        description="product_id values (from this turn's tool results only) to show on the page as product "
        "cards, in display order. For a category/browse question include every relevant match (max 30). "
        "Leave empty if no products are relevant.",
    )
    results_title: str | None = Field(
        default=None,
        description="Short heading for the products shown on the page, e.g. 'Hoodies' or 'Gifts for Mom'. "
        "None when product_ids is empty.",
    )


class ChatResponse(BaseModel):
    """API contract for POST /api/chat: the reply text plus structured products for the page to render."""

    reply: str
    products: list[ProductResult] = Field(default_factory=list)
    results_title: str | None = None


class HistoryMessage(BaseModel):
    """One saved chat message, as returned by GET /api/chat/history."""

    role: Literal["user", "assistant"]
    content: str
    products: list[ProductResult] = Field(default_factory=list)
    results_title: str | None = None
    created_at: str


class AuditEntry(BaseModel):
    """One line of the append-only audit trail (output/audit_trail.json). Short, sanitized values only."""

    timestamp: str = Field(description="UTC time in ISO 8601.")
    run_id: str = Field(description="Groups all entries from one chat request / agent run.")
    step: int = Field(description="Order of this entry within the run.")
    actor: str = Field(description="'guest' or 'user:<id>'. Never an email or name.")
    action: Literal["user_message", "tool_call", "tool_retry", "final_answer", "agent_error"]
    tool: str | None = Field(default=None, description="Tool name for tool calls, 'final_result' for the answer.")
    args: dict = Field(default_factory=dict, description="Sanitized, truncated arguments.")
    result: str = Field(description="One-line sanitized summary of the outcome, not the raw data.")
    stop_reason: str | None = Field(
        default=None,
        description="Why the model stopped at this step (e.g. 'tool_call', 'stop'), or why the run ended "
        "('usage_limit', 'error').",
    )
    model: str | None = None
