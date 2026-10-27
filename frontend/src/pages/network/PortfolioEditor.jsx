import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Banner, Card, ErrorState, Field, Loading, PageHeader } from '../../components/ui.jsx'
import { nrs, useReference } from '../../network.js'
import { useFetch } from '../../utils.js'

const MONEY = [
  ['total_investment', 'Total investment'],
  ['conventional_investment', 'Conventional investment'],
  ['digital_investment', 'Digital investment'],
  ['ai_investment', 'AI investment'],
]
const PLAIN = ['category', 'sector', 'reference', 'costing_period', 'currency']
const first = (value) => (Array.isArray(value) ? value[0] : typeof value === 'object' && value ? Object.values(value)[0] : value)

// Owners (and admins) keep the portfolio profile up to date at any stage:
// collection, category, costing and the written sections shown on the public page.
export default function PortfolioEditor() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const reference = useReference()
  const { data: project, error } = useFetch(`/projects/${id}/`)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!project) return
    setForm({
      collection: project.collection, primary_sdg: project.primary_sdg ?? '',
      ...Object.fromEntries(PLAIN.map((key) => [key, project[key] || ''])),
      ...Object.fromEntries(MONEY.map(([key]) => [key, project[key] ?? ''])),
      details: { ...(project.details || {}) },
    })
  }, [project])

  if (error) return <ErrorState error={error} />
  if (!form || !reference) return <Loading />
  if (!project.can_manage) return <ErrorState error={{ message: 'Only the owner or an administrator can edit this portfolio.' }} />

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const setSection = (key) => (event) => setForm({ ...form, details: { ...form.details, [key]: event.target.value } })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    const body = {
      ...Object.fromEntries(PLAIN.map((key) => [key, form[key].trim()])),
      currency: form.currency.trim() || 'NPR',
      primary_sdg: form.primary_sdg === '' ? null : Number(form.primary_sdg),
      ...Object.fromEntries(MONEY.map(([key]) => [key, form[key] === '' ? null : form[key]])),
      details: form.details,
    }
    if (user.role === 'ADMIN') body.collection = form.collection
    try {
      await api.patch(`/projects/${id}/`, body)
      navigate(`/portfolios/${id}`)
    } catch (failure) {
      setErrors({ ...failure.data, detail: failure.data.detail || 'Please fix the highlighted fields.' })
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumb={<><Link to={`/portfolios/${id}`}>Portfolio</Link> / Edit</>} title={`Edit portfolio · ${project.name}`}
        subtitle="These details appear on the public portfolio page. Name and description can only change while the project is a draft." />
      <Banner kind="error">{errors.detail}</Banner>
      <form onSubmit={submit} noValidate className="stack-lg">
        <Card title="Classification">
          <div className="row-2">
            <Field label="Collection" hint={user.role === 'ADMIN' ? '' : 'Catalogue collections are set by administrators.'} error={first(errors.collection)}>
              <select className="input" value={form.collection} onChange={set('collection')} disabled={user.role !== 'ADMIN'}>
                {reference.collections.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Primary SDG" error={first(errors.primary_sdg)}>
              <select className="input" value={form.primary_sdg} onChange={set('primary_sdg')}>
                <option value="">—</option>
                {reference.sdg_goals.map((g) => <option key={g.number} value={g.number}>SDG {g.number} — {g.name}</option>)}
              </select>
            </Field>
            <Field label="Category" error={first(errors.category)}><input className="input" placeholder="e.g. Agriculture and Food" value={form.category} onChange={set('category')} /></Field>
            <Field label="Sector" error={first(errors.sector)}><input className="input" placeholder="e.g. Agriculture, Food Security and Nutrition" value={form.sector} onChange={set('sector')} /></Field>
            <Field label="Reference / catalogue ID" error={first(errors.reference)}><input className="input" placeholder="e.g. 2_SDG2_INT_005" value={form.reference} onChange={set('reference')} /></Field>
          </div>
          <p className="note">Secondary SDGs and indicators are managed on the <Link to={`/sdg?project=${id}`}>SDG Tracking</Link> screen.</p>
        </Card>

        <Card title="Annual average costing">
          <div className="row-2">
            <Field label="Period" error={first(errors.costing_period)}><input className="input" placeholder="2026-2030" value={form.costing_period} onChange={set('costing_period')} /></Field>
            <Field label="Currency" error={first(errors.currency)}><input className="input" value={form.currency} onChange={set('currency')} /></Field>
            {MONEY.map(([key, label]) => (
              <Field key={key} label={`${label} (whole amount)`} error={first(errors[key])} hint={form[key] ? nrs(form[key]) : ''}>
                <input className="input" type="number" min="0" step="any" value={form[key]} onChange={set(key)} />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Portfolio sections">
          {first(errors.details) && <Banner kind="error">{first(errors.details)}</Banner>}
          <div className="stack">
            {reference.sections.map((s) => (
              <Field key={s.key} label={s.label}>
                <textarea className="input" rows={form.details[s.key] ? 4 : 2} value={form.details[s.key] || ''} onChange={setSection(s.key)} />
              </Field>
            ))}
          </div>
        </Card>

        <div className="form-actions end">
          <Link className="btn" to={`/portfolios/${id}`}>Cancel</Link>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save portfolio'}</button>
        </div>
      </form>
    </>
  )
}
