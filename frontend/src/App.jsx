import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/user/Home.jsx'
import MyProjects from './pages/user/MyProjects.jsx'
import RegisterProject from './pages/user/RegisterProject.jsx'
import SdgTracking from './pages/user/SdgTracking.jsx'
import SdgDashboard from './pages/user/SdgDashboard.jsx'
import ReadinessScore from './pages/user/ReadinessScore.jsx'
import ScoreSaved from './pages/user/ScoreSaved.jsx'
import PipelineStage from './pages/user/PipelineStage.jsx'
import RequestStageUpdate from './pages/user/RequestStageUpdate.jsx'
import RequestSubmitted from './pages/user/RequestSubmitted.jsx'
import Browse from './pages/user/Browse.jsx'
import ProjectDetails from './pages/user/ProjectDetails.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import SummaryDashboard from './pages/admin/SummaryDashboard.jsx'
import Registry from './pages/admin/Registry.jsx'
import RegistryForm from './pages/admin/RegistryForm.jsx'
import Approvals from './pages/admin/Approvals.jsx'
import ReviewRequest from './pages/admin/ReviewRequest.jsx'
import Feed from './pages/network/Feed.jsx'
import Portfolios from './pages/network/Portfolios.jsx'
import Portfolio from './pages/network/Portfolio.jsx'
import PortfolioEditor from './pages/network/PortfolioEditor.jsx'
import Compare from './pages/network/Compare.jsx'
import Communities from './pages/network/Communities.jsx'
import Community from './pages/network/Community.jsx'
import Members from './pages/network/Members.jsx'
import Recommended from './pages/network/Recommended.jsx'
import NetworkDashboard from './pages/network/NetworkDashboard.jsx'
import ServiceRequests from './pages/network/ServiceRequests.jsx'
import Profile from './pages/network/Profile.jsx'
import Join from './pages/network/Join.jsx'

// Lets a signed-in user through (of the given role, if one is named); everyone else is redirected.
function Guard({ role }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

function NotFound() {
  const { user } = useAuth()
  return <Navigate to={user ? homeFor(user) : '/'} replace />
}

// Screen numbers refer to the wireframe (IPTS_All_Screens_Desktop); the investment
// network screens follow the jtech Invest prototype (investment_portfolio_v1.1).
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />{/* 100, 101 */}
      <Route path="/join" element={<Join />} />

      <Route element={<Layout />}>
        {/* Investment network — public */}
        <Route path="/" element={<Feed />} />
        <Route path="/portfolios" element={<Portfolios />} />
        <Route path="/portfolios/:id" element={<Portfolio />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/communities/:slug" element={<Community />} />
        <Route path="/network" element={<NetworkDashboard />} />

        {/* Investment network — any signed-in member */}
        <Route element={<Guard />}>
          <Route path="/recommended" element={<Recommended />} />
          <Route path="/members" element={<Members />} />
          <Route path="/services" element={<ServiceRequests />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/portfolios/:id/edit" element={<PortfolioEditor />} />
        </Route>

        <Route element={<Guard role="USER" />}>
          <Route path="/home" element={<Home />} />{/* 200 */}
          <Route path="/projects" element={<MyProjects />} />{/* 210 */}
          <Route path="/projects/register" element={<RegisterProject />} />{/* 211–214 */}
          <Route path="/projects/:id" element={<ProjectDetails from="projects" />} />
          <Route path="/sdg" element={<SdgTracking />} />{/* 220 */}
          <Route path="/sdg/dashboard" element={<SdgDashboard />} />{/* 221 */}
          <Route path="/score" element={<ReadinessScore />} />{/* 230 */}
          <Route path="/score/saved" element={<ScoreSaved />} />{/* 231 */}
          <Route path="/pipeline" element={<PipelineStage />} />{/* 240 */}
          <Route path="/pipeline/request" element={<RequestStageUpdate />} />{/* 241 */}
          <Route path="/pipeline/submitted/:id" element={<RequestSubmitted />} />{/* 242 */}
          <Route path="/browse" element={<Browse />} />{/* 250 */}
          <Route path="/browse/:id" element={<ProjectDetails from="browse" />} />{/* 251 */}
        </Route>

        <Route element={<Guard role="ADMIN" />}>
          <Route path="/admin" element={<AdminHome />} />{/* 300 */}
          <Route path="/admin/summary" element={<SummaryDashboard />} />{/* 310 */}
          <Route path="/admin/registry" element={<Registry />} />{/* 320, 323 */}
          <Route path="/admin/registry/new" element={<RegistryForm />} />{/* 321 */}
          <Route path="/admin/registry/:id/edit" element={<RegistryForm />} />{/* 322 */}
          <Route path="/admin/approvals" element={<Approvals />} />{/* 330 */}
          <Route path="/admin/approvals/:id" element={<ReviewRequest />} />{/* 331–333 */}
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
