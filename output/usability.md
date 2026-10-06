# Campus Customs: Usability Improvements

Four improvements to the existing site and shop assistant: two on the frontend and two on the agent/backend. Each section covers what was added, why it helps a Campus Customs shopper or the business, and how it was checked in the running app.

## Frontend

### 1. Product search and category filter

**What was added**
- A search box and a row of category chips on the Products page (`frontend/src/pages/Products.tsx`): All, Hoodies, Crewnecks, T-shirts, Quarter-zips, Jackets & fleece, Long-sleeve.
- Search is instant (no button) and looks at name, garment type, description, colors and tags. Every word must match, so "navy squash" finds the two navy squash items. Search and category combine.
- A live count ("Showing 2 of 102 items").
- A clear **"No matches"** state that repeats what was searched ("Nothing matches 'pierson' in Hoodies."), suggests asking the chat assistant for alternatives, and offers **Clear filters** (plus **Search all products** when chat results are showing).
- The filters also work on top of chat results from Problem 7. After "crewnecks in size S", typing "college" narrows the 22 results to 4.
- Backend support: `GET /api/products` now includes each product's normalized `category`. It uses the same `category_of()` as the agent, so "Hoodies" means the same thing on the page and in the chat, even though the database has 22 inconsistent `garment_type` labels.

**Why it helps**
- **Shoppers:** 102 products in one long grid is a lot to scroll on a phone. Most visitors know roughly what they want ("a Saybrook crewneck", "something navy"), and the filter gets them there in one or two keystrokes. The empty state never leaves them at a dead end.
- **Business:** faster product finding means fewer people leave the site without buying. Linking the empty state to the assistant turns a failed search into a conversation that can still end in a sale.

### 2. Recently viewed products

**What was added**
- Every product detail page a shopper opens is remembered in a "Recently viewed" strip, newest first, up to 8 items. Each entry shows a thumbnail, name and price, and links back to the product page.
- Shown at the top of the Products page and under the product detail. On the detail page it leaves out the product you're looking at.
- Stored in `sessionStorage` (`frontend/src/recentlyViewed.ts`), so it survives navigation and refreshes and is gone when the tab closes. It's cleared on logout so the next person on a shared computer doesn't see it. There's also a **Clear** link.
- Works for guests and logged-in customers, and for products opened from chat results.

**Why it helps**
- **Shoppers:** comparing merch means going back and forth: "was the Branford quarter-zip or the Morse tee the one I liked?" Without this they'd have to search or scroll again. Gift shoppers in particular compare several options before picking one.
- **Business:** it keeps considered items in front of the shopper, which encourages return visits to product pages and makes it easier to come back to an item and buy it.

## Agent / backend

### 3. Inventory-aware recommendations

**What was added**
- `search_products` (`backend/tools.py`) now checks stock as it searches:
  - Sold-out products are **left out by default**. Their names are listed separately in `unavailable_matches`, so the agent knows about them without recommending them.
  - A new **`size`** parameter: "a hoodie for my dad, he wears XL" returns only hoodies with XL stock. Customer wording ("large", "2XL") is normalized.
  - `include_unavailable=True` gets everything when the customer explicitly wants to see sold-out items too. Available items are still listed first.
  - Each product now carries `in_stock` and `total_stock` as well as `in_stock_sizes`.
- The prompt (`prompts/prompt.md`, "Recommend what's actually available") tells the agent to:
  - always pass a size when the customer mentions one,
  - never put a sold-out item forward,
  - mention unavailable items only when useful ("The Yale Dad Crewneck and T-shirt aren't available in XL, but the Yale Dad Hoodie is"),
  - flag low stock (5 or fewer) in the customer's size.

**Why it helps**
- **Shoppers:** nothing is more frustrating than being recommended a hoodie, clicking through, and finding your size sold out. In this catalogue no product is completely sold out, but 145 of the 612 product/size combinations are, so this happens often. Size-aware suggestions mean every card the assistant shows can actually be bought.
- **Business:** recommendations turn into purchases instead of dead ends, and customer trust in the assistant goes up. Steering demand toward items that are in stock also helps sell through inventory.

**Checked:** "hoodie for my dad, he wears XL" → the agent called `search_products(query="dad", category="hoodie", size="XL")` → Yale Dad Hoodie (XL stock 12). "Yale Dad stuff in XL?" → the hoodie, plus a note that the crewneck and tee aren't available in XL (both XL=0 in the database). "Crewneck in size L" → 21 cards, every one with L stock > 0. Sold-out exclusion was also tested on a **temporary copy** of the database with the Yale Mom Hoodie zeroed out: it moved to `unavailable_matches` and came back only with `include_unavailable=True`. The real database was not changed.

### 4. Closest-match fallback instead of "not found"

**What was added**
- Every search now reports a **`match_quality`**, a plain-English `note`, and `unmatched_terms`:
  - **exact:** products match every word.
  - **partial:** no product matches everything, so the closest products are returned, ranked by how many words they match. Example: "pink hoodie" → `unmatched_terms=["pink"]` + our hoodies. "Pierson hoodie" → the Pierson crewneck and tee first, then hoodies.
  - **none:** nothing matched, so in-stock alternatives are returned instead of an empty list.
- A `NOT_CARRIED` map in `tools.py` sends item types we don't sell to the nearest category we do: shorts → athletic tees and performance long-sleeves, sweatpants/joggers → hoodies and crewnecks, beanie → hoodies and jackets. It also stops "shorts" from accidentally matching "short-sleeve".
- Smarter matching: plurals ("hoodies" → hoodie), common synonyms (tee → t-shirt, grey → gray, grandmother → grandma, father → dad) and filler words ("do you have any…") are handled. A bug where `category="hoodie", query="hoodie"` returned nothing was also fixed.
- The prompt ("When there's no exact match, offer the closest alternatives") tells the agent to say plainly what we don't have, then present the alternatives as product cards (e.g. titled "Alternatives to gym shorts"), and never to invent products to fill the gap.

**Why it helps**
- **Shoppers:** they get a helpful next step instead of a dead end: "We don't sell gym shorts, but these athletic tees and performance long-sleeves are great for workouts."
- **Business:** "not found" responses are lost sales. Offering the closest in-stock alternatives keeps the shopper browsing, and `unmatched_terms` (e.g. lots of requests for "pink") shows what customers want that we don't stock, which is useful for future product planning.

**Checked:** "do you sell gym shorts?" → "We don't sell gym shorts, but…" with 4 cards ($32–$45). "pink hoodie" → "We don't have a pink hoodie…" with in-stock hoodie alternatives. "I want a Pierson hoodie" → the Pierson College Crewneck first, plus hoodie options.

## Works with the existing features

Tested together in the running app while logged in as the test user:
- **Chat history:** the earlier conversation reloaded ("Welcome back, Test!"), and the new exchange was saved to `chat_history`.
- **Dynamic product cards:** the chat filled the Products page ("Crewnecks in size S", 22 cards), and the search box and chips filtered those results.
- **Product detail:** clicking a chat-returned card opened the normal detail page and added it to Recently viewed.
- **Auth:** logout clears Recently viewed and resets the chat to guest mode.
