import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'
import PortfolioCard from '../../components/PortfolioCard.jsx'
import { Card, Empty, ErrorState, Loading } from '../../components/ui.jsx'
import { ago, useFetch } from '../../utils.js'

const fmt = (n) => Number(n || 0).toLocaleString('en-US')

export function ActivityItem({ item }) {
  if (item.type === 'portfolio') {
    const p = item.portfolio
    return (
      <li className="feed-item">
        <span className="feed-dot feed-dot-portfolio" />
        <div>
          <div className="feed-line">
            New <strong>{p.collection_display}</strong> portfolio: <Link to={`/portfolios/${p.id}`}>{p.name}</Link>
          </div>
          <small className="muted">{[p.category, ago(item.at)].filter(Boolean).join(' · ')}</small>
        </div>
      </li>
    )
  }
  const where = item.type === 'comment'
    ? <>commented on <Link to={`/portfolios/${item.portfolio.id}#comments`}>{item.portfolio.name}</Link></>
    : <>posted in <Link to={`/communities/${item.community.slug}`}>{item.community.name}</Link></>
  return (
    <li className="feed-item">
      <span className={`feed-dot feed-dot-${item.type}`} />
      <div>
        <div className="feed-line"><strong>{item.user_name}</strong>{item.user_actor && <span className="muted"> ({item.user_actor})</span>} {where}</div>
        <p className="feed-body">{item.body}</p>
        <small className="muted">{ago(item.at)}</small>
      </div>
    </li>
  )
}

// Public landing page and activity feed ("Feed" in the prototype).
export default function Feed() {
  const { user } = useAuth()
  const [scope, setScope] = useState('all')
  const overview = useFetch('/network/overview/')
  const feed = useFetch(`/network/feed/${scope === 'following' ? '?scope=following' : ''}`)
  const data = overview.data

  if (overview.error) return <ErrorState error={overview.error} retry={overview.reload} />
  if (!data) return <Loading />

  return (
    <>
      <section className="hero">
        <h1>Nepal&apos;s Digital/AI economy investment network</h1>
        <p>
          Discover {fmt(data.portfolios)} investment portfolios across SDGs, climate adaptation, sovereign Digital/AI
          infrastructure and startup opportunities. Follow, compare and get matched with the right partners.
        </p>
        <div className="hero-actions">
          {user ? <Link className="btn" to="/recommended">Recommended for you</Link> : <Link className="btn" to="/join">Join free</Link>}
          <Link className="btn btn-ghost" to="/portfolios">Browse portfolios</Link>
        </div>
        <div className="hero-stats">
          <div><span>Portfolios</span><strong>{fmt(data.portfolios)}</strong></div>
          <div>
            <span>SDG investment</span><strong>{fmt(data.sdg_investment_billion)}</strong>
            <small>NRs billion, {data.sdg_count} SDGs</small>
          </div>
          <div><span>Members</span><strong>{fmt(data.members)}</strong></div>
          <div><span>Communities</span><strong>{fmt(data.communities)}</strong></div>
        </div>
      </section>

      <Card title="Portfolio collections">
        <div className="tiles">
          {data.collections.map((c) => (
            <Link key={c.key} className="tile" to={`/portfolios?collection=${c.key}`}>
              <span>{c.label}</span>
              <strong>{fmt(c.count)}</strong>
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Access to">
        <div className="pillars">
          {data.pillars.map((p) => (
            <Link key={p.key} className="pillar" to={`/communities?pillar=${p.key}`}>
              <strong>{p.label}</strong>
              <span>{p.description}</span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="split split-wide">
        <div className="stack-lg">
          <div className="section-head"><h2>Most engaged portfolios</h2><Link to="/portfolios?sort=liked">See all</Link></div>
          {data.most_engaged.length === 0 ? <Card><Empty>No portfolios yet.</Empty></Card> : (
            <div className="pcards">
              {data.most_engaged.map((p) => <PortfolioCard key={p.id} portfolio={p} />)}
            </div>
          )}
        </div>

        <Card title="Latest activity" action={user && (
          <div className="tabs-mini">
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Everything</button>
            <button className={scope === 'following' ? 'on' : ''} onClick={() => setScope('following')}>Following</button>
          </div>
        )}>
          {feed.error ? <ErrorState error={feed.error} retry={feed.reload} /> : !feed.data ? <Loading /> :
            feed.data.length === 0 ? (
              <Empty>{scope === 'following'
                ? <>Nothing yet. <Link to="/profile">Choose SDGs and collections to follow</Link> or join a community.</>
                : 'No activity yet.'}</Empty>
            ) : (
              <ul className="feed">{feed.data.slice(0, 12).map((item, i) => <ActivityItem key={`${item.type}-${i}`} item={item} />)}</ul>
            )}
        </Card>
      </div>
    </>
  )
}
