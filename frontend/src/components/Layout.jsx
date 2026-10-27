import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../auth.jsx'
import { useCompare } from '../network.js'
import { Icon } from './ui.jsx'

// The investment network — open to visitors; starred items need an account.
const NETWORK_NAV = [
  ['/', 'Feed', 'feed', true],
  ['/portfolios', 'Portfolios', 'grid'],
  ['/recommended', 'Recommended for you', 'sparkle', false, true],
  ['/communities', 'Communities', 'users'],
  ['/members', 'Members & actors', 'user', false, true],
  ['/compare', 'Compare', 'compare'],
  ['/network', 'Dashboard', 'chart'],
  ['/services', 'Investment services', 'briefcase', false, true],
]

const USER_NAV = [
  ['/home', 'Home', 'home'],
  ['/projects', 'My Projects', 'folder'],
  ['/projects/register', 'Register Project', 'plus'],
  ['/sdg', 'SDG Tracking', 'target'],
  ['/score', 'Readiness Score', 'gauge'],
  ['/pipeline', 'Pipeline Stage', 'flow'],
  ['/browse', 'Browse Projects', 'search'],
]

const ADMIN_NAV = [
  ['/admin', 'Admin Home', 'home', true],
  ['/admin/summary', 'Summary Dashboard', 'chart'],
  ['/admin/registry', 'Investment Registry', 'list'],
  ['/admin/approvals', 'Stage Approvals', 'check'],
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // "My Projects" also covers a single project's page, but not the registration wizard.
  const registering = location.pathname.startsWith('/projects/register')
  const [menu, setMenu] = useState(false)
  const compare = useCompare()
  const admin = user?.role === 'ADMIN'
  const initials = user ? user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() : ''

  useEffect(() => setMenu(false), [location.pathname])

  const signOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const item = ([to, label, icon, exact, needsLogin]) => {
    if (needsLogin && !user) return null
    return (
      <NavLink key={to} to={to} end={Boolean(exact)}
        className={({ isActive }) => `nav-item ${isActive && !(to === '/projects' && registering) ? 'active' : ''}`}>
        <Icon name={icon} />
        {label}
        {to === '/compare' && compare.ids.length > 0 && <span className="nav-count">{compare.ids.length}</span>}
      </NavLink>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">I</span>
          <span className="brand-name">Investment Pipeline Tracker</span>
        </Link>
        {user ? (
          <div className="account">
            <button className="account-btn" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>
              <span className="avatar">{initials}</span>
              <span className="account-text">
                <strong>{user.name}</strong>
                <small>{admin ? 'Admin' : user.actor_type_display || 'User'}</small>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            {menu && (
              <div className="menu" role="menu">
                <div className="menu-email">{user.email}</div>
                <button role="menuitem" onClick={() => navigate(homeFor(user))}>My workspace</button>
                <button role="menuitem" onClick={() => navigate('/profile')}>Edit profile</button>
                <button role="menuitem" onClick={signOut}>Log out</button>
              </div>
            )}
          </div>
        ) : (
          <div className="top-actions">
            <Link className="btn btn-sm-top" to="/login" state={{ from: location.pathname + location.search }}>Log in</Link>
            <Link className="btn btn-primary btn-sm-top" to="/join">Join free</Link>
          </div>
        )}
      </header>

      <nav className="sidebar" aria-label="Main">
        <div className="nav-title">Investment network</div>
        {NETWORK_NAV.map(item)}
        {user && (
          <>
            <div className="nav-title nav-title-gap">{admin ? 'Administration' : 'Workspace'}</div>
            {(admin ? ADMIN_NAV : USER_NAV).map(item)}
          </>
        )}
        <div className="nav-spacer" />
        {user ? (
          <button className="nav-item nav-logout" onClick={signOut}>
            <Icon name="logout" />
            Log out
          </button>
        ) : (
          <NavLink to="/join" className="nav-item"><Icon name="plus" />Join the network</NavLink>
        )}
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
