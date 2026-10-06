import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProduct, formatPrice, type Product } from '../api'
import { CATEGORY_LABELS, categoryName, openChat } from '../catalog'
import RecentlyViewed from '../components/RecentlyViewed'
import { addRecentlyViewed } from '../recentlyViewed'

const LOW_STOCK = 5

export default function ProductDetail() {
  const { productId } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!productId) return
    setError(null)
    fetchProduct(productId)
      .then((p) => {
        setProduct(p)
        addRecentlyViewed(p)
      })
      .catch((e: Error) => setError(e.message))
  }, [productId])

  if (error) return <p className="status error">Couldn't load this product: {error}</p>
  // Also covers switching between products, so the old one isn't shown while the new one loads.
  if (!product || product.product_id !== productId) return <p className="status">Loading…</p>

  const stock = product.inventory ?? []
  const inStock = stock.filter((s) => s.quantity > 0)
  const total = stock.reduce((n, s) => n + s.quantity, 0)

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/products">Shop</Link>
        <span>/</span>
        {product.category && (
          <>
            <span>{CATEGORY_LABELS[product.category]}</span>
            <span>/</span>
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="pdp">
        <div className="pdp-media">
          <img src={product.image_url} alt={product.name} />
          <span className="corner label">{categoryName(product.category)}</span>
        </div>

        <div className="pdp-info">
          <div>
            <span className="label">{product.garment_type}</span>
            <h1 className="pdp-title">{product.name}</h1>
          </div>
          <p className="pdp-price">{formatPrice(product.price)}</p>
          <p className="pdp-desc">{product.description}</p>

          <div>
            <span className="label">Colors</span>
            <div className="swatches">
              {product.colors.map((c) => (
                <span key={c} className="swatch">
                  {c}
                </span>
              ))}
            </div>
          </div>

          {stock.length > 0 && (
            <div>
              <div className="size-head">
                <span className="label">Sizes &amp; stock</span>
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {inStock.length === 0 ? 'Sold out in every size' : `${inStock.length} of ${stock.length} sizes in stock`}
                </span>
              </div>
              <ul className="sizes size-grid">
                {stock.map((s) => {
                  const cls = s.quantity === 0 ? 'sold-out' : s.quantity <= LOW_STOCK ? 'low' : ''
                  return (
                    <li key={s.size} className={`size ${cls}`}>
                      <strong>{s.size}</strong>
                      <span>{s.quantity === 0 ? 'Sold out' : s.quantity <= LOW_STOCK ? `Only ${s.quantity} left` : `${s.quantity} left`}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            onClick={() => openChat(`Is the ${product.name} available in my size?`)}
          >
            Ask the shop assistant about this <span className="arrow">→</span>
          </button>

          <ul className="pdp-notes">
            <li>
              <span>Total in stock</span>
              <span>{total} pieces</span>
            </li>
            <li>
              <span>Category</span>
              <span>{product.category ? CATEGORY_LABELS[product.category] : product.garment_type}</span>
            </li>
            <li>
              <span>Licensing</span>
              <span>Officially licensed Yale apparel</span>
            </li>
          </ul>
        </div>
      </div>

      <RecentlyViewed excludeId={product.product_id} />
    </div>
  )
}
