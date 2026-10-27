import { Link } from 'react-router-dom'
import { STAGES, tone, useFetch } from '../utils.js'

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  plus: 'M12 5v14M5 12h14',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  gauge: 'M5.6 18.4a9 9 0 1 1 12.8 0M12 13l4-5',
  flow: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 7v6a4 4 0 0 0 4 4h8',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3',
  chart: 'M4 20V10m6 10V4m6 16v-8m5 8H3',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4m4 4H3',
  chevron: 'm6 9 6 6 6-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  back: 'M19 12H5m6-6-6 6 6 6',
  heart: 'M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z',
  comment: 'M4 5h16v11H9l-5 4z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  compare: 'M4 4h6v16H4zm10 0h6v16h-6z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  grid: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  feed: 'M4 5h16M4 12h16M4 19h10',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  briefcase: 'M4 8h16v11H4zm5 0V5h6v3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
}

export function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

export const Chip = ({ children, color }) => <span className={`chip chip-${color || tone(children)}`}>{children}</span>

export const SdgChips = ({ goals }) =>
  goals?.length ? (
    <span className="chips">
      {goals.map((goal) => <Chip key={goal} color="blue">SDG {goal}</Chip>)}
    </span>
  ) : (
    <Chip>Not tagged</Chip>
  )

export function Banner({ kind = 'success', children }) {
  if (!children) return null
  const mark = { success: <Icon name="check" size={14} />, error: '!', info: 'i' }[kind]
  return (
    <div className={`banner banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="banner-mark">{mark}</span>
      <div>{children}</div>
    </div>
  )
}

export function PageHeader({ crumb, title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <div className="crumb">{crumb}</div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

export function Card({ title, action, children, className = '', flush = false }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? 'card-flush' : 'card-body'}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, note, noteTone = 'muted', icon }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon"><Icon name={icon} size={14} /></span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-note tone-${noteTone}`}>{note}</div>
    </div>
  )
}

export function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <label className={`field ${error ? 'field-error' : ''} ${className}`}>
      <span className="field-label">{label}{required && ' *'}</span>
      {children}
      {error ? <span className="field-msg">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export const ReadOnly = ({ children }) => <div className="input input-readonly">{children}</div>

export function DetailList({ rows }) {
  return (
    <dl className="details">
      {rows.filter(Boolean).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ScoreBar({ value, marker = false, color }) {
  const tint = color || (marker && value >= 70 ? 'green' : 'blue')
  return (
    <div className="bar">
      <div className={`bar-fill bar-${tint}`} style={{ width: `${Math.max(0, Math.min(value || 0, 100))}%` }} />
      {marker && <span className="bar-marker" style={{ left: '70%' }} />}
    </div>
  )
}

export function Loading() {
  return <div className="state">Loading…</div>
}

export function ErrorState({ error, retry }) {
  return (
    <div className="state">
      <p>{error?.status === 404 ? 'This item could not be found.' : error?.message || 'Something went wrong.'}</p>
      {retry && <button className="btn" onClick={retry}>Try again</button>}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="state">{children}</div>
}

// 1 … 4 5 [6] 7 8 … 74 — keeps the pager short when there are many pages.
function pageWindow(page, pages) {
  if (pages <= 9) return Array.from({ length: pages }, (_, i) => i + 1)
  const wanted = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2])
  const shown = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  return shown.flatMap((n, i) => (i && n - shown[i - 1] > 1 ? [null, n] : [n]))
}

export function Pagination({ page, pageSize, count, noun, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const from = count ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, count)
  return (
    <div className="pagination">
      <span>Showing {from}–{to} of {count} {noun}</span>
      {pages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
          {pageWindow(page, pages).map((n, i) => (n === null
            ? <span key={`gap-${i}`} className="pager-gap">…</span>
            : <button key={n} className={n === page ? 'on' : ''} onClick={() => onPage(n)}>{n}</button>))}
          <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
        </div>
      )}
    </div>
  )
}

// The seven-stage progress line. A rejected project stops, in red, at the approval step.
export function Stepper({ stage }) {
  const rejected = stage === 'REJECTED'
  const current = rejected ? 3 : STAGES.findIndex(([key]) => key === stage)
  return (
    <ol className="stepper">
      {STAGES.map(([key, label], index) => {
        const state = index < current ? 'done' : index === current ? (rejected ? 'stopped' : 'current') : 'todo'
        return (
          <li key={key} className={`step step-${state}`}>
            <span className="step-dot">
              {state === 'done' && <Icon name="check" size={14} />}
              {state === 'stopped' && '!'}
            </span>
            <span className="step-label">{rejected && index === current ? 'Rejected' : label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function ProjectSelect({ value, onChange, filter, placeholder = 'Select a project' }) {
  const { data, error } = useFetch('/projects/?page_size=200')
  const projects = (data?.results || []).filter(filter || (() => true))
  return (
    <>
      <select className="input" value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{data ? placeholder : error ? 'Could not load projects' : 'Loading…'}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.code} · {project.name}</option>
        ))}
      </select>
      {data && projects.length === 0 && (
        <p className="field-hint">No projects yet. <Link to="/projects/register">Register a project</Link> first.</p>
      )}
    </>
  )
}

export function Modal({ title, subtitle, children, onClose, actions }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="modal-mark">!</span>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

// Centred result card used by the "complete / submitted / approved / rejected" screens.
export function ResultCard({ kind = 'success', title, text, rows, children }) {
  return (
    <section className="card result">
      <span className={`result-mark result-${kind}`}>
        {kind === 'error' ? '✕' : kind === 'pending' ? <Icon name="clock" size={26} /> : <Icon name="check" size={26} />}
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="result-details"><DetailList rows={rows} /></div>
      <div className="result-actions">{children}</div>
    </section>
  )
}
