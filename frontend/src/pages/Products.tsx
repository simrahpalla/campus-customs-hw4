import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchProducts, type Product } from '../api'
import { CATEGORY_LABELS, findCollection, openChat } from '../catalog'
import { useChatResults } from '../chatResults'
import ProductCard from '../components/ProductCard'
import RecentlyViewed from '../components/RecentlyViewed'

const CATEGORIES = [{ value: 'all', label: 'All' }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]

interface Filterable {
  name: string
  description: string
  garment_type: string
  category: string | null
  colors?: string[]
  search_tags?: string[]
}

// Every typed word must appear somewhere in the product's name, type, description, colors or tags.
function matches(p: Filterable, query: string, category: string) {
  if (category !== 'all' && p.category !== category) return false
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = [p.name, p.garment_type, p.description, ...(p.colors ?? []), ...(p.search_tags ?? [])]
    .join(' ')
    .toLowerCase()
  return words.every((w) => text.includes(w))
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export default function Products() {
  const { results, clear } = useChatResults()
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const collection = findCollection(params.get('collection'))

  useEffect(() => {
    fetchProducts().then(setProducts).catch((e: Error) => setError(e.message))
  }, [])

  // Products returned by the chatbot replace the full catalogue until cleared; filters apply to either.
  // A homepage collection link (?collection=...) narrows the catalogue the same way.
  const source = useMemo(() => {
    const base = results ? results.products : products
    return base && collection && !results ? base.filter((p) => collection.matches(p.name)) : base
  }, [results, products, collection])
  const visible = useMemo(() => (source ?? []).filter((p) => matches(p, query, category)), [source, query, category])
  const countFor = (cat: string) => (source ?? []).filter((p) => matches(p, query, cat)).length
  const filtering = query.trim() !== '' || category !== 'all'
  const resetFilters = () => {
    setQuery('')
    setCategory('all')
  }
  const clearCollection = () => setParams({})

  if (!results && error) return <p className="status error">Couldn't load products: {error}</p>
  if (!source) return <p className="status">Loading products…</p>

  return (
    <div className="container page">
      {results ? (
        <section className="results-banner">
          <div>
            <span className="label on-dark">From the shop assistant</span>
            <h1>{results.title}</h1>
            <p className="count">
              {results.products.length} {results.products.length === 1 ? 'piece' : 'pieces'} picked for you in chat
            </p>
          </div>
          <button className="btn btn-gold" onClick={clear}>
            Show all products
          </button>
        </section>
      ) : (
        <section className="shop-hero">
          <div>
            <span className="label">Campus Customs ✦ Shop</span>
            <h1 className="shop-title">
              {collection ? (
                collection.label
              ) : (
                <>
                  The <em>Shop</em>
                </>
              )}
            </h1>
          </div>
          <div className="shop-count">
            <strong>{String(source.length).padStart(2, '0')}</strong>
            <span className="label">{collection ? 'Pieces in this collection' : 'Officially licensed styles'}</span>
          </div>
        </section>
      )}

      <RecentlyViewed />

      <div className="filter-bar">
        <div className="filter-row">
          <label className="search-field">
            <SearchIcon />
            <input
              type="search"
              className="filter-search"
              placeholder="Search name, color, college, sport…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
          </label>
          <div className="tabs" role="group" aria-label="Filter by category">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={`tab chip${category === c.value ? ' active' : ''}`}
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
                <sup>{countFor(c.value)}</sup>
              </button>
            ))}
          </div>
        </div>
        <div className="filter-meta">
          <span className="result-count">
            {filtering ? `Showing ${visible.length} of ${source.length} items` : `${source.length} items`}
          </span>
          {collection && !results && (
            <span className="filter-tag">
              {collection.label}
              <button onClick={clearCollection} aria-label="Remove collection filter">
                ×
              </button>
            </span>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <span className="label">No matches</span>
          <h2>Nothing in the shop for that.</h2>
          <p>
            Nothing {results ? 'in these chat results ' : ''}matches
            {query.trim() && <strong> “{query.trim()}”</strong>}
            {category !== 'all' && <> in {CATEGORY_LABELS[category]}</>}.
          </p>
          <p className="muted">Try a different word, or ask the shop assistant for the closest alternatives.</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={resetFilters}>
              Clear filters
            </button>
            {results ? (
              <button className="btn btn-outline" onClick={clear}>
                Search all products
              </button>
            ) : (
              <button className="btn btn-outline" onClick={() => openChat(query.trim() ? `Do you have ${query.trim()}?` : undefined)}>
                Ask the assistant
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {visible.map((p, i) => (
            <ProductCard key={p.product_id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
