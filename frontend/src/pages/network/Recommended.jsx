import { Link } from 'react-router-dom'
import PortfolioCard from '../../components/PortfolioCard.jsx'
import { Banner, Card, Empty, ErrorState, Loading, PageHeader } from '../../components/ui.jsx'
import { useFetch } from '../../utils.js'

// "Recommended for you": portfolios matched to the member's actor type, SDG interests and followed collections.
export default function Recommended() {
  const { data, error, reload } = useFetch('/recommendations/?limit=24')

  return (
    <>
      <PageHeader crumb="Investment network / Recommended" title="Recommended for you"
        subtitle="Matched on your actor type, the SDGs you care about, the collections you follow and what members engage with." />
      {data && !data.profile_complete && (
        <Banner kind="info">
          Recommendations get better when your profile says what kind of member you are and what you follow.{' '}
          <Link to="/profile">Complete your profile</Link>
        </Banner>
      )}
      {error ? <ErrorState error={error} retry={reload} /> : !data ? <Loading /> : data.results.length === 0 ? (
        <Card><Empty>No portfolios to recommend yet.</Empty></Card>
      ) : (
        <div className="pcards pcards-grid">
          {data.results.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} extra={(
              <div className="match">
                <strong>{p.match}% match</strong>
                {p.reasons.length > 0 && <ul>{p.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
              </div>
            )} />
          ))}
        </div>
      )}
    </>
  )
}
