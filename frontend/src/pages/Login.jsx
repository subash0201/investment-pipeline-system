import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { canReturnTo, homeFor, useAuth } from '../auth.jsx'
import { Banner, Field } from '../components/ui.jsx'

// Screens 100 (Login) and 101 (Login Error).
export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [error, setError] = useState('')
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      const signedIn = await login(form.email.trim(), form.password, form.remember)
      // Role-based redirect: users to 200, admins to 300 (or back to the page they asked for).
      const wanted = location.state?.from
      navigate(canReturnTo(signedIn, wanted) ? wanted : homeFor(signedIn), { replace: true })
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <Link to="/" className="brand-mark brand-mark-lg" aria-label="Home">I</Link>
      <h1>Investment Pipeline Tracker</h1>
      <p className="subtitle">Sign in to manage and track investment-ready projects</p>

      <form className="card login-card" onSubmit={submit} noValidate>
        <h2>Sign in</h2>
        <Banner kind="error">{error}</Banner>
        <Field label="Email" required error={error ? ' ' : ''}>
          <input className="input" type="email" autoComplete="username" placeholder="name@company.com"
            value={form.email} onChange={set('email')} autoFocus />
        </Field>
        <Field label="Password" required error={error ? ' ' : ''}>
          <input className="input" type="password" autoComplete="current-password" placeholder="Enter your password"
            value={form.password} onChange={set('password')} />
        </Field>
        <div className="login-row">
          <label className="check">
            <input type="checkbox" checked={form.remember} onChange={set('remember')} /> Remember me
          </label>
          <button type="button" className="link" onClick={() => setHelp(!help)}>Forgot password?</button>
        </div>
        {help && <p className="field-hint">Passwords are reset by your system administrator. Ask them for a new one.</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <p className="login-foot">
        New to the network? <Link to="/join" state={location.state}>Create a free account</Link>
        <span className="sep">·</span>
        <Link to="/">Browse without signing in</Link>
      </p>
    </div>
  )
}
