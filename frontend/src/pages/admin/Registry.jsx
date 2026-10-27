import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, query } from '../../api.js'
import { Banner, Chip, Empty, ErrorState, Loading, Modal, PageHeader, Pagination } from '../../components/ui.jsx'
import { fmtDate, money, useFetch, useFlash } from '../../utils.js'

const PAGE_SIZE = 6

// Screens 320 (Registry List) and 323 (Delete confirmation).
export default function Registry() {
  const flash = useFlash()
  const [notice, setNotice] = useState(flash)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', ordering: '-listed_date' })
  const [page, setPage] = useState(1)
  const [doomed, setDoomed] = useState(null)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.search === search ? current : { ...current, search }))
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useFetch(`/registry/${query({ ...filters, page, page_size: PAGE_SIZE })}`)
  const pick = (key) => (event) => {
    setFilters({ ...filters, [key]: event.target.value })
    setPage(1)
  }

  const remove = async () => {
    setBusy(true)
    setFailure('')
    try {
      await api.delete(`/registry/${doomed.id}/`)
      setNotice(`${doomed.code} was removed from the registry.`)
      setDoomed(null)
      if (data.results.length === 1 && page > 1) setPage(page - 1)
      else reload()
    } catch (problem) {
      setFailure(problem.message)
    }
    setBusy(false)
  }

  return (
    <>
      <PageHeader crumb="Registry" title="Investment Registry" subtitle="Add, edit or remove projects listed for investors.">
        <Link className="btn btn-primary" to="/admin/registry/new">+ Add entry</Link>
      </PageHeader>
      <Banner>{notice}</Banner>

      <div className="filters">
        <input className="input grow" type="search" placeholder="Search registry…" aria-label="Search registry"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={filters.status} onChange={pick('status')} aria-label="Status">
          <option value="">All statuses</option>
          <option value="LISTED">Listed</option>
          <option value="FUNDED">Funded</option>
          <option value="DELISTED">Delisted</option>
        </select>
        <select className="input" value={filters.ordering} onChange={pick('ordering')} aria-label="Sort">
          <option value="-listed_date">Listed date ↓</option>
          <option value="listed_date">Listed date ↑</option>
          <option value="-investment_amount">Amount ↓</option>
          <option value="investment_amount">Amount ↑</option>
        </select>
      </div>

      <section className="card">
        {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.count === 0 ? (
          <Empty>
            {filters.search || filters.status ? 'No entries match these filters.'
              : <>The registry is empty. <Link to="/admin/registry/new">Add the first entry</Link>.</>}
          </Empty>
        ) : (
          <div className={loading ? 'dim' : ''}>
            <table className="table">
              <thead>
                <tr><th>Registry ID</th><th>Project</th><th>Listed date</th><th>Investment amount</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {data.results.map((entry) => (
                  <tr key={entry.id}>
                    <td className="muted">{entry.code}</td>
                    <td className="strong">{entry.project_name}</td>
                    <td className="muted">{fmtDate(entry.listed_date)}</td>
                    <td>{money(entry.investment_amount)}</td>
                    <td><Chip>{entry.status_display}</Chip></td>
                    <td className="actions">
                      <Link to={`/admin/registry/${entry.id}/edit`}>Edit</Link>
                      <span className="sep">|</span>
                      <button className="link link-danger" onClick={() => { setFailure(''); setDoomed(entry) }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data?.count > 0 && <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} noun="entries" onPage={setPage} />}

      {doomed && (
        <Modal title="Delete registry entry?" subtitle={`${doomed.code} · ${doomed.project_name}`}
          onClose={() => !busy && setDoomed(null)}
          actions={
            <>
              <button className="btn" onClick={() => setDoomed(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete entry'}</button>
            </>
          }>
          <Banner kind="error">{failure}</Banner>
          <p>
            This entry will be removed from the registry and the project will no longer appear in
            Browse Investment-Ready Projects.
          </p>
          <p className="strong">This action cannot be undone.</p>
        </Modal>
      )}
    </>
  )
}
