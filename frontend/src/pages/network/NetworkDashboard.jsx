import { Link } from 'react-router-dom'
import { Card, ErrorState, Kpi, Loading, PageHeader } from '../../components/ui.jsx'
import { fmtDateTime, useFetch } from '../../utils.js'

const fmt = (n, digits = 0) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: digits })

// Horizontal bars: rows of { label, value }, with an optional value formatter.
function Bars({ rows, format = (v) => fmt(v), empty = 'No data yet.' }) {
  const peak = Math.max(0, ...rows.map((r) => r.value))
  if (!rows.length || !peak) return <p className="muted">{empty}</p>
  return (
    <div className="hbars">
      {rows.map((row) => (
        <div className="hbar hbar-wide" key={row.label}>
          <span title={row.label}>{row.label}</span>
          <div className="bar bar-lg"><div className="bar-fill bar-blue" style={{ width: `${(100 * row.value) / peak}%` }} /></div>
          <strong>{format(row.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// 30 daily columns of likes + comments + shares + posts.
function Activity({ days }) {
  const totals = days.map((d) => d.likes + d.comments + d.shares + d.posts)
  const peak = Math.max(1, ...totals)
  return (
    <>
      <div className="spark" role="img" aria-label="Daily engagement over the last 30 days">
        {days.map((d, i) => (
          <div key={d.date} className="spark-col" title={`${d.date}: ${d.likes} likes, ${d.comments} comments, ${d.shares} shares, ${d.posts} posts`}>
            <div style={{ height: `${(100 * totals[i]) / peak}%` }} />
          </div>
        ))}
      </div>
      <p className="note">{fmt(totals.reduce((a, b) => a + b, 0))} interactions in the last 30 days · {days[0]?.date} → {days[days.length - 1]?.date}</p>
    </>
  )
}

// Investment portfolio dashboard (public).
export default function NetworkDashboard() {
  const { data, error, reload } = useFetch('/network/dashboard/')
  if (error) return <ErrorState error={error} retry={reload} />
  if (!data) return <Loading />
  const { portfolios, sdg_investment: sdg, nap, engagement, members, affinity } = data
  const SHORT = { sdg_intervention: 'SDG', sdg_indicator: 'Indicator', nap: 'NAP', sovereign: 'Sovereign', draft: 'Draft', member: 'Member' }
  const breakdown = portfolios.by_collection.map((c) => `${SHORT[c.key] || c.label} ${c.count}`).join(' · ')

  return (
    <>
      <PageHeader crumb="Investment network / Dashboard" title="Investment portfolio dashboard"
        subtitle={`Updated ${fmtDateTime(data.generated_at)}`} />

      <div className="grid-4">
        <Kpi label="Portfolios" value={fmt(portfolios.total)} note={breakdown} icon="grid" />
        <Kpi label="SDG investment need" value={fmt(sdg.total_billion, 1)} note={`NRs billion across ${sdg.goal_count} SDGs`} icon="target" />
        <Kpi label="Digital / AI share" value={`${fmt(sdg.digital_billion, 1)} / ${fmt(sdg.ai_billion, 1)}`}
          note={`NRs billion (${sdg.digital_pct}% / ${sdg.ai_pct}%)`} icon="sparkle" />
        <Kpi label="Climate NAP costing" value={fmt(nap.total_billion, 1)} note={`NRs billion · ${nap.count} interventions in ${nap.sectors.length} sectors`} icon="chart" />
      </div>
      <div className="grid-6">
        {[['Members', members.total], ['Posts', engagement.posts], ['Likes', engagement.likes],
          ['Comments', engagement.comments], ['Shares', engagement.shares], ['Service requests', engagement.service_requests]]
          .map(([label, value]) => <div className="card mini-stat" key={label}><span>{label}</span><strong>{fmt(value)}</strong></div>)}
      </div>

      <div className="row-2">
        <Card title="SDG investment need by goal (NRs billion)">
          <Bars rows={sdg.by_goal.map((g) => ({ label: `SDG ${g.goal} · ${g.name}`, value: g.amount_billion }))} format={(v) => fmt(v, 1)} />
        </Card>
        <Card title="Members by actor type">
          <Bars rows={members.by_actor.filter((a) => a.count).map((a) => ({ label: a.label, value: a.count }))} />
        </Card>
        <Card title="Climate NAP costing by sector (NRs billion)">
          <Bars rows={nap.sectors.map((s) => ({ label: s.label, value: s.amount_billion }))} format={(v) => fmt(v, 1)} />
        </Card>
        <Card title="Sovereign Digital/AI portfolios by layer">
          <Bars rows={data.sovereign_layers.map((s) => ({ label: s.label, value: s.count }))} />
        </Card>
        <Card title="Draft portfolios by category">
          <Bars rows={data.draft_categories.map((s) => ({ label: s.label, value: s.count }))} />
        </Card>
        <Card title="Platform engagement, last 30 days"><Activity days={engagement.last_30_days} /></Card>
      </div>

      <Card title="Most engaged portfolios" flush>
        <table className="table">
          <thead><tr><th>Portfolio</th><th>Collection</th><th>Likes</th><th>Comments</th><th>Shares</th></tr></thead>
          <tbody>
            {data.most_engaged.map((p) => (
              <tr key={p.id}>
                <td><Link className="strong" to={`/portfolios/${p.id}`}>{p.name}</Link></td>
                <td className="muted">{p.collection_display}</td>
                <td>{p.likes}</td><td>{p.comments}</td><td>{p.shares}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Associative mapping: actor type × collection" flush>
        <p className="pad muted">Affinity the recommender uses to match each actor type to portfolio collections — the built-in
          mapping blended with what members actually engage with.</p>
        <table className="table matrix">
          <thead><tr><th>Actor type</th>{affinity.collections.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {affinity.rows.map((row) => (
              <tr key={row.actor}>
                <td className="strong">{row.label}</td>
                {row.values.map((value, i) => (
                  <td key={affinity.collections[i].key} style={{ background: `rgba(47, 111, 237, ${(value * 0.55).toFixed(2)})` }}
                    className={value >= 0.6 ? 'hot' : ''}>{value.toFixed(2)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
