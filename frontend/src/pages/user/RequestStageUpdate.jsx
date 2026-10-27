import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api.js'
import { Banner, Card, ErrorState, Field, Icon, Loading, PageHeader, ReadOnly } from '../../components/ui.jsx'
import { useFetch } from '../../utils.js'

// Screen 241 — Request Stage Update.
export default function RequestStageUpdate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const projectId = params.get('project')
  const { data: project, error } = useFetch(projectId ? `/projects/${projectId}/` : null)
  const [justification, setJustification] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)

  const back = `/pipeline?project=${projectId}`
  if (!projectId) return <Navigate to="/pipeline" replace />
  if (error) return <ErrorState error={error} />
  if (!project) return <Loading />

  const { next_stage, next_stage_display, requires_approval, checklist } = project.pipeline
  if (!next_stage) return <Navigate to={back} replace />
  const ready = checklist.every((item) => item.ok)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    try {
      const result = await api.post('/stage-requests/', {
        project: project.id, to_stage: next_stage, justification: justification.trim(),
      })
      if (result.requires_approval) navigate(`/pipeline/submitted/${result.request.id}`)
      else navigate(back, { state: { flash: `${project.code} moved to ${result.stage_display}.` } })
    } catch (problem) {
      setFailure(problem.field('checklist') || problem.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumb="Projects / Pipeline Stage / Request" title="Request Stage Update"
        subtitle={requires_approval ? 'Submit a stage change for approval.' : 'Move the project to its next stage.'} />
      <div className="split">
        <form className="card card-body" onSubmit={submit}>
          <Banner kind="info">
            {requires_approval
              ? 'This transition requires admin approval before it takes effect.'
              : 'This transition does not need approval and takes effect immediately.'}
          </Banner>
          <Banner kind="error">{failure}</Banner>
          <Field label="Project"><ReadOnly>{project.code} · {project.name}</ReadOnly></Field>
          <div className="row-2">
            <Field label="Current stage"><ReadOnly>{project.stage_display}</ReadOnly></Field>
            <Field label="Requested stage" required>
              <select className="input" value={next_stage} onChange={() => {}}>
                <option value={next_stage}>{next_stage_display}</option>
              </select>
            </Field>
          </div>
          <Field label="Justification">
            <textarea className="input" rows={4} placeholder="Explain why the project is ready to move on…"
              value={justification} onChange={(event) => setJustification(event.target.value)} />
          </Field>
          <div className="form-actions">
            <Link className="btn" to={back}>Cancel</Link>
            <span className="grow" />
            <button className="btn btn-primary" disabled={busy || !ready}>
              {busy ? 'Submitting…' : requires_approval ? 'Submit request' : 'Update stage'}
            </button>
          </div>
        </form>

        <Card title="Pre-request checklist">
          <ul className="checklist">
            {checklist.map((item) => (
              <li key={item.label} className={item.ok ? 'ok' : 'no'}>
                <span>{item.ok ? <Icon name="check" size={12} /> : '✕'}</span>
                {item.label}
              </li>
            ))}
          </ul>
          {!ready && (
            <p className="note">
              Complete the open items first: <Link to={`/sdg?project=${project.id}`}>tag SDGs</Link> or{' '}
              <Link to={`/score?project=${project.id}`}>enter a readiness score</Link>.
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
