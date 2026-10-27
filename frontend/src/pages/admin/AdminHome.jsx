import { Link } from 'react-router-dom'
import { Card, Empty, ErrorState, Kpi, Loading, PageHeader } from '../../components/ui.jsx'
import { ago, signed, useFetch } from '../../utils.js'

// Screen 300 — Admin Home.
export default function AdminHome() {
  const { data, error, reload } = useFetch('/dashboard/admin/')
  const header = <PageHeader crumb="Home" title="Admin Overview" subtitle="Approvals, registry and pipeline health at a glance." />
  if (error) return <>{header}<ErrorState error={error} retry={reload} /></>
  if (!data) return <>{header}<Loading /></>

  const { summary, pending_requests: pending, registry_activity: activity } = data
  return (
    <>
      {header}
      <div className="grid-4">
        <Kpi label="Pending approvals" value={summary.pending_approvals} icon="clock" noteTone="amber"
          note={summary.pending_older_than_3_days ? `${summary.pending_older_than_3_days} older than 3 days` : 'None older than 3 days'} />
        <Kpi label="Listed in registry" value={summary.registry.listed} icon="list" noteTone="green"
          note={summary.registry.listed_this_month ? `+${summary.registry.listed_this_month} this month` : "None listed this month"} />
        <Kpi label="Avg. readiness score" value={summary.avg_score ?? '—'} icon="gauge" noteTone="green"
          note={summary.avg_score_delta === null ? `Threshold ${summary.threshold}` : `${signed(summary.avg_score_delta)} vs last month`} />
        <Kpi label="Total projects" value={summary.total_projects} icon="folder" note={`${summary.under_review} under review`} />
      </div>

      <div className="split">
        <Card title="Pending stage transition requests" action={<Link to="/admin/approvals">View all</Link>} flush>
          {pending.length === 0 ? <Empty>No requests are waiting for a decision.</Empty> : (
            <table className="table">
              <thead><tr><th>Project</th><th>Transition</th><th>Requested</th><th /></tr></thead>
              <tbody>
                {pending.map((request) => (
                  <tr key={request.id}>
                    <td className="strong">{request.project_name}</td>
                    <td className="muted">{request.from_stage_display} → {request.to_stage_display}</td>
                    <td className="muted">{ago(request.created_at)}</td>
                    <td><Link className="btn btn-sm" to={`/admin/approvals/${request.id}`}>Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Recent registry activity">
          {activity.length === 0 ? <p className="muted">No registry activity yet.</p> : (
            <ul className="activity">
              {activity.map((item) => (
                <li key={item.id} className={`activity-${item.action}`}>
                  <span />
                  <div>
                    <strong>{item.entry_code} {item.action}</strong>
                    <small>{item.detail} · {ago(item.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Quick actions">
        <div className="quick">
          <Link className="btn btn-primary" to="/admin/summary">Generate summary dashboard</Link>
          <Link className="btn" to="/admin/registry">Manage registry</Link>
          <Link className="btn" to="/admin/approvals">Review pending requests</Link>
        </div>
      </Card>
    </>
  )
}
