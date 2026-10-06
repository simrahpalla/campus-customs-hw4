import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  letter: string
  children: ReactNode
}

// Split-screen frame for Log in / Create account: navy brand panel + form.
// The perks listed are real features of a Campus Customs account.
export default function AuthLayout({ title, letter, children }: Props) {
  return (
    <div className="container page">
      <div className="auth">
        <aside className="auth-aside">
          <span className="label on-dark">Campus Customs account</span>
          <h1>{title}</h1>
          <ul>
            <li>
              <span>01</span>Your shop-assistant chat is saved and waiting when you come back.
            </li>
            <li>
              <span>02</span>Recommendations addressed to you, by name.
            </li>
            <li>
              <span>03</span>Stays signed in on this device for 30 days.
            </li>
          </ul>
          <span className="big-letter" aria-hidden="true">
            {letter}
          </span>
        </aside>
        {children}
      </div>
    </div>
  )
}
