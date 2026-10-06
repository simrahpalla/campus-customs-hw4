import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  clearChatHistory,
  fetchChatHistory,
  formatPrice,
  sendChat,
  type ChatProduct,
  type ChatTurn,
  type PageContext,
  type User,
} from '../api'
import { useAuth } from '../auth'
import { useChatResults, type ChatResults } from '../chatResults'

interface ChatMessage extends ChatTurn {
  results?: ChatResults
  error?: boolean
  local?: boolean // greeting / notices that aren't part of the real conversation
}

function greeting(user: User | null, returning: boolean): ChatMessage {
  const content = user
    ? returning
      ? `Welcome back, ${user.first_name}! Here's our earlier conversation. What can I help you find today?`
      : `Hi ${user.first_name}! I'm the Campus Customs assistant. Ask me about our Yale merch, sizes, or gift ideas.`
    : "Hi! I'm the Campus Customs assistant. Ask me about our Yale merch, sizes, or gift ideas. Log in to save your chat."
  return { role: 'assistant', content, local: true }
}

const SUGGESTIONS = ['What hoodies do you have?', 'Gift ideas for my mom', 'Anything in size XL?']
const MAX_INLINE_CARDS = 3

function toResults(products: ChatProduct[], title: string | null): ChatResults | undefined {
  return products.length > 0 ? { title: title ?? 'Recommended for you', products } : undefined
}

// Describe the current page so the agent knows what "this" refers to.
function pageContext(pathname: string, resultsTitle: string | null): PageContext {
  const product = pathname.match(/^\/products\/([^/]+)$/)
  const types: Record<string, PageContext['page_type']> = {
    '/': 'home',
    '/products': 'products',
    '/about': 'about',
    '/login': 'login',
    '/create-account': 'create_account',
  }
  return {
    path: pathname,
    page_type: product ? 'product_detail' : (types[pathname] ?? 'other'),
    product_id: product ? decodeURIComponent(product[1]) : null,
    results_title: pathname === '/products' ? resultsTitle : null,
  }
}

export default function ChatWidget() {
  const { token, user } = useAuth()
  const { results: pageResults, show } = useChatResults()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([greeting(null, false)])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Other parts of the site (hero, product pages, footer) can open the chat with a suggested question.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      setOpen(true)
      if (prompt) setInput(prompt)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    window.addEventListener('cc-open-chat', onOpen)
    return () => window.removeEventListener('cc-open-chat', onOpen)
  }, [])

  // Load a logged-in customer's saved chat; reset to a fresh guest chat on logout.
  useEffect(() => {
    if (!user || !token) {
      setMessages([greeting(null, false)])
      return
    }
    let cancelled = false
    fetchChatHistory(token)
      .then((saved) => {
        if (cancelled) return
        const restored = saved.map((m) => ({
          role: m.role,
          content: m.content,
          results: toResults(m.products, m.results_title),
        }))
        setMessages([greeting(user, restored.length > 0), ...restored])
      })
      .catch(() => !cancelled && setMessages([greeting(user, false)]))
    return () => {
      cancelled = true
    }
  }, [user, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, open])

  function viewResults(results: ChatResults) {
    show(results)
    navigate('/products')
  }

  async function clearHistory() {
    if (!token || !confirm('Clear your saved chat history?')) return
    await clearChatHistory(token)
    setMessages([greeting(user, false)])
  }

  async function send(e?: FormEvent, preset?: string) {
    e?.preventDefault()
    const text = (preset ?? input).trim()
    if (!text || busy) return
    // Guests send recent turns as context; for logged-in customers the server uses their saved history.
    const history = user
      ? []
      : messages
          .filter((m) => !m.local && !m.error)
          .slice(-10)
          .map(({ role, content }) => ({ role, content }))
    const page = pageContext(pathname, pageResults?.title ?? null)
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setBusy(true)
    try {
      const res = await sendChat(text, history, page, token)
      const results = toResults(res.products, res.results_title)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, results }])
      if (results) {
        show(results)
        // Bring the results into view, unless the user is already on the one product being discussed.
        const onThatProduct = results.products.length === 1 && pathname === `/products/${results.products[0].product_id}`
        if (!onThatProduct) navigate('/products')
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: (err as Error).message, error: true }])
    } finally {
      setBusy(false)
    }
  }

  const showSuggestions = !busy && messages.every((m) => m.local)

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" aria-label="Chat with the Campus Customs shop assistant">
          <header className="chat-header">
            <div>
              <h2>The Shop Assistant</h2>
              <p>
                <span className="online" aria-hidden="true" />
                Campus Customs · New Haven, CT
              </p>
            </div>
            <div className="chat-header-actions">
              {user && messages.length > 1 && (
                <button className="chat-icon-btn chat-clear" onClick={clearHistory} title="Clear saved chat history">
                  Clear
                </button>
              )}
              <button className="chat-icon-btn close" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
          </header>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`msg chat-msg ${m.role}${m.error ? ' error' : ''}${m.results ? ' has-products' : ''}`}
              >
                <div className="msg-who">{m.role === 'user' ? (user ? user.first_name : 'You') : 'Campus Customs'}</div>
                <div className="msg-bubble">
                  {m.content}
                  {m.results && (
                    <>
                      <div className="chat-products">
                        {m.results.products.slice(0, MAX_INLINE_CARDS).map((p) => (
                          <Link key={p.product_id} to={`/products/${p.product_id}`} className="chat-product">
                            <span className="thumb">
                              <img src={p.image_url} alt="" loading="lazy" />
                            </span>
                            <span className="info">
                              <span className="name">{p.name}</span>
                              <span className="price">{formatPrice(p.price)}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                      <button className="btn btn-outline chat-view-all chat-results-link" onClick={() => viewResults(m.results!)}>
                        View {m.results.products.length === 1 ? '1 product' : `all ${m.results.products.length} products`} on
                        page <span className="arrow">→</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {showSuggestions && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map((q) => (
                  <button key={q} className="chat-suggestion" onClick={() => send(undefined, q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="msg assistant typing" aria-label="The assistant is typing">
                <div className="msg-who">Campus Customs</div>
                <div className="msg-bubble">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form className="chat-input" onSubmit={send}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about sizes, prices, gifts…"
              maxLength={2000}
              aria-label="Message the shop assistant"
            />
            <button type="submit" className="chat-send" disabled={busy || !input.trim()} aria-label="Send">
              →
            </button>
          </form>
        </section>
      )}
      <button
        className={`chat-launcher chat-toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <span className="badge" aria-hidden="true">
          {open ? '×' : 'CC'}
        </span>
        {!open && (
          <span className="text">
            <strong>Ask the shop</strong>
            <small>Sizes, stock &amp; gift ideas</small>
          </span>
        )}
      </button>
    </div>
  )
}
