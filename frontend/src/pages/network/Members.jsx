import { useEffect, useState } from 'react'
import { query } from '../../api.js'
import { Card, Chip, Empty, ErrorState, Loading, PageHeader, Pagination } from '../../components/ui.jsx'
import { useReference } from '../../network.js'
import { fmtDate, useFetch } from '../../utils.js'

const PAGE_SIZE = 24

// Members & actors directory (signed-in members only; email addresses are never shown).
export default function Members() {
  const reference = useReference()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', actor_type: '', page: 1 })

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, search, page: 1 })), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useFetch(`/members/${query({ ...filters, page_size: PAGE_SIZE })}`)

  return (
    <>
      <PageHeader crumb="Investment network / Members" title="Members & actors"
        subtitle="Investors, startups, platform companies, development partners, government agencies and experts." />
      <div className="filters">
        <input className="input grow" type="search" placeholder="Search name, organization, location…" aria-label="Search members"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" aria-label="Actor type" value={filters.actor_type}
          onChange={(e) => setFilters({ ...filters, actor_type: e.target.value, page: 1 })}>
          <option value="">All actor types</option>
          {reference?.actor_types.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </div>
      {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.count === 0 ? (
        <Card><Empty>No members match.</Empty></Card>
      ) : (
        <>
          <div className={`pcards pcards-grid ${loading ? 'dim' : ''}`}>
            {data.results.map((m) => (
              <article className="card" key={m.id}>
                <div className="card-body member">
                  <span className="avatar avatar-lg">{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <div>
                    <h3>{m.name}</h3>
                    {m.headline && <p className="muted">{m.headline}</p>}
                    <div className="chips">
                      {m.actor_type_display && <Chip color="blue">{m.actor_type_display}</Chip>}
                      {m.sdg_interests.slice(0, 4).map((g) => <Chip key={g} color="gray">SDG {g}</Chip>)}
                    </div>
                    <small className="muted">
                      {[m.organization, m.location, `Joined ${fmtDate(m.date_joined)}`].filter(Boolean).join(' · ')}
                      {' · '}{m.portfolio_count} portfolio{m.portfolio_count === 1 ? '' : 's'} · {m.community_count} communit{m.community_count === 1 ? 'y' : 'ies'}
                    </small>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={filters.page} pageSize={PAGE_SIZE} count={data.count} noun="members"
            onPage={(page) => setFilters({ ...filters, page })} />
        </>
      )}
    </>
  )
}
