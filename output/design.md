# Campus Customs: Design Notes

**Direction:** Ebbets Field Flannels × vintage Yale newspaper × modern streetwear drop. A heritage serif with oversized editorial type, bold blocks of Yale blue, warm paper/cream neutrals, thin varsity rules, and restrained motion. All functionality is unchanged. Every product, price, count and stock figure shown comes from the database.

## What changed

**Visual system** (`frontend/src/index.css`, `index.html`)
- **Type:** *DM Serif Display* for headlines, prices and numbers (heritage, newspaper-like), with *Inter* for body and interface text. Small uppercase tracked labels act as the "varsity" voice.
- **Palette:** Yale blue `#00356b` and deep navy `#0b1f3a` as full-bleed blocks (hero, collections, results banner, footer, auth panel), on paper `#fbf8f1` and cream `#f3ecdd`. Varsity gold `#c9a24c` is used only as an accent: rules, numbers, the active chat badge.
- **Heritage details:** inset 1px gold frames on blue blocks, oversized numerals (01, 02…), a rotating "Campus Customs ✦ New Haven, CT" stamp, a utility bar ("Officially licensed Yale apparel ✦ 57 Broadway"), and thin rules between sections.
- **Consistency:** a single 2px radius, one easing curve, one button system (primary / gold / outline), and shared spacing tokens.

**Pages**
- **Navigation:** centered serif wordmark with "New Haven · Connecticut" under it. Links get an animated gold underline on hover; the active page gets a solid blue underline. Logged-in users see a monogram avatar plus "Hi, {name}". On mobile there's a Menu toggle.
- **Home:**
  - split-screen hero: big "Bulldog *blue,* every day." on Yale blue, beside a full-height product photo with a live product tag and live counts
  - sliding text band ("Boola Boola ✦ Residential colleges ✦ …")
  - **The Edit**, a magazine grid with one large feature (oversized "01") and four smaller picks
  - a navy **collections** list (Residential Colleges, Athletics, Family, Graduate & Professional) with live piece counts, linking to filtered shop pages
  - an editorial block where the headline overlaps the image
  - an **"Ask the shop"** section whose prompt buttons open the chat with the question already typed
- **Product cards:** full-bleed square photos, an image fade-in on load, a slow zoom on hover, and a "View details →" bar that slides up. Hierarchy is category label → name with a serif price → two-line description. Cards enter in a staggered sequence.
- **Shop page:** a giant "The *Shop*" title with a gold count. Search (underlined field with a magnifier) and category tabs (with live counts and animated underlines) share one sticky bar under the header. Collection links show a removable tag. The "no matches" state is a framed cream panel with *Clear filters* / *Ask the assistant*.
- **Chat results:** a navy banner, "From the shop assistant / *{title}*", above the same cards as the rest of the shop.
- **Product detail:** breadcrumb; a large square image with hover zoom; a sticky info column with a huge serif title, blue price, color swatches, and a 6-up size grid. Sold-out sizes are hatched and struck through; "Only N left" appears in red when 5 or fewer remain. There's also an **Ask the shop assistant about this** button.
- **Recently viewed:** a serif-headed horizontal rail with a gold count and square thumbnails, so it reads as part of the shop.
- **Log in / Create account:** split layout with a navy brand panel listing real account benefits (saved chat, assistant knows your name, 30-day sign-in) beside underline-style form fields.
- **Chat assistant:** a pill launcher ("CC" gold badge + "Ask the shop / Sizes, stock & gift ideas"). The panel has a navy header ("The Shop Assistant", "Campus Customs · New Haven, CT") with a gold rule. Assistant messages are white cards with a gold edge; customer messages are blue bubbles with their name. There's a three-dot typing indicator, suggested-question chips, and **mini product cards** (up to 3) in each reply, plus a "View all N products on page →" button.
- **Footer:** a large serif "Campus *Customs*" with Shop / Help / Visit columns, the address and collection links.
- **Responsive and motion:** stacked hero, slide-down menu, two-column product grid, swipeable tabs and full-width chat on phones. All motion is subtle and switches off for users who set "reduce motion".

## Why it should help customers engage and buy

- **A clear brand earns trust.** The licensing line, address, consistent heritage styling and real counts make it feel like an established Yale shop, not a template. That matters before someone enters payment details.
- **Big imagery sells apparel.** Full-bleed square photos with hover zoom put the garment first and invite the click into the detail page.
- **Editorial entry points get people browsing.** "The Edit" and the four numbered collections give first-time visitors (parents, alumni) a starting point besides the 102-item grid. Each collection is one click to a filtered shop.
- **Less friction to the right product.** Search and tabs stay in reach while scrolling, live counts show what's available before you click, and the no-match state leads into the assistant instead of a dead end.
- **Stock is shown honestly, and urgency is real.** The size grid shows exactly what can be bought. "Only 2 left" comes from the database, so it creates real urgency without fake "bestseller" or "new" badges.
- **The assistant feels like part of the shop.** It's reachable from the hero, product pages, empty states and footer, and it shows products as cards that match the storefront. That makes it a natural way to shop rather than a support widget.
- **Comparison and return visits.** The Recently viewed rail and saved chat make it easy to compare options and come back to an item later.

## Note

Many of the provided product photos have black or white backgrounds, and some have black bars baked into the image. Cards use full-bleed square framing so each photo reads as an intentional "plate". The homepage and story imagery were picked from the cleanest shots.
