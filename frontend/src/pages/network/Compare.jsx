import { Link } from 'react-router-dom'
import { Card, Empty, ErrorState, Loading, PageHeader } from '../../components/ui.jsx'
import { COMPARE_MAX, nrsBillion, pct, useCompare } from '../../network.js'
import { useFetch } from '../../utils.js'

const ROWS = [
  ['Collection', (p) => p.collection_display],
  ['Category', (p) => p.category || '—'],
  ['Reference', (p) => p.reference || p.code],
  ['Primary SDG', (p) => (p.primary_sdg ? `SDG ${p.primary_sdg} · ${p.primary_sdg_name}` : '—')],
  ['All SDGs', (p) => (p.sdgs.length ? p.sdgs.map((g) => `SDG ${g}`).join(', ') : '—')],
  ['Pipeline stage', (p) => p.stage_display],
  ['Readiness score', (p) => (p.score === null ? '—' : `${p.score} / 100`)],
  ['Costing period', (p) => p.costing_period || '—'],
  ['Total investment', (p) => nrsBillion(p.total_investment)],
  ['Digital share', (p) => (p.total_investment ? `${pct(p.digital_investment, p.total_investment)}%` : '—')],
  ['AI share', (p) => (p.total_investment ? `${pct(p.ai_investment, p.total_investment)}%` : '—')],
  ['Registry', (p) => p.registry_status || 'Not listed'],
  ['Engagement', (p) => `${p.likes} likes · ${p.comments} comments · ${p.shares} shares`],
  ['Sections published', (p) => `${p.sections.length}`],
]

// Compare up to four portfolios side by side.
export default function Compare() {
  const compare = useCompare()
  const { data, error, reload } = useFetch(compare.ids.length ? `/portfolios/compare/?ids=${compare.ids.join(',')}` : null)

  return (
    <>
      <PageHeader crumb="Investment network / Compare" title={`Compare portfolios · ${compare.ids.length}/${COMPARE_MAX}`}
        subtitle="Use the Compare button on up to four portfolios.">
        {compare.ids.length > 0 && <button className="btn" onClick={compare.clear}>Clear all</button>}
      </PageHeader>

      {compare.ids.length === 0 ? (
        <Card><Empty>Nothing to compare yet. <Link to="/portfolios">Browse portfolios</Link></Empty></Card>
      ) : error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : (
        <Card flush>
          <table className="table compare-table">
            <thead>
              <tr>
                <th>Portfolio</th>
                {data.map((p) => (
                  <th key={p.id}>
                    <Link to={`/portfolios/${p.id}`} className="strong">{p.name}</Link>
                    <button className="link link-danger compare-remove" onClick={() => compare.toggle(p.id)}>Remove</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, value]) => (
                <tr key={label}>
                  <td className="muted">{label}</td>
                  {data.map((p) => <td key={p.id}>{value(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
