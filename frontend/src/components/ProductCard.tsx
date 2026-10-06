import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { categoryName } from '../catalog'

interface Props {
  product: {
    product_id: string
    name: string
    price: number
    image_url: string
    description: string
    category?: string | null
  }
  index?: number // position in the grid, used to stagger the entrance animation
  showDescription?: boolean
}

// Shared by the catalogue, chat results and the homepage so every product looks and links the same way.
export default function ProductCard({ product: p, index = 0, showDescription = true }: Props) {
  const [loaded, setLoaded] = useState(false)
  return (
    <Link to={`/products/${p.product_id}`} className="card" style={{ '--i': index } as React.CSSProperties}>
      <div className="card-media">
        <img
          src={p.image_url}
          alt={p.name}
          loading="lazy"
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
        />
        <span className="card-cta" aria-hidden="true">
          View details <span>→</span>
        </span>
      </div>
      <div className="card-body">
        <span className="label">{categoryName(p.category)}</span>
        <div className="card-topline">
          <h3 className="card-name">{p.name}</h3>
          <span className="card-price">{formatPrice(p.price)}</span>
        </div>
        {showDescription && <p className="card-desc">{p.description}</p>}
      </div>
    </Link>
  )
}
