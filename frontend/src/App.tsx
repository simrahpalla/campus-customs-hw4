import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import ChatWidget from './components/ChatWidget'
import { COLLECTIONS, openChat } from './catalog'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import About from './pages/About'
import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <p className="footer-brand">
            Campus
            <br />
            <em>Customs</em>
          </p>
          <p className="footer-tagline">Officially licensed Yale apparel, designed for everyday Bulldog pride.</p>
        </div>
        <div className="footer-col">
          <h4>Shop</h4>
          <ul>
            <li><Link to="/products">All products</Link></li>
            {COLLECTIONS.map((c) => (
              <li key={c.slug}><Link to={`/products?collection=${c.slug}`}>{c.label}</Link></li>
            ))}
          </ul>
        </div>
        <div className="footer-col">
          <h4>Help</h4>
          <ul>
            <li><button onClick={() => openChat()}>Ask the shop assistant</button></li>
            <li><Link to="/login">Log in</Link></li>
            <li><Link to="/create-account">Create account</Link></li>
            <li><Link to="/about">About us</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Visit</h4>
          <address>
            Campus Customs
            <br />
            57 Broadway
            <br />
            New Haven, CT 06511
          </address>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>© {new Date().getFullYear()} Campus Customs</span>
          <span>New Haven ✦ Connecticut</span>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const { pathname } = useLocation()
  // Start each new page at the top, like a normal storefront.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="*" element={<p className="status">Page not found.</p>} />
        </Routes>
      </main>
      <Footer />
      <ChatWidget />
    </>
  )
}
