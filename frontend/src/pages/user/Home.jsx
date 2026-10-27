import { Link } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'
import { Card, Chip, Empty, ErrorState, Kpi, Loading, PageHeader, ScoreBar } from '../../components/ui.jsx'
import { ago, useFetch } from '../../utils.js'

// Screen 200 — User Home.
export default function Home() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useFetch('/dashboard/user/')

  const header = (
    <PageHeader crumb="Home" title={`Welcome back, ${user.first_name || user.name}`}
      subtitle="Here is where your projects stand in the investment pipeline." />
  )
  if (loading && !data) return <>{header}<Loading /></>
  if (error) return <>{header}<ErrorState error={error} retry={reload} /></>

  const { kpis, pipeline, recent } = data
  const most = Math.max(1, ...pipeline.map((row) => row.count))

  return (
    <>
      {header}
      <div className="grid-4">
        <Kpi label="My projects" value={kpis.my_projects} icon="folder" noteTone={kpis.new_this_month ? 'green' : 'muted'}
          note={kpis.new_this_month ? `+${kpis.new_this_month} this month` : 'None added this month'} />
        <Kpi label="Under review" value={kpis.under_review} icon="search" note="SDG tagged, score entered" />
        <Kpi label="Pending approval" value={kpis.pending_approval} icon="clock" noteTone="amber" note="Awaiting admin decision" />
        <Kpi label="Investment ready" value={kpis.investment_ready} icon="star" noteTone="green" note="Eligible for registry" />
      </div>

      <div className="split">
        <Card title="Pipeline overview" action={<Link to="/pipeline">View all</Link>}>
          <div className="hbars">
            {pipeline.map((row) => (
              <div className="hbar" key={row.stage}>
                <span>{row.label}</span>
                <div className="bar bar-lg">
                  <div className="bar-fill bar-blue" style={{ width: `${(100 * row.count) / most}%` }} />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick actions">
          <div className="stack">
            <Link className="btn btn-primary" to="/projects/register">Register a new project</Link>
            <Link className="btn" to="/sdg">Tag SDGs</Link>
            <Link className="btn" to="/score">Enter readiness score</Link>
            <Link className="btn" to="/pipeline">Request stage update</Link>
            <Link className="btn" to="/browse">Browse investment-ready projects</Link>
          </div>
        </Card>
      </div>

      <Card title="Recent projects" action={<Link to="/projects">View all</Link>} flush>
        {recent.length === 0 ? (
          <Empty>You have no projects yet. <Link to="/projects/register">Register your first project</Link>.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Project</th><th>Stage</th><th>Status</th><th>Readiness score</th><th>Last updated</th></tr>
            </thead>
            <tbody>
              {recent.map((project) => (
                <tr key={project.id}>
                  <td><Link className="strong" to={`/projects/${project.id}`}>{project.name}</Link></td>
                  <td><Chip>{project.stage_display}</Chip></td>
                  <td><Chip>{project.status}</Chip></td>
                  <td>
                    {project.score === null ? '—' : (
                      <span className="score-cell"><ScoreBar value={project.score} /> {project.score}%</span>
                    )}
                  </td>
                  <td className="muted">{ago(project.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
