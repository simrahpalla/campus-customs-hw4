"""Read-only catalogue tools for the shop agent.

Every fact (description, price, stock) is read straight from data/campus_customs.db on each call;
nothing is cached or copied, so answers always reflect the current database.
"""

import json
import math
import re
import sqlite3

from db import get_db
from models import (
    Category,
    ProductCard,
    ProductDetails,
    ProductNotFound,
    ProductPrice,
    ProductResult,
    SearchResults,
    StockLevel,
    StockReport,
)

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

# Ways customers say sizes -> the codes stored in inventory.size
SIZE_ALIASES = {
    "xs": "XS", "extra small": "XS", "x-small": "XS", "xsmall": "XS",
    "s": "S", "small": "S", "sm": "S",
    "m": "M", "medium": "M", "med": "M",
    "l": "L", "large": "L", "lg": "L",
    "xl": "XL", "extra large": "XL", "x-large": "XL", "xlarge": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx-large": "XXL", "xxlarge": "XXL", "extra extra large": "XXL", "double xl": "XXL",
}


def normalize_size(size: str) -> str | None:
    """Map 'large', 'Lg', 'l' etc. to 'L'. Returns None if it isn't a size we stock."""
    return SIZE_ALIASES.get(re.sub(r"\s+", " ", size.strip().lower()))


def category_of(garment_type: str) -> Category | None:
    """Collapse the 22 inconsistent garment_type strings into a few shopper-facing categories."""
    g = garment_type.lower()
    if "quarter-zip" in g:
        return "quarter-zip"
    if "hood" in g:
        return "hoodie"
    if "jacket" in g:
        return "jacket"
    if "t-shirt" in g:  # before "crew", so "crew-neck t-shirt" is a tee
        return "t-shirt"
    if "crew" in g or "mockneck" in g:
        return "crewneck"
    if "long-sleeve" in g:
        return "long-sleeve"
    return None


def _stock_for(conn: sqlite3.Connection, product_id: str) -> list[StockLevel]:
    rows = conn.execute(
        "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
    ).fetchall()
    stock = [StockLevel(size=r["size"], quantity=r["quantity"], in_stock=r["quantity"] > 0) for r in rows]
    return sorted(stock, key=lambda s: SIZE_ORDER.index(s.size) if s.size in SIZE_ORDER else 99)


def _card(conn: sqlite3.Connection, row: sqlite3.Row) -> ProductCard:
    stock = _stock_for(conn, row["product_id"])
    return ProductCard(
        product_id=row["product_id"],
        name=row["name"],
        category=category_of(row["garment_type"]),
        garment_type=row["garment_type"],
        price=row["price"],
        image_url=f"/media/{row['image_file_path']}",
        in_stock=any(s.in_stock for s in stock),
        total_stock=sum(s.quantity for s in stock),
        in_stock_sizes=[s.size for s in stock if s.in_stock],
    )


def _find_row(conn: sqlite3.Connection, product_id: str) -> sqlite3.Row | None:
    """Exact product_id match, falling back to an exact (case-insensitive) product name match."""
    row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (product_id.strip(),)).fetchone()
    if row is None:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE lower(name) = lower(?)", (product_id.strip(),)
        ).fetchone()
    return row


def _not_found(product_id: str) -> ProductNotFound:
    return ProductNotFound(
        requested=product_id,
        message=f"No product with id '{product_id}'. Use a product_id from search_products.",
        similar_products=search_products(product_id.replace("-", " "), limit=3).products,
    )


# Filler words that shouldn't count as search terms.
STOPWORDS = {
    "a", "an", "the", "and", "or", "for", "with", "in", "on", "of", "to", "my", "me", "i", "you", "your", "do",
    "does", "have", "has", "any", "some", "something", "anything", "show", "want", "need", "looking", "like",
    "got", "carry", "sell", "is", "are", "it", "this", "that", "please", "who", "what", "gift", "gifts",
}
# Shopper words -> words that appear in the catalogue text.
SYNONYMS = {
    "tee": "t-shirt", "tshirt": "t-shirt", "hoody": "hoodie", "hooded": "hoodie", "quarterzip": "quarter-zip",
    "grey": "gray", "father": "dad", "mother": "mom", "grandmother": "grandma", "grandfather": "grandpa",
    "jumper": "crewneck", "sweater": "sweatshirt", "pullover": "pullover", "fleece": "fleece",
}


