import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { copyText, nrsBillion, portfolioUrl, shareLink, useCompare } from '../network.js'
import { Chip, Icon } from './ui.jsx'

const CHANNELS = [['copy', 'Copy link'], ['whatsapp', 'WhatsApp'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['x', 'X']]

// The Share button and its menu. Records the share so the dashboard can count it.
export function ShareButton({ portfolio, onShared, label = 'Share' }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => box.current && !box.current.contains(event.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const share = async (channel) => {
    const url = portfolioUrl(portfolio.id)
    if (channel === 'copy') {
      setCopied(await copyText(url))
      setTimeout(() => setCopied(false), 2000)
    } else {
      window.open(shareLink(channel, url, portfolio.name), '_blank', 'noopener,noreferrer')
    }
    setOpen(false)
    try {
      onShared?.(await api.post(`/portfolios/${portfolio.id}/share/`, { channel }))
    } catch {
      /* counting is best-effort */
    }
  }

  return (
    <span className="share" ref={box}>
      <button type="button" className="act" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Icon name="share" size={16} /> {copied ? 'Link copied' : label}
      </button>
      {open && (
        <div className="menu share-menu" role="menu">
          {CHANNELS.map(([key, text]) => (
            <button key={key} role="menuitem" type="button" onClick={() => share(key)}>{text}</button>
          ))}
        </div>
      )}
    </span>
  )
}

// Like · Comment · Share · Compare, with live counts.
export function ActionBar({ portfolio, onChange, commentHref }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const compare = useCompare()
  const [counts, setCounts] = useState({ likes: portfolio.likes, comments: portfolio.comments, shares: portfolio.shares })
  const [liked, setLiked] = useState(Boolean(portfolio.liked))
  const [busy, setBusy] = useState(false)
  const inCompare = compare.ids.includes(portfolio.id)

  useEffect(() => {
    setCounts({ likes: portfolio.likes, comments: portfolio.comments, shares: portfolio.shares })
    setLiked(Boolean(portfolio.liked))
  }, [portfolio.id, portfolio.likes, portfolio.comments, portfolio.shares, portfolio.liked])

  const update = (data) => {
    setCounts({ likes: data.likes, comments: data.comments, shares: data.shares })
    if ('liked' in data) setLiked(data.liked)
    onChange?.(data)
  }

  const like = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search } })
      return
    }
    setBusy(true)
    try {
      update(liked ? await api.delete(`/portfolios/${portfolio.id}/like/`) : await api.post(`/portfolios/${portfolio.id}/like/`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="engage">
      <div className="engage-counts">
        <span><Icon name="heart" size={13} /> {counts.likes}</span>
        <span>{counts.comments} comment{counts.comments === 1 ? '' : 's'} · {counts.shares} share{counts.shares === 1 ? '' : 's'}</span>
      </div>
      <div className="engage-actions">
        <button type="button" className={`act ${liked ? 'act-on' : ''}`} onClick={like} disabled={busy} aria-pressed={liked}>
          <Icon name="heart" size={16} /> {liked ? 'Liked' : 'Like'}
        </button>
        <Link className="act" to={commentHref || `/portfolios/${portfolio.id}#comments`}>
          <Icon name="comment" size={16} /> Comment
        </Link>
        <ShareButton portfolio={portfolio} onShared={update} />
        <button type="button" className={`act ${inCompare ? 'act-on' : ''}`} aria-pressed={inCompare}
          disabled={!inCompare && compare.full} title={!inCompare && compare.full ? 'You can compare up to 4 portfolios' : ''}
          onClick={() => compare.toggle(portfolio.id)}>
          <Icon name="compare" size={16} /> {inCompare ? 'Comparing' : 'Compare'}
        </button>
      </div>
    </div>
  )
}

export function CollectionChip({ portfolio }) {
  const tone = { sdg_intervention: 'blue', sdg_indicator: 'blue', nap: 'green', sovereign: 'amber', draft: 'gray', member: 'green' }
  return <Chip color={tone[portfolio.collection] || 'gray'}>{portfolio.collection_display}</Chip>
}

export default function PortfolioCard({ portfolio, extra }) {
  return (
    <article className="card pcard">
      <div className="card-body">
        <div className="pcard-tags">
          <CollectionChip portfolio={portfolio} />
          {portfolio.primary_sdg && <Chip color="blue">SDG {portfolio.primary_sdg}</Chip>}
          {portfolio.stage !== 'REGISTERED' && <Chip>{portfolio.stage_display}</Chip>}
        </div>
        <h3><Link to={`/portfolios/${portfolio.id}`}>{portfolio.name}</Link></h3>
        <p className="pcard-meta">
          {[portfolio.category, portfolio.reference || portfolio.code].filter(Boolean).join(' · ')}
        </p>
        {portfolio.summary && <p className="pcard-summary">{portfolio.summary}</p>}
        {portfolio.total_investment && (
          <p className="pcard-money"><strong>{nrsBillion(portfolio.total_investment)}</strong> investment need</p>
        )}
        {extra}
      </div>
      <ActionBar portfolio={portfolio} />
    </article>
  )
}
