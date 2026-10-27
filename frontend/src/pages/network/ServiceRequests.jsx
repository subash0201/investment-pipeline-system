import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, query } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Banner, Card, Chip, Empty, ErrorState, Field, Loading, PageHeader, Pagination } from '../../components/ui.jsx'
import { useReference } from '../../network.js'
import { fmtDate, useFetch } from '../../utils.js'

const STATUS_TONE = { OPEN: 'amber', IN_PROGRESS: 'blue', CLOSED: 'green' }

function RequestForm({ onCreated }) {
  const reference = useReference()
  const [params] = useSearchParams()
  const communities = useFetch('/communities/?pillar=investment').data || []
  const projectId = params.get('project')
  const project = useFetch(projectId ? `/portfolios/${projectId}/` : null).data
  const [form, setForm] = useState({ service: '', message: '', community: params.get('community') || '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const created = await api.post('/service-requests/', {
        ...form, community: form.community || null, project: projectId ? Number(projectId) : null,
      })
      setForm({ service: '', message: '', community: '' })
      onCreated(created)
    } catch (failure) {
      setErrors({ ...failure.data, detail: failure.data.detail || (failure.status ? '' : failure.message) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Request an investment service">
      <form className="stack" onSubmit={submit} noValidate>
        <Banner kind="error">{errors.detail}</Banner>
        {project && <Banner kind="info">About portfolio: <Link to={`/portfolios/${project.id}`}>{project.name}</Link></Banner>}
        <div className="row-2">
          <Field label="Service" required error={errors.service?.[0] && 'Choose a service.'}>
            <select className="input" value={form.service} onChange={set('service')}>
              <option value="">Choose a service</option>
              {reference?.services.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Community (optional)">
            <select className="input" value={form.community} onChange={set('community')}>
              <option value="">—</option>
              {communities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="What do you need?" required error={errors.message?.[0]}>
          <textarea className="input" rows={4} value={form.message} onChange={set('message')}
            placeholder="e.g. Technical due diligence before a co-investment of NRs 50 crore" />
        </Field>
        <div className="form-actions end"><button className="btn btn-primary" disabled={busy}>Send request</button></div>
      </form>
    </Card>
  )
}

function AdminRow({ request, onSaved }) {
  const [status, setStatus] = useState(request.status)
  const [notes, setNotes] = useState(request.admin_notes)
  const [busy, setBusy] = useState(false)
  const dirty = status !== request.status || notes !== request.admin_notes
  const save = async () => {
    setBusy(true)
    try {
      onSaved(await api.patch(`/service-requests/${request.id}/`, { status, admin_notes: notes }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <tr>
      <td className="strong nowrap">{request.code}<br /><small className="muted">{fmtDate(request.created_at)}</small></td>
      <td>{request.service_display}<br /><small className="muted">{request.community_name || ''}</small></td>
      <td>{request.requester_name}<br /><small className="muted">{request.requester_email}</small></td>
      <td className="cell-wide">
        <p className="pre">{request.message}</p>
        {request.project && <Link to={`/portfolios/${request.project}`}>{request.project_name}</Link>}
      </td>
      <td>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="CLOSED">Closed</option>
        </select>
        <textarea className="input notes" rows={2} placeholder="Notes for the team" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {dirty && <button className="btn btn-sm" onClick={save} disabled={busy}>Save</button>}
      </td>
    </tr>
  )
}

// Access to Investment Services: members send requests; administrators work the queue.
export default function ServiceRequests() {
  const { user } = useAuth()
  const admin = user.role === 'ADMIN'
  const [filters, setFilters] = useState({ status: '', page: 1 })
  const [flash, setFlash] = useState('')
  const { data, error, reload } = useFetch(`/service-requests/${query(filters)}`)
  const counts = useFetch('/service-requests/counts/')

  const refresh = () => {
    reload()
    counts.reload()
  }

  return (
    <>
      <PageHeader crumb="Investment network / Investment services" title={admin ? 'Service request queue' : 'Investment services'}
        subtitle="Deal rooms, co-investment, blended finance, due diligence and advisory." />
      <Banner>{flash}</Banner>
      {!admin && <RequestForm onCreated={(r) => { setFlash(`Request ${r.code} sent. The team will get back to you.`); refresh() }} />}

      <Card title={admin ? 'All requests' : 'My requests'} action={(
        <div className="tabs-mini">
          {[['', 'All'], ['OPEN', 'Open'], ['IN_PROGRESS', 'In progress'], ['CLOSED', 'Closed']].map(([key, label]) => (
            <button key={key} className={filters.status === key ? 'on' : ''} onClick={() => setFilters({ status: key, page: 1 })}>
              {label}{key && counts.data ? ` (${counts.data[key.toLowerCase()]})` : ''}
            </button>
          ))}
        </div>
      )} flush>
        {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.count === 0 ? (
          <Empty>No requests here.</Empty>
        ) : admin ? (
          <table className="table">
            <thead><tr><th>Request</th><th>Service</th><th>Member</th><th>Details</th><th>Status</th></tr></thead>
            <tbody>{data.results.map((r) => <AdminRow key={`${r.id}-${r.updated_at}`} request={r} onSaved={refresh} />)}</tbody>
          </table>
        ) : (
          <table className="table">
            <thead><tr><th>Request</th><th>Service</th><th>Details</th><th>Status</th></tr></thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.id}>
                  <td className="strong nowrap">{r.code}<br /><small className="muted">{fmtDate(r.created_at)}</small></td>
                  <td>{r.service_display}</td>
                  <td className="cell-wide"><p className="pre">{r.message}</p>
                    {r.admin_notes && <p className="quote">Team: {r.admin_notes}</p>}</td>
                  <td><Chip color={STATUS_TONE[r.status]}>{r.status_display}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.count > 10 && (
          <div className="pad"><Pagination page={filters.page} pageSize={10} count={data.count} noun="requests"
            onPage={(page) => setFilters({ ...filters, page })} /></div>
        )}
      </Card>
    </>
  )
}
