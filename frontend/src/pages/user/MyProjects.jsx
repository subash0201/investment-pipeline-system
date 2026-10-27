import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { query } from '../../api.js'
import { Banner, Chip, Empty, ErrorState, Loading, PageHeader, Pagination } from '../../components/ui.jsx'
import { fmtDate, STAGE_LABEL, useFetch, useFlash } from '../../utils.js'

const PAGE_SIZE = 7

// Screen 210 — My Projects.
export default function MyProjects() {
  const flash = useFlash()
  const [filters, setFilters] = useState({ search: '', stage: '', status: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Search as the user types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.search === search ? current : { ...current, search }))
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useFetch(`/projects/${query({ ...filters, page, page_size: PAGE_SIZE })}`)
  const pick = (key) => (event) => {
    setFilters({ ...filters, [key]: event.target.value })
    setPage(1)
  }
  const filtered = filters.search || filters.stage || filters.status

  return (
    <>
      <PageHeader crumb="Projects" title="My Projects" subtitle="All projects you have registered.">
        <Link className="btn btn-primary" to="/projects/register">+ Register Project</Link>
      </PageHeader>
      <Banner>{flash}</Banner>

      <div className="filters">
        <input className="input grow" type="search" placeholder="Search projects…" aria-label="Search projects"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={filters.stage} onChange={pick('stage')} aria-label="Stage">
          <option value="">All stages</option>
          {Object.entries(STAGE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="input" value={filters.status} onChange={pick('status')} aria-label="Status">
          <option value="">All statuses</option>
          {['Draft', 'Active', 'Listed', 'On hold'].map((label) => <option key={label}>{label}</option>)}
        </select>
      </div>

      <section className="card">
        {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.count === 0 ? (
          <Empty>
            {filtered ? 'No projects match these filters.' : (
              <>You have not registered any projects yet. <Link to="/projects/register">Register a project</Link>.</>
            )}
          </Empty>
        ) : (
          <div className={loading ? 'dim' : ''}>
            <table className="table">
              <thead>
                <tr>
                  <th>Project ID</th><th>Name</th><th>Current stage</th><th>Status</th>
                  <th>Registered</th><th>Score</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((project) => (
                  <tr key={project.id}>
                    <td className="muted">{project.code}</td>
                    <td className="strong">{project.name}</td>
                    <td><Chip>{project.stage_display}</Chip></td>
                    <td><Chip>{project.status}</Chip></td>
                    <td className="muted">{fmtDate(project.registration_date)}</td>
                    <td className="strong">{project.score ?? '—'}</td>
                    <td className="actions">
                      <Link to={`/projects/${project.id}`}>View</Link>
                      <span className="sep">|</span>
                      {project.stage === 'DRAFT'
                        ? <Link to={`/projects/register?draft=${project.id}`}>Continue</Link>
                        : <Link to={`/pipeline?project=${project.id}`}>Update stage</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data?.count > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} noun="projects" onPage={setPage} />
      )}
    </>
  )
}
