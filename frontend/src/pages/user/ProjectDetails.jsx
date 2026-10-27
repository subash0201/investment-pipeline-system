import { Link, useParams } from 'react-router-dom'
import { Card, Chip, DetailList, ErrorState, Icon, Loading, ScoreBar, SdgChips, PageHeader, Stepper } from '../../components/ui.jsx'
import { fmtDate, money, useFetch } from '../../utils.js'

// Screen 251 — Project Details. Also used for "View" on My Projects.
export default function ProjectDetails({ from }) {
  const { id } = useParams()
  const { data: project, error } = useFetch(`/projects/${id}/`)
  const browsing = from === 'browse'
  const back = browsing ? '/browse' : '/projects'

  if (error) return <ErrorState error={error} />
  if (!project) return <Loading />
  const { latest_score: latest, registry } = project
  const history = project.history.filter((row) => row.start_date)

  return (
    <>
      <PageHeader crumb={`${browsing ? 'Browse' : 'Projects'} / ${project.name}`} title={project.name}
        subtitle={`${project.code} · Registered ${fmtDate(project.registration_date)}`}>
        <Link className="btn" to={back}><Icon name="back" size={16} /> Back to list</Link>
        {project.can_manage && <Link className="btn" to={`/portfolios/${project.id}/edit`}><Icon name="edit" size={16} /> Edit portfolio profile</Link>}
        <Link className="btn btn-primary" to={`/portfolios/${project.id}`}>Public portfolio page</Link>
      </PageHeader>

      <div className="split split-wide">
        <section className="card">
          <div className="project-art project-art-lg" aria-hidden="true">{project.code}</div>
          <div className="card-body">
            <h2 className="project-title">{project.name}</h2>
            <div className="chips"><SdgChips goals={project.sdgs} /><Chip>{project.stage_display}</Chip></div>
            <p className="pre description">{project.description || 'No description yet.'}</p>
            <h3 className="section-title">Pipeline progress</h3>
            <Stepper stage={project.stage} />
          </div>
          <div className="card-body divider">
            <h3 className="section-title">Stage history</h3>
            <div className="inset-table">
              <table className="table">
                <thead><tr><th>Stage</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                <tbody>
                  {[...history].reverse().map((row, index) => (
                    <tr key={index}>
                      <td className="strong">{row.stage_display}</td>
                      <td className="muted">{fmtDate(row.start_date)}</td>
                      <td className="muted">{fmtDate(row.end_date)}</td>
                      <td><Chip>{row.end_date ? 'Completed' : 'Current'}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="stack-lg">
          <Card title="Readiness score">
            {latest ? (
              <>
                <div className="big-score">{latest.score}<small>/ 100</small></div>
                <ScoreBar value={latest.score} marker />
                <p className="note">Evaluated {fmtDate(latest.evaluation_date)}</p>
              </>
            ) : <p className="muted">No readiness score has been recorded.</p>}
            {project.can_manage && !browsing && project.stage !== 'DRAFT' && (
              <Link className="btn btn-block" to={`/score?project=${project.id}`}>Enter readiness score</Link>
            )}
          </Card>

          {registry ? (
            <Card title="Registry listing">
              <DetailList rows={[
                ['Registry ID', registry.code],
                ['Listed date', fmtDate(registry.listed_date)],
                ['Status', <Chip>{registry.status_display}</Chip>],
                ['Investment amount', money(registry.investment_amount)],
              ]} />
            </Card>
          ) : (
            <Card title="Registry listing"><p className="muted">This project is not listed in the investment registry.</p></Card>
          )}

          <Card title="SDG alignment">
            {project.sdg_alignment.length === 0 ? <p className="muted">No SDGs tagged yet.</p> : (
              <ul className="alignment">
                {project.sdg_alignment.map((goal) => (
                  <li key={goal.goal}>
                    <span>{goal.goal}</span>
                    <div>
                      <strong>{goal.name}</strong>
                      <small>{goal.indicator_count} indicator{goal.indicator_count === 1 ? '' : 's'} tracked</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {project.can_manage && !browsing && (
              <Link className="btn btn-block" to={`/sdg?project=${project.id}`}>{project.sdgs.length ? 'Edit SDG tags' : 'Tag SDGs'}</Link>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
