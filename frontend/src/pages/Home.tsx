import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProducts, formatPrice, type Product } from '../api'
import { COLLECTIONS, openChat } from '../catalog'
import ProductCard from '../components/ProductCard'

// Real catalogue items used for the hero and "The Edit". Missing ids are simply skipped.
const HERO_ID = 'basic-hoodie-big-yale'
const FEATURE_ID = 'district-vit-crewneck-vintage-bulldog'
const EDIT_IDS = ['2025-yale-vs-harvard-t-shirt', 'brooks-brothers-bomber-jacket-yale', 'boola-boola-t-shirt', 't-felt-y-heavyweight']
const STORY_ID = 'yale-mom-crewneck'

const MARQUEE = ['Boola Boola', 'Residential colleges', 'Game day', 'For the whole Yale family', 'Officially licensed', 'New Haven, CT']

const PROMPTS = ['What hoodies do you have?', 'A gift for my dad under $70', 'Do you have the Pierson crewneck in M?']

function Stamp() {
  return (
    <div className="stamp" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs>
          <path id="stamp-circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1" />
        <text fill="currentColor" fontSize="10.5" letterSpacing="3.2" fontFamily="Inter, sans-serif" fontWeight="600">
          <textPath href="#stamp-circle">CAMPUS CUSTOMS ✦ NEW HAVEN, CT ✦ </textPath>
        </text>
      </svg>
      <span className="stamp-center">CC</span>
    </div>
  )
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  const byId = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products])
  const hero = byId.get(HERO_ID)
  const feature = byId.get(FEATURE_ID)
  const edit = EDIT_IDS.map((id) => byId.get(id)).filter((p): p is Product => !!p)
  const story = byId.get(STORY_ID)
  const collectionCount = (matches: (name: string) => boolean) => products.filter((p) => matches(p.name)).length

  return (
    <>
      {/* Split-screen hero */}
      <section className="hero">
        <div className="hero-copy">
          <span className="label on-dark">Campus Customs — New Haven, CT</span>
          <h1 className="hero-title">
            <span className="line"><span>Bulldog</span></span>
            <span className="line"><span><em>blue,</em></span></span>
            <span className="line"><span>every day.</span></span>
          </h1>
          <p className="hero-lede">
            Officially licensed Yale apparel built for real campus life: game days at the Bowl, late nights in
            the stacks, and every Family Weekend in between.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-gold">
              Shop the collection <span className="arrow">→</span>
            </Link>
            <button className="btn btn-outline-light" onClick={() => openChat()}>
              Ask the shop assistant
            </button>
          </div>
          <div className="hero-meta">
            <div>
              <strong>{products.length || '—'}</strong>
              <span>Styles</span>
            </div>
            <div>
              <strong>XS–XXL</strong>
              <span>Every style</span>
            </div>
            <div>
              <strong>{collectionCount(COLLECTIONS[0].matches) || '—'}</strong>
              <span>College pieces</span>
            </div>
          </div>
        </div>
        <div className="hero-media">
          {hero && <img src={hero.image_url} alt={hero.name} />}
          <Stamp />
          {hero && (
            <Link to={`/products/${hero.product_id}`} className="hero-tag">
              <div>
                <strong>{hero.name}</strong>
                <span>{formatPrice(hero.price)}</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </section>

      {/* Sliding text band */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div className="marquee-item" key={copy}>
              {MARQUEE.map((word, i) => (
                <span key={word} style={{ display: 'contents' }}>
                  {i % 2 ? <i>{word}</i> : <span>{word}</span>}
                  <span className="star">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* The Edit: magazine-style featured products */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="label">Featured pieces ✦ Fall</span>
              <h2 className="section-title">
                The <em>Edit</em>
              </h2>
            </div>
            <Link to="/products" className="text-link">
              Shop all products →
            </Link>
          </div>
          <div className="edit-grid">
            {feature && (
              <div className="edit-feature">
                <span className="edit-number" aria-hidden="true">01</span>
                <ProductCard product={feature} />
              </div>
            )}
            <div className="edit-small">
              {edit.map((p, i) => (
                <ProductCard key={p.product_id} product={p} index={i + 1} showDescription={false} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Collections: bold navy block */}
      <section className="section collections">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="label">Shop by collection</span>
              <h2 className="section-title">
                Find your <em>corner</em> of Yale.
              </h2>
            </div>
          </div>
          <ul className="collection-list">
            {COLLECTIONS.map((c, i) => {
              const thumb = byId.get(c.image)
              return (
                <li key={c.slug}>
                  <Link to={`/products?collection=${c.slug}`} className="collection-row">
                    <span className="collection-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="collection-name">
                      {c.label}
                      <span className="collection-blurb">{c.blurb}</span>
                    </span>
                    <span className="collection-count">{collectionCount(c.matches) || ''} pieces →</span>
                    <span className="collection-thumb">{thumb && <img src={thumb.image_url} alt="" loading="lazy" />}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Editorial split with overlapping type */}
      <section className="section">
        <div className="container story">
          <div className="story-media">
            <span className="frame" aria-hidden="true" />
            {story && <img src={story.image_url} alt={story.name} loading="lazy" />}
            <p className="story-overlap">For the whole cheering section.</p>
          </div>
          <div className="story-copy">
            <span className="label">The Yale family</span>
            <h2 className="section-title">
              Proud <em>parents</em>, louder grandparents.
            </h2>
            <p>
              Yale Mom, Yale Dad, Grandpa, Aunt and the rest: pieces made for the people who drive in for move-in day
              and never miss The Game.
            </p>
            <ul className="facts">
              <li>
                <span className="num">01</span>
                <span>Hoodies, crewnecks and tees for every relative</span>
              </li>
              <li>
                <span className="num">02</span>
                <span>Sizes XS through XXL, with live stock on every product page</span>
              </li>
              <li>
                <span className="num">03</span>
                <span>Officially licensed Yale marks</span>
              </li>
            </ul>
            <div>
              <Link to="/products?collection=family" className="btn btn-primary">
                Shop the family collection <span className="arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ask the shop assistant */}
      <section className="section ask">
        <div className="container ask-inner">
          <div>
            <span className="label">The shop assistant</span>
            <h2 className="section-title">
              Not sure what to get? <em>Ask the shop.</em>
            </h2>
            <p>
              Our assistant checks live prices and stock by size, finds the closest match when we don't carry
              something, and puts its picks right on the page.
            </p>
          </div>
          <div className="ask-prompts">
            {PROMPTS.map((q) => (
              <button key={q} className="prompt-btn" onClick={() => openChat(q)}>
                “{q}” <span className="arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
