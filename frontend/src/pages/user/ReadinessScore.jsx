import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api.js'
import { Banner, Card, Chip, Field, PageHeader, ProjectSelect } from '../../components/ui.jsx'
import { fmtDate, THRESHOLD, today, useFetch } from '../../utils.js'

// Screen 230 — Readiness Score Entry.
export default function ReadinessScore() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const projectId = params.get('project') || ''
  const history = useFetch(projectId ? `/projects/${projectId}/scores/` : null)

  const [form, setForm] = useState({ evaluation_date: today(), score: '', remarks: '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    const found = {}
    const score = Number(form.score)
    if (!projectId) found.project = 'Select a project.'
    if (!form.evaluation_date) found.evaluation_date = 'Evaluation date is required.'
    else if (form.evaluation_date > today()) found.evaluation_date = 'Evaluation date cannot be in the future.'
    if (form.score === '') found.score = 'Score is required.'
    else if (!Number.isInteger(score) || score < 0 || score > 100) found.score = 'Enter a whole number from 0 to 100.'
    setErrors(found)
    setFailure('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await api.post(`/projects/${projectId}/scores/`, { ...form, score, remarks: form.remarks.trim() })
      navigate(`/score/saved?project=${projectId}`)
    } catch (error) {
      setErrors({ evaluation_date: error.field('evaluation_date'), score: error.field('score') })
      if (!error.field('evaluation_date') && !error.field('score')) setFailure(error.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumb="Projects / Readiness Score" title="Investment Readiness Score"
        subtitle="Record an evaluation for a project." />
      <div className="split">
        <form className="card card-body" onSubmit={submit} noValidate>
          <Banner kind="error">{failure}</Banner>
          <Field label="Project" required error={errors.project}>
            <ProjectSelect value={projectId} filter={(project) => project.stage !== 'DRAFT'}
              onChange={(id) => setParams(id ? { project: id } : {})} />
          </Field>
          <div className="row-2">
            <Field label="Evaluation date" required error={errors.evaluation_date}>
              <input className="input" type="date" max={today()} value={form.evaluation_date} onChange={set('evaluation_date')} />
            </Field>
            <Field label="Score value (0–100)" required error={errors.score}>
              <input className="input" type="number" min="0" max="100" step="1" inputMode="numeric"
                value={form.score} onChange={set('score')} />
            </Field>
          </div>
          <Field label="Score slider">
            <div className="slider">
              <input type="range" min="0" max="100" step="1" value={form.score === '' ? 0 : form.score}
                onChange={set('score')} style={{ '--fill': `${Math.min(Number(form.score) || 0, 100)}%` }} />
              <span className="slider-mark" style={{ left: `${THRESHOLD}%` }}>Threshold {THRESHOLD}</span>
            </div>
          </Field>
          <Field label="Remarks">
            <textarea className="input" rows={4} placeholder="Strengths, gaps and anything outstanding…"
              value={form.remarks} onChange={set('remarks')} />
          </Field>
          <div className="form-actions">
            <Link className="btn" to="/projects">Cancel</Link>
            <span className="grow" />
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save score'}</button>
          </div>
        </form>

        <div className="stack-lg">
          <Card title="Scoring guide">
            <div className="guide">
              <span>0 – 49</span><Chip>Not ready</Chip>
              <span>50 – {THRESHOLD - 1}</span><Chip>Developing</Chip>
              <span>{THRESHOLD} – 100</span><Chip>Investment ready</Chip>
            </div>
            <p className="note">Scores ≥ {THRESHOLD} allow the project to reach Investment Ready.</p>
          </Card>
          <Card title="Previous scores" flush>
            {!projectId ? <p className="muted pad">Select a project to see its scores.</p>
              : !history.data ? <p className="muted pad">Loading…</p>
              : history.data.length === 0 ? <p className="muted pad">No scores recorded yet.</p> : (
                <table className="table">
                  <thead><tr><th>Date</th><th>Score</th><th>By</th></tr></thead>
                  <tbody>
                    {history.data.map((row) => (
                      <tr key={row.id}>
                        <td className="muted">{fmtDate(row.evaluation_date)}</td>
                        <td className="strong">{row.score}</td>
                        <td className="muted">{row.evaluated_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </Card>
        </div>
      </div>
    </>
  )
}
