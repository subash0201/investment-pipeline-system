import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { canReturnTo, homeFor, useAuth } from '../../auth.jsx'
import { Banner, Field, Loading } from '../../components/ui.jsx'
import { useReference } from '../../network.js'
import { ActorPicker, CollectionPicker, SdgPicker } from './ProfileFields.jsx'

const first = (value) => (Array.isArray(value) ? value[0] : value)

// Public sign-up ("Join"). Everyone who joins gets an ordinary User account.
export default function Join() {
  const { user, register } = useAuth()
  const reference = useReference()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({
    actor_type: '', first_name: '', last_name: '', organization: '', headline: '', location: '',
    email: '', password: '', sdg_interests: [], followed_collections: [],
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />
  if (!reference) return <Loading />
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const created = await register(form)
      const wanted = location.state?.from
      navigate(canReturnTo(created, wanted) ? wanted : '/recommended', { replace: true })
    } catch (failure) {
      setErrors({ ...failure.data, detail: failure.data.detail || (Object.keys(failure.data).length ? 'Please fix the highlighted fields.' : failure.message) })
      setBusy(false)
    }
  }

  return (
    <div className="login join">
      <Link to="/" className="brand-mark brand-mark-lg" aria-label="Home">I</Link>
      <h1>Join the investment network</h1>
      <p className="subtitle">Connect with investors, startups, platform companies, entrepreneurs, associations, business houses,
        investment firms and experts across Nepal&apos;s Digital/AI economy.</p>

      <form className="card login-card join-card" onSubmit={submit} noValidate>
        <Banner kind="error">{errors.detail}</Banner>
        <ActorPicker reference={reference} value={form.actor_type} onChange={(actor_type) => setForm({ ...form, actor_type })}
          error={first(errors.actor_type)} />
        <div className="row-2">
          <Field label="First name" required error={first(errors.first_name)}>
            <input className="input" autoComplete="given-name" value={form.first_name} onChange={set('first_name')} />
          </Field>
          <Field label="Last name" error={first(errors.last_name)}>
            <input className="input" autoComplete="family-name" value={form.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <Field label="Organization / company" error={first(errors.organization)}>
          <input className="input" autoComplete="organization" value={form.organization} onChange={set('organization')} />
        </Field>
        <div className="row-2">
          <Field label="Headline" error={first(errors.headline)}>
            <input className="input" placeholder="e.g. Seed investor in AgriTech" value={form.headline} onChange={set('headline')} />
          </Field>
          <Field label="Location" error={first(errors.location)}>
            <input className="input" placeholder="City, Province" value={form.location} onChange={set('location')} />
          </Field>
        </div>
        <div className="row-2">
          <Field label="Email" required error={first(errors.email)}>
            <input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Password" required error={first(errors.password)} hint="At least 8 characters, not too common.">
            <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
        </div>
        <SdgPicker value={form.sdg_interests} onChange={(sdg_interests) => setForm({ ...form, sdg_interests })} />
        <CollectionPicker reference={reference} value={form.followed_collections}
          onChange={(followed_collections) => setForm({ ...form, followed_collections })} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="login-foot">Already a member? <Link to="/login" state={location.state}>Log in</Link></p>
    </div>
  )
}
