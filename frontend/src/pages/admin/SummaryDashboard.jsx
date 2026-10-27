import { useState } from 'react'
import { api } from '../../api.js'
import { Banner, Card, DetailList, ErrorState, Kpi, Loading, PageHeader } from '../../components/ui.jsx'
import { fmtDateTime, moneyShort, useFetch } from '../../utils.js'

const SHORT = {
  DRAFT: 'Draft', REGISTERED: 'Registered', UNDER_REVIEW: 'Under Review', PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved', INVESTMENT_READY: 'Invest. Ready', LISTED: 'Listed',
}

// Vertical bars with a value on top; the y-axis gridlines sit behind them.
function ColumnChart({ rows, axis = true, tint }) {
  const peak = Math.max(1, ...rows.map((row) => row.count))
  const step = Math.max(1, Math.ceil(peak / 3))
  const top = step * 3
  const leader = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0])
  return (
    <div className={`columns ${axis ? 'with-axis' : ''}`} role="img"
      aria-label={rows.map((row) => `${row.label}: ${row.count}`).join(', ')}>
      {axis && (
        <div className="plot-grid">
          {[3, 2, 1, 0].map((n) => (
            <div className="gridline" key={n} style={{ bottom: `${(100 * n) / 3}%` }}><span>{n * step}</span></div>
          ))}
        </div>
      )}
      {rows.map((row) => (
        <div className="column" key={row.label}>
          <div className="column-track">
            <div className={`column-bar ${tint ? tint(row) : row === leader && row.count ? 'peak' : ''}`}
              style={{ height: `${(100 * row.count) / top}%` }} title={`${row.label}: ${row.count}`}>
              <span>{row.count}</span>
            </div>
          </div>
          <div className="column-label">{row.label}</div>
        </div>
      ))}
    </div>
  )
}

// Screen 310 — Summary Dashboard.
export default function SummaryDashboard() {
  const { data, error, loading, reload } = useFetch('/dashboard/summary/')
  const [failure, setFailure] = useState('')
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    setFailure('')
    try {
      await api.download('/dashboard/summary/export/', 'pipeline-summary.csv')
    } catch (problem) {
      setFailure(problem.message)
    }
    setExporting(false)
  }

  const header = (
    <PageHeader crumb="Reports" title="Summary Dashboard"
      subtitle={data ? `Generated ${fmtDateTime(data.generated_at)}` : 'Generating…'}>
      <button className="btn btn-primary" onClick={reload} disabled={loading}>{loading ? 'Generating…' : 'Regenerate'}</button>
      <button className="btn" onClick={exportCsv} disabled={exporting || !data}>{exporting ? 'Exporting…' : 'Export'}</button>
    </PageHeader>
  )
  if (error) return <>{header}<ErrorState error={error} retry={reload} /></>
  if (!data) return <>{header}<Loading /></>

  const most = Math.max(1, ...data.top_sdgs.map((row) => row.count))
  return (
    <>
      {header}
      <Banner kind="error">{failure}</Banner>
      <div className={`grid-4 ${loading ? 'dim' : ''}`}>
        <Kpi label="Total projects" value={data.total_projects} icon="folder" noteTone="green" note={`+${data.new_this_month} this month`} />
        <Kpi label="Investment ready" value={data.investment_ready} icon="star" noteTone="blue" note={`${data.investment_ready_pct}% of pipeline`} />
        <Kpi label="Avg. readiness score" value={data.avg_score ?? '—'} icon="gauge" noteTone="green" note={`Threshold ${data.threshold}`} />
        <Kpi label="Pending approvals" value={data.pending_approvals} icon="clock" noteTone="amber"
          note={data.pending_approvals ? 'Needs attention' : 'All clear'} />
      </div>

      <div className={`split split-wide ${loading ? 'dim' : ''}`}>
        <Card title="Projects by pipeline stage">
          <ColumnChart rows={data.by_stage.map((row) => ({ label: SHORT[row.stage], count: row.count }))} />
          {data.rejected > 0 && <p className="note">Plus {data.rejected} rejected and on hold, outside the pipeline.</p>}
        </Card>
        <Card title="Top SDGs tagged">
          {data.top_sdgs.length === 0 ? <p className="muted">No SDGs tagged yet.</p> : (
            <div className="ranked">
              {data.top_sdgs.map((row) => (
                <div key={row.goal}>
                  <div><span>SDG {row.goal} · {row.name}</span><strong>{row.count}</strong></div>
                  <div className="bar"><div className="bar-fill bar-blue" style={{ width: `${(100 * row.count) / most}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className={`split split-wide ${loading ? 'dim' : ''}`}>
        <Card title="Readiness score distribution">
          <ColumnChart axis={false} tint={(row) => (row.low ? 'soft' : 'good')}
            rows={data.score_distribution.map((row, index) => ({ label: row.range, count: row.count, low: index < 3 }))} />
          <div className="legend">
            <span><i className="soft" /> Below 60</span>
            <span><i className="good" /> 60 and above</span>
          </div>
        </Card>
        <Card title="Registry summary">
          <DetailList rows={[
            ['Currently listed', data.registry.listed],
            ['Delisted', data.registry.delisted],
            ['Funded', data.registry.funded],
            ['Total committed', moneyShort(data.registry.total_committed)],
          ]} />
        </Card>
      </div>
    </>
  )
}
