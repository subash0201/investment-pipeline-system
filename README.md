# Investment Pipeline Tracking Database System (IPTDS)

Tracks projects from registration to the investment registry: SDG tagging, readiness scoring,
stage requests with admin approval, and a registry of investment-ready projects — plus a public
**investment network** (following the jtech Invest prototype `investment_portfolio_v1.1`):
portfolio collections, likes / comments / shares, compare, communities, a members directory,
recommendations, investment-service requests and a network dashboard.

**Deploying to a server:** see [DEPLOYMENT.md](DEPLOYMENT.md).

- **backend/** — Django REST API (Python, Django REST Framework, PostgreSQL)
- **frontend/** — React single-page app (Vite, React Router)

The screens follow the Figma wireframe `IPTS_All_Screens_Desktop` (screens 100–333).

## Run it

Two terminals.

**1. API** (Python 3.12+, PostgreSQL 14+)

Create the database once, then put your PostgreSQL password in `backend/.env`
(`DJANGO_DEBUG=1` there for local development):

```bash
createdb -U postgres iptds         # or in psql: CREATE DATABASE iptds;
cp backend/.env.example backend/.env   # Windows: copy — then edit POSTGRES_PASSWORD
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd investment_pipeline
python manage.py migrate
python manage.py seed_demo         # demo accounts and sample projects
python manage.py runserver         # http://127.0.0.1:8000
```

**2. Web app** (Node 18+)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```



## How a project moves through the pipeline

```
Draft → Registered → Under Review → Pending Approval → Approved → Investment Ready → Listed in Registry
                                          └→ Rejected → (resubmit) → Under Review
```

| Move | Who | Conditions |
|------|-----|------------|
| Draft → Registered | Owner, immediately | Name, and a description of 30+ characters |
| Registered → Under Review | Owner requests, admin approves | No other open request |
| Under Review → Pending Approval | Owner requests | SDGs tagged, score entered, latest score ≥ 70, no open request |
| Pending Approval → Approved / Rejected | Admin decides | A reason is required to reject |
| Rejected → Under Review | Owner requests, admin approves | No other open request |
| Approved → Investment Ready | Owner, immediately | Latest score ≥ 70 |
| Investment Ready → Listed in Registry | Admin adds a registry entry | — |

Requesting to leave Under Review places the project in Pending Approval while the admin decides.
Delisting or deleting a registry entry returns the project to Investment Ready. Browse (250) shows
projects whose registry entry is *Listed*. The threshold is `READINESS_THRESHOLD` in `settings.py`.

These rules live in `backend/investment_pipeline/core/workflow.py`.

## Screens

| Wireframe | Route | File (`frontend/src/pages/`) |
|-----------|-------|------------------------------|
| 100, 101 Login / error | `/login` | `Login.jsx` |
| 200 User Home | `/home` | `user/Home.jsx` |
| 210 My Projects | `/projects` | `user/MyProjects.jsx` |
| 211–214 Register, confirm, complete, error | `/projects/register` | `user/RegisterProject.jsx` |
| 220 SDG Tracking | `/sdg` | `user/SdgTracking.jsx` |
| 221 SDG Dashboard | `/sdg/dashboard` | `user/SdgDashboard.jsx` |
| 230 Readiness Score | `/score` | `user/ReadinessScore.jsx` |
| 231 Score Saved | `/score/saved` | `user/ScoreSaved.jsx` |
| 240 Pipeline Stage | `/pipeline` | `user/PipelineStage.jsx` |
| 241 Request Stage Update | `/pipeline/request` | `user/RequestStageUpdate.jsx` |
| 242 Request Submitted | `/pipeline/submitted/:id` | `user/RequestSubmitted.jsx` |
| 250 Browse Projects | `/browse` | `user/Browse.jsx` |
| 251 Project Details | `/browse/:id`, `/projects/:id` | `user/ProjectDetails.jsx` |
| 300 Admin Home | `/admin` | `admin/AdminHome.jsx` |
| 310 Summary Dashboard | `/admin/summary` | `admin/SummaryDashboard.jsx` |
| 320, 323 Registry list, delete | `/admin/registry` | `admin/Registry.jsx` |
| 321, 322 Add / edit entry | `/admin/registry/new`, `/admin/registry/:id/edit` | `admin/RegistryForm.jsx` |
| 330 Stage Approvals | `/admin/approvals` | `admin/Approvals.jsx` |
| 331–333 Review, approved, rejected | `/admin/approvals/:id` | `admin/ReviewRequest.jsx` |

See `backend/README.md` for the API and `frontend/README.md` for the app structure.

## Investment network

Open to visitors without signing in (starred items need an account):

| Screen | Route | File (`frontend/src/pages/network/`) |
|--------|-------|--------------------------------------|
| Feed — landing page, collections, "Access to" pillars, activity | `/` | `Feed.jsx` |
| All portfolios — search, collection, SDG, sort (Newest, Largest investment, Most liked, Most discussed, A–Z, Oldest) | `/portfolios` | `Portfolios.jsx` |
| Portfolio — costing, sections, SDG alignment, comments | `/portfolios/:id` | `Portfolio.jsx` |
| Edit portfolio profile * (owner or admin) | `/portfolios/:id/edit` | `PortfolioEditor.jsx` |
| Compare up to 4 portfolios | `/compare` | `Compare.jsx` |
| Communities and catalogues & brochures | `/communities`, `/communities/:slug` | `Communities.jsx`, `Community.jsx` |
| Investment portfolio dashboard | `/network` | `NetworkDashboard.jsx` |
| Join (13 actor types, SDG interests, collections to follow) | `/join` | `Join.jsx` |
| Recommended for you * | `/recommended` | `Recommended.jsx` |
| Members & actors * | `/members` | `Members.jsx` |
| Investment services * (members request, admins work the queue) | `/services` | `ServiceRequests.jsx` |
| Edit profile * | `/profile` | `Profile.jsx` |

How it fits the pipeline:

- Every project past **Draft** is a public portfolio. Projects members register are in the
  *Member Portfolio* collection; administrators can place portfolios in the catalogue collections
  (SDG Intervention, SDG Indicator, Climate NAP 2021–2050, Digital/AI Sovereign, Draft Portfolio).
- The portfolio profile (category, sector, reference, primary SDG, costing in NRs, and the written
  sections — purpose, objectives, risk register…) stays editable after registration; the name and
  description stay draft-only, as before.
- Catalogue data is loaded with `python manage.py import_portfolios <file.json|csv>`.
- Recommendations score each portfolio on the member's actor type (an actor × collection affinity
  matrix blended with real engagement), SDG interests, followed collections and popularity.
