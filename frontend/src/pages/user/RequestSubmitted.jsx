import { Link, useParams } from 'react-router-dom'
import { Chip, ErrorState, Loading, PageHeader, ResultCard } from '../../components/ui.jsx'
import { useFetch } from '../../utils.js'

// Screen 242 — Request Submitted (Pending Approval).
export default function RequestSubmitted() {
  const { id } = useParams()
  const { data: request, error } = useFetch(`/stage-requests/${id}/`)

  if (error) return <ErrorState error={error} />
  if (!request) return <Loading />

  return (
    <>
      <PageHeader crumb="Projects / Pipeline Stage" title="Request Submitted" />
      <ResultCard kind="pending" title="Sent for approval"
        text={<>Your request was sent to an administrator.<br />You will be notified once a decision is made.</>}
        rows={[
          ['Request ID', request.code],
          ['Project', `${request.project_code} · ${request.project_name}`],
          ['Transition', `${request.from_stage_display} → ${request.to_stage_display}`],
          ['Status', <Chip>{request.status === 'PENDING' ? 'Pending Approval' : request.status_display}</Chip>],
        ]}>
        <Link className="btn btn-primary" to={`/pipeline?project=${request.project_id}`}>Back to Pipeline Stage</Link>
        <Link className="btn" to="/projects">My Projects</Link>
      </ResultCard>
    </>
  )
}
