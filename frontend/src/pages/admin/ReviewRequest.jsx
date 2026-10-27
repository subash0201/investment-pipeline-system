import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api.js'
import {
  Banner, Card, Chip, DetailList, ErrorState, Field, Loading, PageHeader, ResultCard, SdgChips,
} from '../../components/ui.jsx'
import { fmtDate, THRESHOLD, useFetch } from '../../utils.js'

// Screens 331 (Review), 332 (Approved) and 333 (Rejected).
export default function ReviewRequest() {
  const { id } = useParams()
  const { data: loaded, error } = useFetch(`/stage-requests/${id}/`)
  const [decided, setDecided] = useState(null)
  const [comments, setComments] = useState('')
  const [problem, setProblem] = useState({})
  const [busy, setBusy] = useState('')

  if (error) return <ErrorState error={error} />
  if (!loaded) return <Loading />
  const request = decided || loaded
  const project = `${request.project_code} · ${request.project_name}`

  const decide = async (verdict) => {
    if (verdict === 'reject' && !comments.trim()) {
      setProblem({ comments: 'A reason is required when rejecting.' })
      return
    }
    setBusy(verdict)
    setProblem({})
    try {
      setDecided(await api.post(`/stage-requests/${id}/${verdict}/`, { comments: comments.trim() }))
    } catch (failure) {
      setProblem(failure.field('comments') ? { comments: failure.field('comments') } : { general: failure.message })
    }
    setBusy('')
  }

  const links = (
    <>
      <Link className="btn btn-primary" to="/admin/approvals">Back to requests</Link>
      <Link className="btn" to="/admin">Admin home</Link>
    </>
  )

  if (request.status === 'APPROVED') {
    return (
      <>
        <PageHeader crumb="Approvals" title="Request Approved" />
        <ResultCard title="Transition approved" text="The project stage has been updated and the applicant was notified."
          rows={[
            ['Request ID', request.code],
            ['Project', project],
            ['New stage', <Chip>{request.resulting_stage_display}</Chip>],
            request.comments && ['Comments', request.comments],
            ['Approved on', fmtDate(request.decided_at)],
          ]}>
          {links}
        </ResultCard>
      </>
    )
  }

  if (request.status === 'REJECTED') {
    return (
      <>
        <PageHeader crumb="Approvals" title="Request Rejected" />
        <ResultCard kind="error" title="Transition rejected" text="The applicant was notified and can revise and resubmit."
          rows={[
            ['Request ID', request.code],
            ['Project', project],
            ['Status', <Chip>Rejected</Chip>],
            ['Reason', request.comments],
            ['Rejected on', fmtDate(request.decided_at)],
          ]}>
          {links}
        </ResultCard>
      </>
    )
  }

  return (
    <>
      <PageHeader crumb={`Approvals / ${request.code}`} title={`Review Request ${request.code}`}
        subtitle={`${request.project_name} · requested by ${request.requested_by}`} />
      <div className="split">
        <Card title="Request details">
          <DetailList rows={[
            ['Project', project],
            ['Requested by', request.requested_by],
            ['Requested on', fmtDate(request.created_at)],
            ['From stage', <Chip>{request.from_stage_display}</Chip>],
            ['To stage', <Chip>{request.to_stage_display}</Chip>],
            ['Readiness score', request.score === null ? 'Not scored'
              : `${request.score} / 100  (${request.score >= THRESHOLD ? '≥' : '<'} ${THRESHOLD} threshold)`],
            ['SDG tags', <SdgChips goals={request.sdgs} />],
          ]} />
          <h3 className="section-title">Justification</h3>
          <p className="quote pre">{request.justification || 'No justification was given.'}</p>
        </Card>

        <Card title="Decision">
          <Banner kind="error">{problem.general}</Banner>
          <Field label="Comments" error={problem.comments} hint="Required when rejecting.">
            <textarea className="input" rows={5} placeholder="Reason or notes for the applicant…"
              value={comments} onChange={(event) => setComments(event.target.value)} />
          </Field>
          <div className="row-2">
            <button className="btn btn-primary" onClick={() => decide('approve')} disabled={Boolean(busy)}>
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button className="btn btn-danger-outline" onClick={() => decide('reject')} disabled={Boolean(busy)}>
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
          <Link className="btn btn-block" to="/admin/approvals">Back to requests</Link>
        </Card>
      </div>
    </>
  )
}
