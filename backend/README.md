# Backend — Django REST API

Needs a PostgreSQL database: `CREATE DATABASE iptds;`, then copy `.env.example` to `.env`
and set `POSTGRES_PASSWORD`.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd investment_pipeline
python manage.py migrate
python manage.py seed_demo      # optional demo data
        Seeded 5 users and 17 projects. Password for every account: Passw0rd!
  User : sam.rivera@example.com
  Admin: alex.morgan@example.com
python manage.py runserver
python manage.py test core      # 50 tests (the PostgreSQL user needs CREATEDB)
```

## Layout (`investment_pipeline/core/`)

| File | Purpose |
|------|---------|
| `models.py` | User (email login, role, network profile), Project (with portfolio profile), StageHistory, ProjectSDG, SDGIndicator, ReadinessScore, StageRequest, RegistryEntry, RegistryActivity, PortfolioLike/Comment/Share, Community, CommunityMembership, CommunityPost, ServiceRequest |
| `network_views.py`, `network_serializers.py` | The investment-network API |
| `management/commands/import_portfolios.py` | Import catalogue portfolios from JSON/CSV |
| `workflow.py` | Stage transition rules, approval and rejection, registry ↔ stage syncing |
| `serializers.py`, `views.py`, `urls.py` | The API |
| `constants.py` | The 17 SDGs, actor types, collections, pillars, communities, portfolio sections, affinity matrix, catalogue links |
| `management/commands/seed_demo.py` | Demo data |
| `tests.py` | API tests |

## Authentication

`POST /api/auth/login/` with `{"email", "password"}` returns `{"token", "user"}`.
Send the token on every other request: `Authorization: Token <token>`.

## Endpoints (all under `/api/`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `auth/login/`, `auth/logout/` | |
| GET | `auth/me/` | Current user |
| GET | `sdg-goals/` | The 17 goals |
| GET, POST | `projects/` | Own projects (admins: all). Filters `search`, `stage`, `status`, `page`, `page_size`. POST `{name, description, submit}` — `submit: true` registers, `false` saves a draft |
| GET, PATCH, DELETE | `projects/{id}/` | Detail includes stage history, SDG alignment, registry listing and the next-step checklist. Only drafts can be changed or deleted |
| GET, PUT | `projects/{id}/sdgs/` | `{goals: [{goal, indicators: [{name, target_value, current_value, notes}]}]}` — PUT replaces all tags |
| GET, POST | `projects/{id}/scores/` | `{evaluation_date, score, remarks}` |
| GET | `sdg-dashboard/` | Tags and indicator progress per project |
| GET, POST | `stage-requests/` | POST `{project, to_stage, justification}`. Response says whether approval was required. Filter `status=pending|approved|rejected` |
| GET | `stage-requests/{id}/`, `stage-requests/counts/` | |
| POST | `stage-requests/{id}/approve/`, `.../reject/` | Admin. `{comments}` — required for reject |
| GET | `browse/` | Listed projects. Filters `search`, `sdg`, `min_score`, `ordering=-score|score|name` |
| GET, POST | `registry/` | Admin. Filters `search`, `status`, `ordering` |
| GET, PUT, PATCH, DELETE | `registry/{id}/` | Admin |
| GET | `registry/eligible/` | Admin. Investment Ready projects not yet listed |
| GET | `dashboard/user/`, `dashboard/admin/`, `dashboard/summary/` | Screens 200, 300, 310 |
| GET | `dashboard/summary/export/` | CSV download |
| GET | `health/` | `{"status": "ok"}` — for uptime monitors |

### Investment network (public unless marked *)

| Method | Path | Notes |
|--------|------|-------|
| POST | `auth/register/` | Join: `{first_name, last_name, email, password, actor_type, organization, headline, location, sdg_interests, followed_collections}` → `{token, user}`. Rate-limited |
| PATCH | `auth/me/` * | Edit own profile |
| GET | `reference/` | Actor types, collections, pillars, services, sections, SDGs, catalogue links, sorts |
| GET | `portfolios/` | Public portfolios. `q`, `collection`, `sdg`, `category`, `sort=newest|largest|liked|discussed|name|oldest`, `page`, `page_size` |
| GET | `portfolios/{id}/`, `portfolios/compare/?ids=1,2,3,4` | Detail with sections and costing; up to 4 side by side |
| POST, DELETE | `portfolios/{id}/like/` * | Returns `{liked, likes, comments, shares}` |
| GET, POST | `portfolios/{id}/comments/` | POST * `{body}`; `DELETE comments/{id}/` * (author or admin) |
| POST | `portfolios/{id}/share/` | `{channel: copy|whatsapp|facebook|linkedin|x}` — counts the share |
| GET | `communities/`, `communities/{slug}/` | `?pillar=information|knowledge|communities|investment` |
| POST | `communities/{slug}/join/`, `.../leave/` * | |
| GET, POST | `communities/{slug}/posts/` | POST * members only `{body, project?}`; `DELETE posts/{id}/` * |
| GET | `communities/{slug}/members/` *, `members/` * | Directory: `actor_type`, `search` (no email addresses) |
| GET | `recommendations/` * | `{profile_complete, results: [... match, reasons]}` |
| GET, POST, PATCH | `service-requests/` * | Members create and see their own; admins see all and PATCH `{status, admin_notes}`. `counts/` |
| GET | `network/overview/`, `network/feed/`, `network/dashboard/` | Landing figures; activity (`?scope=following`); dashboard |

## Settings (environment variables, or `backend/.env`)

| Variable | Default |
|----------|---------|
| `DJANGO_SECRET_KEY` | development-only key; **required** when `DJANGO_DEBUG=0` |
| `DJANGO_DEBUG` | `1` — set to `0` in production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` |
| `CSRF_TRUSTED_ORIGINS` | empty — `https://your-domain` in production |
| `DJANGO_ADMIN_URL` | `django-admin/` |
| `DJANGO_HSTS_SECONDS` | `3600` (production only) |
| `THROTTLE_LOGIN`, `THROTTLE_REGISTER` | `10/min`, `5/hour` |
| `READINESS_THRESHOLD` | `70` |
| `DJANGO_TIME_ZONE` | `Asia/Kathmandu` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |
| `POSTGRES_DB` | `iptds` |
| `POSTGRES_USER` | `postgres` (use a dedicated user in production) |
| `POSTGRES_PASSWORD` | empty |
| `POSTGRES_HOST` | `localhost` |
| `POSTGRES_PORT` | `5432` |
