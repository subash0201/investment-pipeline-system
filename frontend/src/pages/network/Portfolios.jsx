import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { query } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import PortfolioCard from '../../components/PortfolioCard.jsx'
import { Card, Empty, ErrorState, Loading, PageHeader, Pagination } from '../../components/ui.jsx'
import { useReference } from '../../network.js'
import { useFetch } from '../../utils.js'

const PAGE_SIZE = 12

// All investment portfolios, with collection / SDG / sort filters kept in the URL.
export default function Portfolios() {
  const { user } = useAuth()
  const reference = useReference()
  const [params, setParams] = useSearchParams()
  const filters = {
    q: params.get('q') || '',
    collection: params.get('collection') || '',
    sdg: params.get('sdg') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page') || 1),
  }
  const [search, setSearch] = useState(filters.q)

  const set = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    const clean = Object.fromEntries(Object.entries(next).filter(([key, value]) =>
      value !== '' && !(key === 'page' && value === 1) && !(key === 'sort' && value === 'newest')))
    setParams(clean, { replace: true })
  }

  useEffect(() => {
    if (search === filters.q) return undefined
    const timer = setTimeout(() => set({ q: search }), 350)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, reload } = useFetch(
    `/portfolios/${query({ q: filters.q, collection: filters.collection, sdg: filters.sdg, sort: filters.sort,
      page: filters.page, page_size: PAGE_SIZE })}`)
  const collection = reference?.collections.find((c) => c.key === filters.collection)

  return (
    <>
      <PageHeader crumb="Investment network / Portfolios"
        title={`${collection ? collection.label : 'All investment portfolios'}${data ? ` · ${data.count.toLocaleString('en-US')}` : ''}`}
        subtitle="SDG interventions and indicators, Climate NAP 2021–2050, Digital/AI sovereign, draft and member portfolios.">
        {user?.role === 'USER' && <Link className="btn btn-primary" to="/projects/register">Post a portfolio</Link>}
        {!user && <Link className="btn btn-primary" to="/join">Join to post a portfolio</Link>}
      </PageHeader>

      <div className="filters">
        <input className="input grow" type="search" placeholder="Search…" aria-label="Search portfolios"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" aria-label="Collection" value={filters.collection} onChange={(e) => set({ collection: e.target.value })}>
          <option value="">All collections</option>
          {reference?.collections.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="input" aria-label="SDG" value={filters.sdg} onChange={(e) => set({ sdg: e.target.value })}>
          <option value="">All SDGs</option>
          {reference?.sdg_goals.map((g) => <option key={g.number} value={g.number}>SDG {g.number} — {g.name}</option>)}
        </select>
        <select className="input" aria-label="Sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
          {(reference?.sorts || [{ key: 'newest', label: 'Newest' }]).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.count === 0 ? (
        <Card><Empty>No portfolios match these filters.</Empty></Card>
      ) : (
        <>
          <div className={`pcards pcards-grid ${loading ? 'dim' : ''}`}>
            {data.results.map((p) => <PortfolioCard key={p.id} portfolio={p} />)}
          </div>
          <Pagination page={filters.page} pageSize={PAGE_SIZE} count={data.count} noun="portfolios"
            onPage={(page) => { set({ page }); window.scrollTo(0, 0) }} />
        </>
      )}
    </>
  )
}
