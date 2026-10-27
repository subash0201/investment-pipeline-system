import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { ActionBar, CollectionChip } from '../../components/PortfolioCard.jsx'
import { Banner, Card, Chip, DetailList, Empty, ErrorState, Icon, Loading, PageHeader, ScoreBar } from '../../components/ui.jsx'
import { nrsBillion, pct } from '../../network.js'
import { ago, fmtDate, useFetch } from '../../utils.js'

function Costing({ p }) {
  if (!p.total_investment) {
    return <p className="muted">No cost figure has been published for this portfolio yet.</p>
  }
  const parts = [
    ['Conventional investment', p.conventional_investment, 'soft'],
    ['Digital investment', p.digital_investment, 'blue'],
    ['Artificial Intelligence (AI) investment', p.ai_investment, 'green'],
  ].filter(([, value]) => value)
  return (
    <>
      <div className="big-money">{nrsBillion(p.total_investment)}</div>
      <p className="note">{p.costing_period ? `Annual average costing, ${p.costing_period}` : 'Total investment need'} · {p.currency}</p>
      {parts.length > 0 && (
        <div className="ranked">
          {parts.map(([label, value, tone]) => (
            <div key={label}>
              <div><span>{label}</span><span>{nrsBillion(value)} · {pct(value, p.total_investment)}%</span></div>
              <div className="bar bar-lg"><div className={`bar-fill bar-${tone}`} style={{ width: `${pct(value, p.total_investment)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Comments({ portfolio, onCount }) {
  const { user } = useAuth()
  const location = useLocation()
  const { data, error, reload } = useFetch(`/portfolios/${portfolio.id}/comments/`)
  const [body, setBody] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const post = async (event) => {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      await api.post(`/portfolios/${portfolio.id}/comments/`, { body })
      setBody('')
      reload()
      onCount?.(1)
    } catch (failure) {
      setProblem(failure.field?.('body') || failure.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    await api.delete(`/comments/${id}/`)
    reload()
    onCount?.(-1)
  }

  return (
    <Card title="Comments" className="comments-card">
      <div id="comments" />
      {user ? (
        <form className="comment-form" onSubmit={post}>
          <Banner kind="error">{problem}</Banner>
          <textarea className="input" rows={3} placeholder="Share a question, an offer to collaborate or feedback…"
            value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          <div className="form-actions end"><button className="btn btn-primary" disabled={busy || !body.trim()}>Post comment</button></div>
        </form>
      ) : (
        <p className="muted"><Link to="/login" state={{ from: location.pathname }}>Log in</Link> to comment.</p>
      )}
      {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.length === 0 ? (
        <p className="muted">No comments yet.</p>
      ) : (
        <ul className="comments">
          {data.map((c) => (
            <li key={c.id}>
              <div className="comment-head">
                <strong>{c.user_name}</strong>{c.user_actor && <span className="muted"> · {c.user_actor}</span>}
                <span className="muted"> · {ago(c.created_at)}</span>
                {c.can_delete && <button className="link link-danger" onClick={() => remove(c.id)}>Delete</button>}
              </div>
              <p className="pre">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// One portfolio record: summary, costing, SDG alignment, the written sections and discussion.
export default function Portfolio() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: p, error, reload } = useFetch(`/portfolios/${id}/`)
  const [extra, setExtra] = useState(0)
  useEffect(() => setExtra(0), [id])
  useEffect(() => {
    if (p && window.location.hash === '#comments') document.getElementById('comments')?.scrollIntoView()
  }, [p])

  if (error) return <ErrorState error={error} retry={reload} />
  if (!p) return <Loading />
  const counted = { ...p, comments: p.comments + extra }

  return (
    <>
      <PageHeader crumb={<><Link to="/portfolios">Portfolios</Link> / {p.collection_display}</>} title={p.name}
        subtitle={[p.category, p.reference || p.code, `Portfolio #${p.id}`].filter(Boolean).join(' · ')}>
        {p.can_manage && <Link className="btn" to={`/portfolios/${p.id}/edit`}><Icon name="edit" size={16} /> Edit portfolio</Link>}
        <Link className="btn btn-primary" to={user ? `/services?project=${p.id}` : '/login'} state={user ? undefined : { from: `/services?project=${p.id}` }}>
          Request a service
        </Link>
      </PageHeader>

      <div className="split split-wide">
        <div className="stack-lg">
          <section className="card">
            <div className="card-body">
              <div className="chips">
                <CollectionChip portfolio={p} />
                {p.primary_sdg && <Chip color="blue">SDG {p.primary_sdg} · {p.primary_sdg_name}</Chip>}
                <Chip>{p.stage_display}</Chip>
                {p.registry_status && <Chip color="green">Registry: {p.registry_status}</Chip>}
              </div>
              <p className="pre description">{p.description || 'No summary yet.'}</p>
            </div>
            <ActionBar portfolio={counted} commentHref="#comments" />
          </section>

          <Card title="Portfolio details">
            {p.sections.length === 0 ? <Empty>No detailed sections have been published yet.</Empty> : (
              <div className="accordion">
                {p.sections.map((section, index) => (
                  <details key={section.key} open={index < 2}>
                    <summary>{section.label}</summary>
                    <p className="pre">{section.text}</p>
                  </details>
                ))}
              </div>
            )}
          </Card>

          <Comments portfolio={p} onCount={(n) => setExtra((value) => value + n)} />
        </div>

        <div className="stack-lg">
          <Card title="Annual average costing"><Costing p={p} /></Card>
          <Card title="Key facts">
            <DetailList rows={[
              ['Collection', p.collection_display],
              ['Sector', p.sector || '—'],
              ['Category', p.category || '—'],
              ['Reference', p.reference || p.code],
              ['Posted by', p.owner_name],
              ['Registered', fmtDate(p.registration_date)],
              ['Pipeline stage', p.stage_display],
            ]} />
          </Card>
          <Card title="Readiness score">
            {p.score === null ? <p className="muted">Not yet scored.</p> : (
              <>
                <div className="big-score">{p.score}<small>/ 100</small></div>
                <ScoreBar value={p.score} marker />
              </>
            )}
          </Card>
          <Card title="SDG alignment">
            {p.sdg_alignment.length === 0 ? <p className="muted">No SDGs tagged yet.</p> : (
              <ul className="alignment">
                {p.sdg_alignment.map((goal) => (
                  <li key={goal.goal}>
                    <span>{goal.goal}</span>
                    <div className="grow">
                      <strong>{goal.name}</strong>
                      <small>{goal.primary ? 'Primary SDG' : 'Secondary SDG'}</small>
                      {goal.indicators.map((indicator) => (
                        <div key={indicator.name} className="indicator-mini">
                          <small>{indicator.name} — {indicator.progress}%</small>
                          <ScoreBar value={indicator.progress} />
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
