import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Card, Chip, ErrorState, Icon, Loading, PageHeader } from '../../components/ui.jsx'
import { useReference } from '../../network.js'
import { useFetch } from '../../utils.js'

export function JoinButton({ community, onChange }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search } })
      return
    }
    setBusy(true)
    try {
      onChange(await api.post(`/communities/${community.slug}/${community.is_member ? 'leave' : 'join'}/`))
    } finally {
      setBusy(false)
    }
  }
  return (
    <button className={`btn ${community.is_member ? '' : 'btn-primary'}`} onClick={toggle} disabled={busy}>
      {community.is_member ? 'Leave' : 'Join'}
    </button>
  )
}

function CommunityCard({ community, onChange }) {
  return (
    <article className="card community-card">
      <div className="card-body">
        <h3><Link to={`/communities/${community.slug}`}>{community.name}</Link></h3>
        <p className="muted">{community.description}</p>
        <div className="chips">{community.actor_types.map((a) => <Chip key={a.key} color="gray">{a.label}</Chip>)}</div>
        <div className="community-foot">
          <small className="muted">{community.member_count} member{community.member_count === 1 ? '' : 's'} · {community.post_count} post{community.post_count === 1 ? '' : 's'}</small>
          <JoinButton community={community} onChange={onChange} />
        </div>
      </div>
    </article>
  )
}

// Communities, grouped under the four "Access to" pillars, plus catalogues & brochures.
export default function Communities() {
  const reference = useReference()
  const [params, setParams] = useSearchParams()
  const pillar = params.get('pillar') || ''
  const { data, error, reload } = useFetch('/communities/')
  const [overrides, setOverrides] = useState({})

  if (error) return <ErrorState error={error} retry={reload} />
  if (!data || !reference) return <Loading />
  const communities = data.map((c) => overrides[c.slug] || c)
  const pillars = reference.pillars.filter((p) => !pillar || p.key === pillar)
  const update = (fresh) => setOverrides((current) => ({ ...current, [fresh.slug]: fresh }))

  return (
    <>
      <PageHeader crumb="Investment network / Communities" title="Communities"
        subtitle="Peer networks, knowledge circles and investment services for Nepal's Digital/AI economy." />

      <div className="tabs-mini">
        <button className={!pillar ? 'on' : ''} onClick={() => setParams({})}>All</button>
        {reference.pillars.map((p) => (
          <button key={p.key} className={pillar === p.key ? 'on' : ''} onClick={() => setParams({ pillar: p.key })}>{p.label}</button>
        ))}
      </div>

      {(!pillar || pillar === 'information') && (
        <Card title="Catalogues, dashboards & brochures">
          <ul className="resources">
            {reference.resources.map((r) => (
              <li key={r.url + r.kind}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} <Icon name="external" size={13} /></a>
                <Chip color="gray">{r.kind}</Chip>
              </li>
            ))}
          </ul>
          <p className="note">Inside the platform: <Link to="/portfolios">all portfolio collections</Link> · <Link to="/network">dashboard</Link></p>
        </Card>
      )}

      {pillars.map((p) => (
        <section key={p.key} className="stack">
          <div className="section-head"><div><h2>{p.label}</h2><p className="muted">{p.description}</p></div></div>
          <div className="pcards pcards-grid">
            {communities.filter((c) => c.pillar === p.key).map((c) => <CommunityCard key={c.slug} community={c} onChange={update} />)}
          </div>
        </section>
      ))}
    </>
  )
}
