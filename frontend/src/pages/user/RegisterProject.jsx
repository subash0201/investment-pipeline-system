import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Banner, Card, Chip, DetailList, Field, Icon, PageHeader, ReadOnly, ResultCard } from '../../components/ui.jsx'
import { fmtDate, today } from '../../utils.js'

const MIN_DESCRIPTION = 30
const NEXT_STEPS = [
  ['Register project', 'Status changes  Draft → Registered'],
  ['Tag SDGs', 'Link the project to SDG goals'],
  ['Enter readiness score', 'Score value, date and remarks'],
  ['Request stage update', 'Admin approval may be required'],
]

function Wizard({ step }) {
  return (
    <ol className="wizard">
      {['Enter details', 'Confirm', 'Complete'].map((label, index) => (
        <li key={label} className={index + 1 < step ? 'done' : index + 1 === step ? 'on' : ''}>
          <span>{index + 1 < step ? <Icon name="check" size={13} /> : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  )
}

function validate(form, forDraft) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Project name is required.'
  if (!forDraft) {
    if (!form.description.trim()) errors.description = 'Description is required.'
    else if (form.description.trim().length < MIN_DESCRIPTION) {
      errors.description = `Description must be at least ${MIN_DESCRIPTION} characters.`
    }
  }
  return errors
}

// Screens 211 (details), 212 (confirm), 213 (complete) and 214 (validation errors).
export default function RegisterProject() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draftId = params.get('draft')

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', description: '' })
  const [date, setDate] = useState(today())
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)

  // "Continue" on a draft in My Projects reopens it here.
  useEffect(() => {
    if (!draftId) return
    api.get(`/projects/${draftId}/`).then(
      (project) => {
        if (project.stage !== 'DRAFT') return navigate(`/projects/${project.id}`, { replace: true })
        setForm({ name: project.name, description: project.description })
        setDate(project.registration_date)
      },
      (error) => setFailure(error.message),
    )
  }, [draftId, navigate])

  const set = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value })
    if (errors[key]) setErrors({ ...errors, [key]: undefined })
  }
  const errorCount = Object.values(errors).filter(Boolean).length

  const save = (submit) => {
    const body = { name: form.name.trim(), description: form.description.trim(), submit }
    return draftId ? api.patch(`/projects/${draftId}/`, body) : api.post('/projects/', body)
  }

  const fail = (error) => {
    // Server-side validation sends the user back to the form (214).
    const fields = { name: error.field?.('name'), description: error.field?.('description') }
    if (fields.name || fields.description) {
      setErrors(fields)
      setFailure('')
    } else {
      setFailure(error.message)
    }
    setStep(1)
    setBusy(false)
  }

  const toConfirm = (event) => {
    event.preventDefault()
    const found = validate(form, false)
    setErrors(found)
    setFailure('')
    if (Object.keys(found).length === 0) setStep(2)
  }

  const saveDraft = async () => {
    const found = validate(form, true)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const project = await save(false)
      navigate('/projects', { state: { flash: `${project.code} saved as a draft.` } })
    } catch (error) {
      fail(error)
    }
  }

  const confirm = async () => {
    setBusy(true)
    try {
      setSaved(await save(true))
      setStep(3)
      setBusy(false)
    } catch (error) {
      fail(error)
    }
  }

  if (step === 3) {
    return (
      <>
        <PageHeader crumb="Projects / Register" title="Registration Complete" />
        <Wizard step={4} />
        <ResultCard title="Project registered" text="Your project has been submitted and is now Registered."
          rows={[
            ['Project ID', saved.code],
            ['Project name', saved.name],
            ['Status', <Chip>{saved.stage_display}</Chip>],
            ['Registered on', fmtDate(saved.registration_date)],
          ]}>
          <Link className="btn" to={`/sdg?project=${saved.id}`}>Tag SDGs</Link>
          <Link className="btn" to={`/score?project=${saved.id}`}>Enter readiness score</Link>
          <Link className="btn btn-primary" to="/projects">Go to My Projects</Link>
        </ResultCard>
      </>
    )
  }

  if (step === 2) {
    return (
      <>
        <PageHeader crumb="Projects / Register" title="Confirm Registration" subtitle="Check the details below before saving." />
        <Wizard step={2} />
        <Card title="Review your registration" className="narrow">
          <DetailList rows={[
            ['Project name', form.name.trim()],
            ['Description', <span className="pre">{form.description.trim()}</span>],
            ['Registration date', fmtDate(date)],
            ['Initial stage', <Chip>Draft</Chip>],
            ['Status after submit', <Chip>Registered</Chip>],
            ['Submitted by', user.name],
          ]} />
          <div className="form-actions">
            <button className="btn" onClick={() => setStep(1)} disabled={busy}>Back to edit</button>
            <span className="grow" />
            <button className="btn btn-primary" onClick={confirm} disabled={busy}>
              {busy ? 'Registering…' : 'Confirm & register'}
            </button>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader crumb="Projects / Register" title="Register a Project"
        subtitle="Enter the basic project details to add it to the pipeline." />
      <Wizard step={1} />
      <div className="split">
        <form className="card card-body" onSubmit={toConfirm} noValidate>
          {errorCount > 0 && (
            <Banner kind="error">Please fix {errorCount} error{errorCount === 1 ? '' : 's'} before submitting.</Banner>
          )}
          <Banner kind="error">{failure}</Banner>
          <Field label="Project name" required error={errors.name}>
            <input className="input" maxLength={200} placeholder="e.g. Solar Micro-grid Expansion"
              value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Description" required error={errors.description}
            hint={`${form.description.trim().length} characters · at least ${MIN_DESCRIPTION} to register`}>
            <textarea className="input" rows={5} placeholder="Describe the project objectives, scope and expected impact…"
              value={form.description} onChange={set('description')} />
          </Field>
          <div className="row-2">
            <Field label="Registration date"><ReadOnly>{fmtDate(date)}</ReadOnly></Field>
            <Field label="Initial stage"><ReadOnly>Draft</ReadOnly></Field>
          </div>
          <div className="form-actions">
            <Link className="btn" to="/projects">Cancel</Link>
            <button type="button" className="btn" onClick={saveDraft} disabled={busy}>Save as draft</button>
            <span className="grow" />
            <button className="btn btn-primary" disabled={busy}>Submit registration</button>
          </div>
        </form>

        <Card title="What happens next">
          <ol className="next-steps">
            {NEXT_STEPS.map(([title, text], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div><strong>{title}</strong><small>{text}</small></div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  )
}
