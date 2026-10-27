import { useState } from 'react'
import { useAuth } from '../../auth.jsx'
import { Banner, Card, Field, Loading, PageHeader, ReadOnly } from '../../components/ui.jsx'
import { useReference } from '../../network.js'
import { ActorPicker, CollectionPicker, SdgPicker } from './ProfileFields.jsx'

const first = (value) => (Array.isArray(value) ? value[0] : value)

// Edit your own network profile. Email and role are managed by administrators.
export default function Profile() {
  const { user, updateProfile } = useAuth()
  const reference = useReference()
  const [form, setForm] = useState(() => ({
    first_name: user.first_name, last_name: user.last_name, actor_type: user.actor_type || '',
    organization: user.organization || '', headline: user.headline || '', location: user.location || '',
    sdg_interests: user.sdg_interests || [], followed_collections: user.followed_collections || [],
  }))
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  if (!reference) return <Loading />
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setSaved('')
    try {
      await updateProfile(form)
      setSaved('Profile saved. Your recommendations now use these settings.')
    } catch (failure) {
      setErrors({ ...failure.data, detail: failure.data.detail || 'Please fix the highlighted fields.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumb="Account" title="Edit profile" subtitle="How you appear in the members directory, and what we recommend to you." />
      <Banner>{saved}</Banner>
      <Banner kind="error">{errors.detail}</Banner>
      <Card className="narrow">
        <form className="stack" onSubmit={submit} noValidate>
          <div className="row-2">
            <Field label="Email"><ReadOnly>{user.email}</ReadOnly></Field>
            <Field label="Role"><ReadOnly>{user.role === 'ADMIN' ? 'Admin' : 'User'}</ReadOnly></Field>
          </div>
          <div className="row-2">
            <Field label="First name" error={first(errors.first_name)}><input className="input" value={form.first_name} onChange={set('first_name')} /></Field>
            <Field label="Last name" error={first(errors.last_name)}><input className="input" value={form.last_name} onChange={set('last_name')} /></Field>
          </div>
          <ActorPicker reference={reference} value={form.actor_type} onChange={(actor_type) => setForm({ ...form, actor_type })}
            error={first(errors.actor_type)} />
          <Field label="Organization / company"><input className="input" value={form.organization} onChange={set('organization')} /></Field>
          <div className="row-2">
            <Field label="Headline"><input className="input" value={form.headline} onChange={set('headline')} /></Field>
            <Field label="Location"><input className="input" value={form.location} onChange={set('location')} /></Field>
          </div>
          <SdgPicker value={form.sdg_interests} onChange={(sdg_interests) => setForm({ ...form, sdg_interests })} />
          <CollectionPicker reference={reference} value={form.followed_collections}
            onChange={(followed_collections) => setForm({ ...form, followed_collections })} />
          <div className="form-actions end"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      </Card>
    </>
  )
}
