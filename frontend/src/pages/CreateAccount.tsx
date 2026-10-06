import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import AuthLayout from '../components/AuthLayout'

export default function CreateAccount() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError("Passwords don't match")
      return
    }
    setError(null)
    setBusy(true)
    try {
      const { confirm: _confirm, ...data } = form
      await signup(data)
      navigate('/products')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      letter="C"
      title={
        <>
          Join <em>Campus Customs.</em>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <div>
          <span className="label">Create account</span>
          <h2>Make it yours</h2>
        </div>
        <div className="field-row">
          <label className="field">
            <span>First name</span>
            <input required autoComplete="given-name" value={form.first_name} onChange={update('first_name')} />
          </label>
          <label className="field">
            <span>Last name</span>
            <input required autoComplete="family-name" value={form.last_name} onChange={update('last_name')} />
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={form.email} onChange={update('email')} />
        </label>
        <label className="field">
          <span>Password (8+ characters)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.confirm}
            onChange={update('confirm')}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'} <span className="arrow">→</span>
        </button>
        {error && <p className="notice error">{error}</p>}
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
