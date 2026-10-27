import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { query } from '../../api.js'
import { Chip, Empty, ErrorState, Loading, PageHeader, ScoreBar, SdgChips } from '../../components/ui.jsx'
import { THRESHOLD, useFetch } from '../../utils.js'

// Screen 250 — Browse Investment-Ready Projects.
export default function Browse() {
  const goals = useFetch('/sdg-goals/').data || []
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', sdg: '', min_score: THRESHOLD, ordering: '-score' })

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, search })), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useFetch(`/browse/${query(filters)}`)
  const pick = (key) => (event) => setFilters({ ...filters, [key]: event.target.value })

  return (
    <>
      <PageHeader crumb="Browse" title="Investment-Ready Projects"
        subtitle="Projects that passed approval and meet the readiness threshold." />
      <div className="filters">
        <input className="input grow" type="search" placeholder="Search by name…" aria-label="Search by name"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={filters.sdg} onChange={pick('sdg')} aria-label="SDG">
          <option value="">All SDGs</option>
          {goals.map((goal) => <option key={goal.number} value={goal.number}>SDG {goal.number} · {goal.name}</option>)}
        </select>
        <select className="input" value={filters.min_score} onChange={pick('min_score')} aria-label="Minimum score">
          {[70, 80, 90].map((score) => <option key={score} value={score}>Min. score: {score}</option>)}
        </select>
        <select className="input" value={filters.ordering} onChange={pick('ordering')} aria-label="Sort">
          <option value="-score">Sort: Score ↓</option>
          <option value="score">Sort: Score ↑</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
      </div>

      {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.length === 0 ? (
        <section className="card"><Empty>No listed projects match these filters.</Empty></section>
      ) : (
        <div className={`cards ${loading ? 'dim' : ''}`}>
          {data.map((project) => (
            <article className="card project-card" key={project.id}>
              <div className="project-art" aria-hidden="true">{project.code}</div>
              <div className="card-body">
                <h3>{project.name}</h3>
                <div className="chips"><SdgChips goals={project.sdgs} /><Chip color="green">Investment Ready</Chip></div>
                <div className="readiness"><span>Readiness</span><strong>{project.score}/100</strong></div>
                <ScoreBar value={project.score} color="green" />
                <Link className="btn btn-block" to={`/browse/${project.id}`}>View details</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
