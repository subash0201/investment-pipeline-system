import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { query } from '../../api.js'
import { Chip, Empty, ErrorState, Loading, PageHeader, Pagination } from '../../components/ui.jsx'
import { fmtDate, useFetch } from '../../utils.js'

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]
const PAGE_SIZE = 8

// Screen 330 — Pending Stage Transition Requests (with Approved / Rejected tabs).
export default function Approvals() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('status')) ? params.get('status') : 'pending'
  const [page, setPage] = useState(1)
  const counts = useFetch('/stage-requests/counts/').data
  const { data, error, loading, reload } = useFetch(`/stage-requests/${query({ status: tab, page, page_size: PAGE_SIZE })}`)

  return (
    <>
      <PageHeader crumb="Approvals" title="Stage Approvals" subtitle="Review requests to move projects between pipeline stages." />
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={key === tab} className={key === tab ? 'on' : ''}
            onClick={() => { setPage(1); setParams(key === 'pending' ? {} : { status: key }) }}>
            {label}{counts ? ` (${counts[key]})` : ''}
          </button>
        ))}
      </div>

      <section className="card">
        {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.count === 0 ? (
          <Empty>{tab === 'pending' ? 'No requests are waiting for a decision.' : `No ${tab} requests yet.`}</Empty>
        ) : (
          <div className={loading ? 'dim' : ''}>
            <table className="table">
              <thead>
                <tr>
                  <th>Request ID</th><th>Project</th><th>From stage</th><th>To stage</th>
                  <th>Requested by</th><th>Date</th><th>Score</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((request) => (
                  <tr key={request.id}>
                    <td className="muted">{request.code}</td>
                    <td className="strong">{request.project_name}</td>
                    <td><Chip>{request.from_stage_display}</Chip></td>
                    <td><Chip>{request.to_stage_display}</Chip></td>
                    <td className="muted">{request.requested_by}</td>
                    <td className="muted">{fmtDate(request.created_at)}</td>
                    <td className="strong">{request.score ?? '—'}</td>
                    <td>
                      <Link className="btn btn-sm" to={`/admin/approvals/${request.id}`}>
                        {request.status === 'PENDING' ? 'Review' : 'View'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data?.count > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} noun="requests" onPage={setPage} />}
    </>
  )
}
