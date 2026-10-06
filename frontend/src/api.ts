export interface StockLevel {
  size: string
  quantity: number
}

export interface Product {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  image_url: string
  price: number
  category: string | null
  inventory?: StockLevel[]
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<T>
}

export const fetchProducts = () => getJson<Product[]>('/api/products')

export const fetchProduct = (id: string) =>
  getJson<Product>(`/api/products/${encodeURIComponent(id)}`)

export const formatPrice = (price: number) => `$${price.toFixed(2)}`

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
}

export interface AuthResponse {
  token: string
  user: User
}

// Turns FastAPI error bodies (string or validation list) into one readable message.
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((d: { loc: string[]; msg: string }) => `${d.loc.at(-1)?.replace('_', ' ')} ${d.msg.replace(/^Value error, /, '')}`)
        .join('. ')
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`
}

async function postJson<T>(url: string, data: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<T>
}

export const login = (email: string, password: string) =>
  postJson<AuthResponse>('/api/auth/login', { email, password })

export const signup = (data: { first_name: string; last_name: string; email: string; password: string }) =>
  postJson<AuthResponse>('/api/auth/signup', data)

export const logout = (token: string) => postJson('/api/auth/logout', {}, token)

export interface ProductCard {
  product_id: string
  name: string
  garment_type: string
  price: number
  image_url: string
  in_stock_sizes: string[]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// A product returned by the chatbot, with what's needed to draw a Products-page card.
export interface ChatProduct extends ProductCard {
  category: string | null
  description: string
}

// API contract for POST /api/chat (mirrors ChatResponse in backend/models.py).
export interface ChatResponse {
  reply: string
  products: ChatProduct[]
  results_title: string | null
}

// Where the shopper is on the site, sent with every chat message (mirrors PageContext in models.py).
export interface PageContext {
  path: string
  page_type: 'home' | 'products' | 'product_detail' | 'about' | 'login' | 'create_account' | 'other'
  product_id: string | null
  results_title: string | null
}

export const sendChat = (message: string, history: ChatTurn[], page: PageContext, token?: string | null) =>
  postJson<ChatResponse>('/api/chat', { message, history, page }, token ?? undefined)

// A saved message for a logged-in customer (mirrors HistoryMessage in models.py).
export interface HistoryMessage extends ChatTurn {
  products: ChatProduct[]
  results_title: string | null
  created_at: string
}

export async function fetchChatHistory(token: string): Promise<HistoryMessage[]> {
  const res = await fetch('/api/chat/history', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<HistoryMessage[]>
}

export async function clearChatHistory(token: string): Promise<void> {
  const res = await fetch('/api/chat/history', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(await errorMessage(res))
}

// The server said the session token is invalid or expired (as opposed to being unreachable).
export class UnauthorizedError extends Error {}

export async function fetchMe(token: string): Promise<User> {
  const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new UnauthorizedError(await errorMessage(res))
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<User>
}
