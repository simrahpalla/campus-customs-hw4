import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="container page">
      <section className="about-hero">
        <div>
          <span className="label">About Campus Customs</span>
          <h1 className="about-title">
            About <em>Us</em>
          </h1>
        </div>
        <p className="about-lede">
          We're the team behind Yale Bulldog Blue: officially licensed Yale University apparel, made in the spirit of
          New Haven and worn far beyond it.
        </p>
      </section>

      <section className="about-body">
        <div>
          <p>
            Campus Customs runs a shop of officially licensed Yale merchandise at 57 Broadway in New Haven,
            Connecticut, just steps from campus.
          </p>
          <p>
            We design for the whole Yale community: students repping their residential college, athletes and fans
            backing their team, graduate and professional students, and the families who cheer them on. Alumni and
            families can carry the Bulldog spirit anywhere, too. We ship internationally.
          </p>
        </div>
        <ol className="values">
          <li>
            <span className="num">01</span>
            <div>
              <h3>Officially licensed</h3>
              <p>Every piece carries authentic Yale marks.</p>
            </div>
          </li>
          <li>
            <span className="num">02</span>
            <div>
              <h3>Everyday comfort</h3>
              <p>Hoodies, crewnecks, quarter-zips and tees made for real campus life, not just the display case.</p>
            </div>
          </li>
          <li>
            <span className="num">03</span>
            <div>
              <h3>Pride for everyone</h3>
              <p>Gear for every college, sport, school and proud relative.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="visit">
        <div>
          <span className="label on-dark">Visit the shop</span>
          <h2>57 Broadway, New Haven</h2>
          <address>Campus Customs · 57 Broadway · New Haven, CT 06511</address>
        </div>
        <Link to="/products" className="btn btn-gold">
          Shop online <span className="arrow">→</span>
        </Link>
      </section>
    </div>
  )
}
