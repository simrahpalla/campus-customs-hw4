// Shared storefront vocabulary: category labels and homepage collections.
// Collections are matched on real product names from the catalogue; nothing here invents products.

export const CATEGORY_LABELS: Record<string, string> = {
  hoodie: 'Hoodies',
  crewneck: 'Crewnecks',
  't-shirt': 'T-shirts',
  'quarter-zip': 'Quarter-zips',
  jacket: 'Jackets & fleece',
  'long-sleeve': 'Long-sleeve',
}

// Singular label shown on product cards, e.g. "Hoodie".
export const categoryName = (category: string | null | undefined) =>
  category ? (CATEGORY_LABELS[category] ?? category).replace(/ & fleece$/, '').replace(/s$/, '') : 'Apparel'

const RESIDENTIAL_COLLEGES = [
  'benjamin franklin', 'berkeley', 'branford', 'davenport', 'ezra stiles', 'grace hopper', 'jonathan edwards',
  'morse', 'pauli murray', 'pierson', 'saybrook', 'silliman', 'timothy dwight', 'trumbull',
]
// Whole words only, so "crew" (rowing) doesn't match "crewneck" or "Raglan Crew".
const SPORTS = new RegExp(
  `\\b(${['baseball', 'basketball', 'football', 'hockey', 'soccer', 'tennis', 'squash', 'sailing', 'fencing',
    'lacrosse', 'diving', 'swimming', 'golf', 'volleyball', 'track', 'crew(?= left chest)'].join('|')})\\b`,
  'i',
)
const FAMILY = /\b(mom|dad|grandma|grandpa|aunt|uncle|brother|sister|cousin)\b/i

export interface Collection {
  slug: string
  label: string
  blurb: string
  image: string // product_id whose photo represents the collection
  matches: (name: string) => boolean
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'colleges',
    label: 'Residential Colleges',
    blurb: 'Crests and colors for every college, from Berkeley to Grace Hopper.',
    image: 'pierson-college-crewneck',
    matches: (n) => RESIDENTIAL_COLLEGES.some((c) => n.toLowerCase().includes(c)),
  },
  {
    slug: 'athletics',
    label: 'Yale Athletics',
    blurb: 'Left-chest team marks for the Bulldogs, on the field and in the stands.',
    image: 'squash-left-chest-hoodie',
    matches: (n) => SPORTS.test(n),
  },
  {
    slug: 'family',
    label: 'For the Family',
    blurb: 'Yale Mom, Dad, Grandpa and the rest of the cheering section.',
    image: 'yale-mom-crewneck',
    matches: (n) => FAMILY.test(n),
  },
  {
    slug: 'schools',
    label: 'Graduate & Professional',
    blurb: 'Quarter-zips and fleece for Law, Medicine, Art, Music and more.',
    image: 'school-of-art-1-4-zip',
    matches: (n) => /school|divinity|forest/i.test(n),
  },
]

export const findCollection = (slug: string | null) => COLLECTIONS.find((c) => c.slug === slug) ?? null

// Lets any page open the chat assistant, optionally with a suggested message typed in.
export const openChat = (prompt?: string) =>
  window.dispatchEvent(new CustomEvent('cc-open-chat', { detail: { prompt } }))
