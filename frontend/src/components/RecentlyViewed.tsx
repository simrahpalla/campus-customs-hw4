import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { clearRecentlyViewed, useRecentlyViewed } from '../recentlyViewed'

// Rail of products opened this session. `excludeId` hides the product currently on screen.
export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const items = useRecentlyViewed().filter((p) => p.product_id !== excludeId)
  if (items.length === 0) return null

  return (
    <section className="recent" aria-label="Recently viewed products">
      <div className="recent-head">
        <h2>
          Recently viewed<sup>{String(items.length).padStart(2, '0')}</sup>
        </h2>
        <button className="text-link link-button" onClick={clearRecentlyViewed}>
          Clear
        </button>
      </div>
      <div className="recent-list">
        {items.map((p) => (
          <Link key={p.product_id} to={`/products/${p.product_id}`} className="recent-item">
            <span className="thumb">
              <img src={p.image_url} alt="" />
            </span>
            <span className="recent-name">{p.name}</span>
            <span className="recent-price price">{formatPrice(p.price)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
