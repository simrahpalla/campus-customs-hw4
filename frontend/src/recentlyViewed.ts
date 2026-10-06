import { useSyncExternalStore } from 'react'

// Products the shopper opened this browser session, newest first. Kept in sessionStorage so it
// survives navigation and refreshes but is gone when the tab closes.
export interface ViewedProduct {
  product_id: string
  name: string
  price: number
  image_url: string
}

const KEY = 'cc_recently_viewed'
const MAX = 8
const EVENT = 'cc-recently-viewed'
let cache: ViewedProduct[] | null = null

function read(): ViewedProduct[] {
  if (cache) return cache
  try {
    cache = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as ViewedProduct[]
  } catch {
    cache = []
  }
  return cache
}

function write(items: ViewedProduct[]) {
  cache = items
  sessionStorage.setItem(KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(EVENT))
}

export function addRecentlyViewed(p: ViewedProduct) {
  const { product_id, name, price, image_url } = p
  write([{ product_id, name, price, image_url }, ...read().filter((x) => x.product_id !== product_id)].slice(0, MAX))
}

export function clearRecentlyViewed() {
  write([])
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

export function useRecentlyViewed(): ViewedProduct[] {
  return useSyncExternalStore(subscribe, read)
}
