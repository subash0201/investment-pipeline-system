import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Banner, Card, Chip, DetailList, ErrorState, Loading, PageHeader } from '../../components/ui.jsx'
import { fmtDate, THRESHOLD, useFetch } from '../../utils.js'

// Screen 231 — Score Saved.
export default function ScoreSaved() {
  const [params] = useSearchParams()
  const projectId = params.get('project')
  const project = useFetch(projectId ? `/projects/${projectId}/` : null)
  const scores = useFetch(projectId ? `/projects/${projectId}/scores/` : null)

  if (!projectId) return <Navigate to="/score" replace />
  const error = project.error || scores.error
  if (error) return <ErrorState error={error} />
  if (!project.data || !scores.data) return <Loading />
  if (scores.data.length === 0) return <Navigate to={`/score?project=${projectId}`} replace />

  const latest = project.data.latest_score
  const requestLink = `/pipeline/request?project=${projectId}`
  const canRequest = Boolean(project.data.pipeline?.next_stage)

  return (
    <>
      <PageHeader crumb="Projects / Readiness Score" title="Score Saved">
        <Link className="btn" to="/projects">My Projects</Link>
        {canRequest && <Link className="btn btn-primary" to={requestLink}>Request stage update</Link>}
      </PageHeader>
      <Banner kind={latest.above_threshold ? 'success' : 'info'}>
        {latest.above_threshold
          ? `Score saved. ${project.data.code} ${canRequest ? 'is now eligible to request a stage update.' : `meets the ${THRESHOLD} threshold.`}`
          : `Score saved. ${project.data.code} needs a score of ${THRESHOLD} or more to reach Investment Ready.`}
      </Banner>

      <div className="score-summary">
        <Card>
          <div className="eyebrow">Latest score</div>
          <div className="big-score">{latest.score}<small>/ 100</small></div>
          <Chip color={latest.above_threshold ? 'green' : 'amber'}>
            {latest.above_threshold ? 'Above' : 'Below'} threshold ({THRESHOLD})
          </Chip>
        </Card>
        <Card>
          <DetailList rows={[
            ['Project', `${project.data.code} · ${project.data.name}`],
            ['Evaluation date', fmtDate(latest.evaluation_date)],
            ['Evaluated by', latest.evaluated_by],
            ['Remarks', latest.remarks || '—'],
            ['Next step', canRequest
              ? <Link className="chip chip-blue" to={requestLink}>Request stage update</Link>
              : <Link className="chip chip-blue" to={`/pipeline?project=${projectId}`}>View pipeline stage</Link>],
          ]} />
        </Card>
      </div>

      <Card title="Score history" flush>
        <table className="table">
          <thead><tr><th>Date</th><th>Score</th><th>Threshold</th><th>Evaluated by</th><th>Remarks</th></tr></thead>
          <tbody>
            {scores.data.map((row) => (
              <tr key={row.id}>
                <td className="muted">{fmtDate(row.evaluation_date)}</td>
                <td className="strong">{row.score}</td>
                <td><Chip>{row.above_threshold ? 'Above' : 'Below'}</Chip></td>
                <td className="muted">{row.evaluated_by}</td>
                <td className="muted">{row.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
