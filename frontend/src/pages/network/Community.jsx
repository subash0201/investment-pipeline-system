import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Banner, Card, Chip, Empty, ErrorState, Loading, PageHeader } from '../../components/ui.jsx'
import { ago, useFetch } from '../../utils.js'
import { JoinButton } from './Communities.jsx'

// One community: what it is for, its posts, and (for signed-in users) its members.
export default function Community() {
  const { slug } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const loaded = useFetch(`/communities/${slug}/`)
  const posts = useFetch(`/communities/${slug}/posts/`)
  const members = useFetch(user ? `/communities/${slug}/members/` : null)
  const [community, setCommunity] = useState(null)
  const [body, setBody] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setCommunity(loaded.data), [loaded.data])

  if (loaded.error) return <ErrorState error={loaded.error} retry={loaded.reload} />
  if (!community) return <Loading />

  const changed = (fresh) => {
    setCommunity(fresh)
    members.reload()
  }

  const post = async (event) => {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      await api.post(`/communities/${slug}/posts/`, { body })
      setBody('')
      posts.reload()
      setCommunity({ ...community, post_count: community.post_count + 1 })
    } catch (failure) {
      setProblem(failure.field?.('body') || failure.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    await api.delete(`/posts/${id}/`)
    posts.reload()
    setCommunity({ ...community, post_count: community.post_count - 1 })
  }

  return (
    <>
      <PageHeader crumb={<><Link to="/communities">Communities</Link> / {community.pillar_display}</>} title={community.name}
        subtitle={`${community.member_count} members · ${community.post_count} posts`}>
        {community.pillar === 'investment' && user && <Link className="btn" to={`/services?community=${slug}`}>Request a service</Link>}
        <JoinButton community={community} onChange={changed} />
      </PageHeader>

      <div className="split split-wide">
        <div className="stack-lg">
          <Card title="Posts">
            {user && community.is_member && (
              <form className="comment-form" onSubmit={post}>
                <Banner kind="error">{problem}</Banner>
                <textarea className="input" rows={3} placeholder="Share an opportunity, a question or an update…"
                  value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
                <div className="form-actions end"><button className="btn btn-primary" disabled={busy || !body.trim()}>Post</button></div>
              </form>
            )}
            {!user && <p className="muted"><Link to="/login" state={{ from: location.pathname }}>Log in</Link> and join to post.</p>}
            {user && !community.is_member && <p className="muted">Join this community to post.</p>}
            {posts.error ? <ErrorState error={posts.error} retry={posts.reload} /> : !posts.data ? <Loading /> :
              posts.data.length === 0 ? <Empty>No posts yet.</Empty> : (
                <ul className="comments">
                  {posts.data.map((p) => (
                    <li key={p.id}>
                      <div className="comment-head">
                        <strong>{p.author_name}</strong>{p.author_actor && <span className="muted"> · {p.author_actor}</span>}
                        <span className="muted"> · {ago(p.created_at)}</span>
                        {p.can_delete && <button className="link link-danger" onClick={() => remove(p.id)}>Delete</button>}
                      </div>
                      <p className="pre">{p.body}</p>
                      {p.project && <Link className="chip chip-blue" to={`/portfolios/${p.project}`}>{p.project_name}</Link>}
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>

        <div className="stack-lg">
          <Card title="About">
            <p className="muted">{community.description}</p>
            <div className="chips">{community.actor_types.map((a) => <Chip key={a.key} color="gray">{a.label}</Chip>)}</div>
          </Card>
          <Card title="Members">
            {!user ? <p className="muted">Log in to see who is here.</p> : !members.data ? <Loading /> :
              members.data.length === 0 ? <p className="muted">No members yet — be the first.</p> : (
                <ul className="people">
                  {members.data.map((m) => (
                    <li key={m.id}><strong>{m.name}</strong><small>{[m.actor_type_display, m.organization].filter(Boolean).join(' · ')}</small></li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      </div>
    </>
  )
}
