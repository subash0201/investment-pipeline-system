import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api.js'
import { Banner, Card, ErrorState, Field, Loading, PageHeader, ReadOnly, SdgChips } from '../../components/ui.jsx'
import { today, useFetch } from '../../utils.js'

// Screens 321 (Add Registry Entry) and 322 (Edit Registry Entry).
export default function RegistryForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const entry = useFetch(editing ? `/registry/${id}/` : null)
  const eligible = useFetch(editing ? null : '/registry/eligible/')

  const [form, setForm] = useState({ project: '', listed_date: today(), investment_amount: '', status: 'LISTED' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!entry.data) return
    const { project, listed_date, investment_amount, status } = entry.data
    setForm({ project, listed_date, investment_amount: String(Number(investment_amount)), status })
  }, [entry.data])

  if (entry.error) return <ErrorState error={entry.error} />
  if (editing && !entry.data) return <Loading />

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const preview = editing
    ? entry.data.project_preview
    : (eligible.data || []).find((project) => String(project.id) === String(form.project))

  const submit = async (event) => {
    event.preventDefault()
    const found = {}
    if (!form.project) found.project = 'Select a project.'
    if (!form.listed_date) found.listed_date = 'Listed date is required.'
    if (form.investment_amount === '') found.investment_amount = 'Investment amount is required.'
    else if (!(Number(form.investment_amount) > 0)) found.investment_amount = 'Investment amount must be greater than 0.'
    setErrors(found)
    setFailure('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      const body = { ...form, project: Number(form.project), investment_amount: Number(form.investment_amount) }
      const saved = editing ? await api.put(`/registry/${id}/`, body) : await api.post('/registry/', body)
      navigate('/admin/registry', {
        state: { flash: editing ? `${saved.code} was updated.` : `${saved.code} added: ${saved.project_name} is now listed.` },
      })
    } catch (problem) {
      const fields = Object.fromEntries(
        ['project', 'listed_date', 'investment_amount', 'status'].map((key) => [key, problem.field(key)]))
      setErrors(fields)
      if (!Object.values(fields).some(Boolean)) setFailure(problem.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumb={`Registry / ${editing ? 'Edit entry' : 'Add entry'}`}
        title={editing ? 'Edit Registry Entry' : 'Add Registry Entry'}
        subtitle={editing ? 'Update the listing details.' : 'List an investment-ready project in the registry.'} />
      <div className="split">
        <form className="card card-body" onSubmit={submit} noValidate>
          <Banner kind="error">{failure}</Banner>
          {editing && <Field label="Registry ID"><ReadOnly>{entry.data.code}</ReadOnly></Field>}
          <Field label="Project" required error={errors.project}
            hint={!editing && eligible.data?.length === 0 ? 'No Investment Ready projects are waiting to be listed.' : ''}>
            {editing ? <ReadOnly>{entry.data.project_name}</ReadOnly> : (
              <select className="input" value={form.project} onChange={set('project')}>
                <option value="">{eligible.data ? 'Select an investment-ready project' : 'Loading…'}</option>
                {(eligible.data || []).map((project) => (
                  <option key={project.id} value={project.id}>{project.code} · {project.name}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="row-2">
            <Field label="Listed date" required error={errors.listed_date}>
              <input className="input" type="date" value={form.listed_date} onChange={set('listed_date')} />
            </Field>
            <Field label="Investment amount (NRs)" required error={errors.investment_amount}>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.investment_amount} onChange={set('investment_amount')} />
            </Field>
          </div>
          <Field label="Status" error={errors.status} className="half">
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="LISTED">Listed</option>
              <option value="FUNDED">Funded</option>
              <option value="DELISTED">Delisted</option>
            </select>
          </Field>
          <div className="form-actions">
            <Link className="btn" to="/admin/registry">Cancel</Link>
            <span className="grow" />
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add entry'}
            </button>
          </div>
        </form>

        <Card title="Project preview">
          <div className="project-art" aria-hidden="true">{preview?.code || ''}</div>
          {preview ? (
            <>
              <h3 className="preview-name">{preview.name}</h3>
              <SdgChips goals={preview.sdgs} />
              <p className="note">Readiness {preview.score ?? '—'} / 100 · {preview.stage_display}</p>
            </>
          ) : (
            <>
              <h3 className="preview-name muted">Select a project…</h3>
              <p className="note">Only Investment Ready projects can be listed.</p>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
