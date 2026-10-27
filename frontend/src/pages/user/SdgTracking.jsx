import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api.js'
import { Banner, Card, Field, Icon, PageHeader, ProjectSelect } from '../../components/ui.jsx'
import { useFetch } from '../../utils.js'

const blank = () => ({ name: '', target_value: '', current_value: '', notes: '' })
const isBlank = (row) => !row.name.trim() && row.target_value === '' && row.current_value === '' && !row.notes.trim()

// Screen 220 — SDG Tracking: tag goals and record their indicators.
export default function SdgTracking() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const projectId = params.get('project') || ''
  const goals = useFetch('/sdg-goals/').data || []

  const [selected, setSelected] = useState({}) // goal number -> indicator rows
  const [active, setActive] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSelected({})
    setActive(null)
    setError('')
    setLoaded(false)
    if (!projectId) return undefined
    let live = true
    api.get(`/projects/${projectId}/sdgs/`).then(
      (data) => {
        if (!live) return
        const next = {}
        data.goals.forEach((tag) => {
          next[tag.goal] = tag.indicators.map((row) => ({
            name: row.name, notes: row.notes,
            target_value: String(Number(row.target_value)), current_value: String(Number(row.current_value)),
          }))
        })
        setSelected(next)
        setActive(data.goals[0]?.goal ?? null)
        setLoaded(true)
      },
      (failure) => live && setError(failure.message),
    )
    return () => {
      live = false
    }
  }, [projectId])

  const numbers = Object.keys(selected).map(Number).sort((a, b) => a - b)
  const goal = goals.find((item) => item.number === active)
  const rows = active && selected[active] ? selected[active] : []

  const toggle = (number) => {
    const next = { ...selected }
    if (next[number]) {
      delete next[number]
      setActive(active === number ? Number(Object.keys(next)[0]) || null : active)
    } else {
      next[number] = [blank()]
      setActive(number)
    }
    setSelected(next)
  }

  const setRows = (updated) => setSelected({ ...selected, [active]: updated })
  const edit = (index, key) => (event) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, [key]: event.target.value } : row)))

  const save = async () => {
    // Untouched indicator rows are ignored; started ones must be complete.
    for (const number of numbers) {
      const bad = selected[number].find((row) => !isBlank(row) && (!row.name.trim() || !(Number(row.target_value) > 0)))
      if (bad) {
        setActive(number)
        setError(`SDG ${number}: each indicator needs a name and a target value greater than 0.`)
        return
      }
    }
    setBusy(true)
    setError('')
    try {
      await api.put(`/projects/${projectId}/sdgs/`, {
        goals: numbers.map((number) => ({
          goal: number,
          indicators: selected[number].filter((row) => !isBlank(row)).map((row) => ({
            name: row.name.trim(), notes: row.notes.trim(),
            target_value: Number(row.target_value), current_value: Number(row.current_value || 0),
          })),
        })),
      })
      const project = await api.get(`/projects/${projectId}/`)
      navigate('/sdg/dashboard', { state: { flash: `SDG tags and indicators saved for ${project.code}.` } })
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader crumb="Projects / SDG Tracking" title="SDG Tracking"
        subtitle="Tag the SDGs this project contributes to and track their indicators.">
        <Link className="btn" to="/sdg/dashboard">View SDG dashboard</Link>
      </PageHeader>

      <Field label="Project" required className="project-picker">
        <ProjectSelect value={projectId} onChange={(id) => setParams(id ? { project: id } : {})} />
      </Field>
      <Banner kind="error">{error}</Banner>

      {projectId && loaded && (
        <>
          <div className="split">
            <Card title={`Select SDG goals (${numbers.length} selected)`}
              action={numbers.length > 0 && (
                <button className="link" onClick={() => { setSelected({}); setActive(null) }}>Clear all</button>
              )}>
              <div className="sdg-grid">
                {goals.map((item) => (
                  <button key={item.number} type="button" aria-pressed={Boolean(selected[item.number])}
                    className={`sdg-tile ${selected[item.number] ? 'on' : ''} ${active === item.number ? 'focus' : ''}`}
                    onClick={() => toggle(item.number)} title={item.name}>
                    <strong>{item.number}</strong>
                    {selected[item.number] && <span className="sdg-check"><Icon name="check" size={11} /></span>}
                    <span>{item.short[0]}<br />{item.short[1]}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title={goal ? `Indicators · SDG ${goal.number} ${goal.name}` : 'Indicators'}>
              {!goal ? (
                <p className="muted">Select a goal to add its indicators.</p>
              ) : (
                <>
                  {numbers.length > 1 && (
                    <div className="tabs-mini">
                      {numbers.map((number) => (
                        <button key={number} className={number === active ? 'on' : ''} onClick={() => setActive(number)}>
                          SDG {number}
                        </button>
                      ))}
                    </div>
                  )}
                  <datalist id="indicator-names">
                    {goal.indicators.map((name) => <option key={name} value={name} />)}
                  </datalist>
                  {rows.map((row, index) => (
                    <div className="indicator" key={index}>
                      <Field label={rows.length > 1 ? `Indicator ${index + 1}` : 'Indicator'}>
                        <input className="input" list="indicator-names" placeholder="Choose or type an indicator"
                          value={row.name} onChange={edit(index, 'name')} />
                      </Field>
                      <div className="row-2">
                        <Field label="Target value">
                          <input className="input" type="number" min="0" step="any" value={row.target_value}
                            onChange={edit(index, 'target_value')} />
                        </Field>
                        <Field label="Current value">
                          <input className="input" type="number" min="0" step="any" value={row.current_value}
                            onChange={edit(index, 'current_value')} />
                        </Field>
                      </div>
                      <Field label="Notes">
                        <textarea className="input" rows={2} placeholder="Baseline, source, reporting period…"
                          value={row.notes} onChange={edit(index, 'notes')} />
                      </Field>
                      {rows.length > 1 && (
                        <button className="link link-danger" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                          Remove indicator
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="link" onClick={() => setRows([...rows, blank()])}>+ Add indicator</button>
                </>
              )}
            </Card>
          </div>

          <div className="form-actions end">
            <Link className="btn" to="/sdg/dashboard">Cancel</Link>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save SDG tags'}</button>
          </div>
        </>
      )}
    </>
  )
}
