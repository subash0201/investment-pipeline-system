import { Link, useSearchParams } from 'react-router-dom'
import {
  Banner, Card, Chip, DetailList, ErrorState, Field, Loading, PageHeader, ProjectSelect, Stepper,
} from '../../components/ui.jsx'
import { fmtDate, useFetch, useFlash } from '../../utils.js'

// Screen 240 — Pipeline Stage Tracker.
export default function PipelineStage() {
  const flash = useFlash()
  const [params, setParams] = useSearchParams()
  const projectId = params.get('project') || ''
  const { data: project, error, loading, reload } = useFetch(projectId ? `/projects/${projectId}/` : null)
  const pipeline = project?.pipeline
  const decision = pipeline?.last_decision

  return (
    <>
      <PageHeader crumb="Projects / Pipeline Stage" title="Pipeline Stage"
        subtitle="Track where a project is and request a move to the next stage." />
      <Banner>{flash}</Banner>
      <Field label="Project" className="project-picker">
        <ProjectSelect value={projectId} onChange={(id) => setParams(id ? { project: id } : {})} />
      </Field>

      {!projectId ? null : error ? <ErrorState error={error} retry={reload} /> : loading || !project ? <Loading /> : (
        <>
          {/* Decisions made by an administrator (screens 332 / 333) surface here for the applicant. */}
          {pipeline.open_request && (
            <Banner kind="info">
              {pipeline.open_request.code} ({pipeline.open_request.from_stage_display} → {pipeline.open_request.to_stage_display})
              {' '}is waiting for an administrator's decision.
            </Banner>
          )}
          {!pipeline.open_request && decision?.status === 'APPROVED' && (
            <Banner>
              {decision.code} was approved on {fmtDate(decision.decided_at)}.
              {decision.comments && ` Note from the administrator: ${decision.comments}`}
            </Banner>
          )}
          {!pipeline.open_request && decision?.status === 'REJECTED' && (
            <Banner kind="error">
              {decision.code} was rejected on {fmtDate(decision.decided_at)}. Reason: {decision.comments}
              {project.stage === 'REJECTED' && ' You can revise the project and resubmit.'}
            </Banner>
          )}

          <section className="card card-body"><Stepper stage={project.stage} /></section>

          <div className="split">
            <Card title="Stage history" flush>
              <table className="table">
                <thead><tr><th>Stage</th><th>Start date</th><th>End date</th><th>Status</th></tr></thead>
                <tbody>
                  {project.history.map((row, index) => (
                    <tr key={index}>
                      <td className="strong">{row.stage_display}</td>
                      <td className="muted">{fmtDate(row.start_date)}</td>
                      <td className="muted">{fmtDate(row.end_date)}</td>
                      <td><Chip>{row.status}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Current stage">
              <DetailList rows={[
                ['Stage', <Chip>{project.stage_display}</Chip>],
                ['Readiness score', project.score === null ? 'Not scored' : `${project.score} / 100`],
                ['SDGs tagged', project.sdgs.length ? `${project.sdgs.length} goal${project.sdgs.length === 1 ? '' : 's'}` : 'None'],
                ['Next stage', pipeline.next_stage_display
                  || (project.stage === 'PENDING_APPROVAL' ? 'Awaiting decision'
                    : project.stage === 'INVESTMENT_READY' ? 'Listed in Registry' : '—')],
              ]} />
              {pipeline.next_stage && !pipeline.open_request ? (
                <>
                  <Link className="btn btn-primary btn-block" to={`/pipeline/request?project=${project.id}`}>
                    Request stage update
                  </Link>
                  <p className="note">Some transitions require admin approval.</p>
                </>
              ) : (
                <p className="note">
                  {pipeline.open_request ? 'A request for this project is already open.'
                    : project.stage === 'INVESTMENT_READY' ? 'An administrator can now list this project in the investment registry.'
                    : project.stage === 'LISTED' ? 'This project is listed in the investment registry.'
                    : 'No stage update is available right now.'}
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
