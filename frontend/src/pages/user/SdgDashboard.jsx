import { Link } from 'react-router-dom'
import { Banner, Empty, ErrorState, Loading, PageHeader, ScoreBar, SdgChips } from '../../components/ui.jsx'
import { ago, useFetch, useFlash } from '../../utils.js'

// Screen 221 — SDG Tracking Dashboard.
export default function SdgDashboard() {
  const flash = useFlash()
  const { data, error, reload } = useFetch('/sdg-dashboard/')

  return (
    <>
      <PageHeader crumb="Projects / SDG Tracking" title="SDG Tracking Dashboard"
        subtitle="Tagged goals and indicator progress across your projects.">
        <Link className="btn btn-primary" to="/sdg">Tag SDGs</Link>
      </PageHeader>
      <Banner>{flash}</Banner>

      <section className="card">
        {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.length === 0 ? (
          <Empty>No projects yet. <Link to="/projects/register">Register a project</Link> to start tagging SDGs.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Project</th><th>SDG tags</th><th>Indicators</th><th>Progress</th><th>Updated</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="strong">{row.name}</td>
                  <td><SdgChips goals={row.sdgs} /></td>
                  <td className="muted">{row.indicator_count ? `${row.indicator_count} tracked` : '—'}</td>
                  <td><span className="score-cell"><ScoreBar value={row.progress} /> {row.progress}%</span></td>
                  <td className="muted">{row.updated_at ? ago(row.updated_at) : '—'}</td>
                  <td><Link to={`/sdg?project=${row.id}`}>{row.sdgs.length ? 'Edit' : 'Tag'}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