# Items we don't sell -> the categories that make the closest alternatives (empty: no close equivalent).
NOT_CARRIED: dict[str, list[Category]] = {
    "shorts": ["t-shirt", "long-sleeve"], "pants": ["hoodie", "crewneck"], "sweatpants": ["hoodie", "crewneck"],
    "joggers": ["hoodie", "crewneck"], "leggings": ["long-sleeve", "quarter-zip"], "polo": ["t-shirt", "quarter-zip"],
    "polos": ["t-shirt", "quarter-zip"], "hat": [], "hats": [], "cap": [], "caps": [], "beanie": ["hoodie", "jacket"],
    "scarf": ["jacket", "quarter-zip"], "socks": [], "mug": [], "mugs": [], "bag": [], "bags": [], "sticker": [],
}


def _terms(query: str) -> list[str]:
    words = re.findall(r"[a-z0-9][a-z0-9'-]*", query.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def _matches(term: str, text: str) -> bool:
    """A term matches if it, its synonym, or its singular form appears in the text."""
    if term in NOT_CARRIED:  # e.g. "shorts" must not match "short-sleeve"
        return False
    forms = {term, SYNONYMS.get(term, term)}
    if len(term) > 3 and term.endswith("s"):
        forms |= {term[:-1], SYNONYMS.get(term[:-1], term[:-1])}
    return any(f in text for f in forms)


def search_products(
    query: str = "",
    category: Category | None = None,
    limit: int = 8,
    size: str | None = None,
    include_unavailable: bool = False,
) -> SearchResults:
    """Search the catalogue, inventory-aware, with a closest-match fallback.

    Ranking: rare words weigh more than common ones, and name matches count double, so "pierson hoodie"
    ranks Pierson items first. `category` filters to one garment category.
    Inventory: products that are sold out (or sold out in `size`) are left out unless include_unavailable,
    and their names are listed in unavailable_matches.
    Fallback: if no product matches every word, the closest partial matches are returned
    (match_quality="partial"); if nothing matches at all, in-stock suggestions are returned ("none").
    """
    terms = _terms(query)
    size_code = normalize_size(size) if size else None
    limit = max(1, min(limit, 30))
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
        if category:
            rows = [r for r in rows if category_of(r["garment_type"]) == category]
        cards = {r["product_id"]: _card(conn, r) for r in rows}

    def available(pid: str) -> bool:
        c = cards[pid]
        return size_code in c.in_stock_sizes if size_code else c.in_stock

    texts = {
        r["product_id"]: " ".join(
            [r["name"], r["garment_type"], r["description"], r["colors"], r["search_tags"]]
        ).lower()
        for r in rows
    }
    names = {r["product_id"]: r["name"].lower() for r in rows}
    n = len(rows)
    # Floor the weight so a word every product shares (e.g. "hoodie" within the hoodie category) still counts.
    weight = {t: max(math.log((n + 1) / (1 + sum(_matches(t, x) for x in texts.values()))), 0.1) for t in terms}
    unmatched = [t for t in terms if not any(_matches(t, x) for x in texts.values())]

    scored = []  # (words matched, relevance score, product_id)
    for r in rows:
        pid = r["product_id"]
        hit = [t for t in terms if _matches(t, texts[pid])]
        score = sum(weight[t] * (1 + _matches(t, names[pid])) for t in hit)
        if hit or not terms:
            scored.append((len(hit), score, pid))

    note = None
    if not terms or any(h == len(terms) for h, _, _ in scored):
        quality = "exact"
        scored = [s for s in scored if s[0] == len(terms)]
    elif scored:
        quality = "partial"
        missing = f" (nothing matches: {', '.join(unmatched)})" if unmatched else ""
        note = f"No product matches every word of '{query}'{missing}. These are the closest alternatives."
    else:
        quality = "none"
        note = (
            f"Nothing in our catalogue matches '{query}'. We may not carry it. "
            "These are popular in-stock alternatives instead."
        )
        # Most-stocked items, at most two per category, so the suggestions are varied and available.
        # If they asked for something we don't carry, draw from the closest categories (shorts -> tees).
        related = {c for t in terms for c in NOT_CARRIED.get(t, [])}
        pool = [p for p in cards if cards[p].category in related] or list(cards)
        per_cat_max = 6 if category else 2  # one category already chosen: offer more of it
        per_cat: dict = {}
        for pid in sorted(pool, key=lambda p: -cards[p].total_stock):
            cat = cards[pid].category
            if per_cat.get(cat, 0) < per_cat_max:
                per_cat[cat] = per_cat.get(cat, 0) + 1
                scored.append((0, cards[pid].total_stock, pid))

    scored.sort(key=lambda s: (-s[0], -s[1]))  # stable, so ties stay alphabetical
    ranked = [pid for _, _, pid in scored]
    unavailable = [pid for pid in ranked if not available(pid)]
    if include_unavailable:
        ranked = [p for p in ranked if available(p)] + unavailable  # available first
    else:
        ranked = [p for p in ranked if available(p)]
    products = [cards[p] for p in ranked[:limit]]
    if size and not size_code:
        note = (note + " " if note else "") + f"'{size}' isn't a size we carry (XS–XXL), so size was ignored."

    prices = [p.price for p in products]
    return SearchResults(
        match_quality=quality,
        note=note,
        unmatched_terms=unmatched,
        total_matches=len(products),
        min_price=min(prices, default=None),
        max_price=max(prices, default=None),
        products=products,
        unavailable_matches=[] if include_unavailable else [cards[p].name for p in unavailable],
    )


def get_product_details(product_id: str) -> ProductDetails | ProductNotFound:
    with get_db() as conn:
        row = _find_row(conn, product_id)
    if row is None:
        return _not_found(product_id)
    return ProductDetails(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        description=row["description"],
        colors=json.loads(row["colors"]),
        price=row["price"],
    )


def get_product_price(product_id: str) -> ProductPrice | ProductNotFound:
    with get_db() as conn:
        row = _find_row(conn, product_id)
    if row is None:
        return _not_found(product_id)
    return ProductPrice(product_id=row["product_id"], name=row["name"], price=row["price"])


def check_stock(product_id: str, size: str | None = None) -> StockReport | ProductNotFound:
    with get_db() as conn:
        row = _find_row(conn, product_id)
        if row is None:
            return _not_found(product_id)
        sizes = _stock_for(conn, row["product_id"])

    report = StockReport(
        product_id=row["product_id"],
        name=row["name"],
        in_stock=any(s.in_stock for s in sizes),
        total_quantity=sum(s.quantity for s in sizes),
        sizes=sizes,
        sold_out_sizes=[s.size for s in sizes if not s.in_stock],
    )
    if size:
        code = normalize_size(size)
        match = next((s for s in sizes if s.size == code), None)
        if match is None:
            report.note = f"'{size}' is not a size we carry. Available sizes are {', '.join(SIZE_ORDER)}."
        else:
            report.requested_size = match.size
            report.requested_size_quantity = match.quantity
            report.requested_size_in_stock = match.in_stock
    return report


def results_for_ids(product_ids: list[str]) -> list[ProductResult]:
    """Build the products for the chat API response from ids the agent chose, re-read from the DB.
    Unknown ids are dropped, so what the page shows always matches the database."""
    with get_db() as conn:
        results = []
        for pid in dict.fromkeys(product_ids):  # dedupe, keep order
            row = conn.execute("SELECT * FROM catalogue WHERE product_id = ?", (pid,)).fetchone()
            if row is not None:
                results.append(ProductResult(**_card(conn, row).model_dump(), description=row["description"]))
        return results
