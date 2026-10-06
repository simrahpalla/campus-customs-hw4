import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'

const links = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About Us' },
]

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`

export default function NavBar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile menu after navigating.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <header className={`site-header${menuOpen ? ' menu-open' : ''}`}>
      <div className="utility-bar">
        <div className="container">
          <span>Officially licensed Yale apparel</span>
          <span className="sep">✦</span>
          <span>57 Broadway, New Haven, CT</span>
          <span className="sep">✦</span>
          <span>Sizes XS–XXL</span>
        </div>
      </div>
      <div className="container nav-main">
        <nav className="nav-links" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={navClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <Link to="/" className="wordmark" aria-label="Campus Customs home">
          <span className="wordmark-name">Campus Customs</span>
          <span className="wordmark-place">New Haven · Connecticut</span>
        </Link>

        <button
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <div className="nav-account">
          {user ? (
            <>
              <span className="account-chip">
                <span className="avatar" aria-hidden="true">
                  {user.first_name.charAt(0).toUpperCase()}
                </span>
                <span className="nav-user">Hi, {user.first_name}</span>
              </span>
              <button className="btn btn-outline nav-cta" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Log in
              </NavLink>
              <NavLink to="/create-account" className="btn btn-primary nav-cta">
                Create account
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
