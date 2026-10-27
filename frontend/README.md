# Frontend — React

```bash
npm install
npm run dev        # http://localhost:5173, expects the API on http://127.0.0.1:8000
npm run build      # production build in dist/ (served by Nginx, see ../DEPLOYMENT.md)
```

In development Vite forwards `/api` to the Django server (see `vite.config.js`). To call an API
on another host, copy `.env.example` to `.env` and set `VITE_API_URL`.

## Layout (`src/`)

| File | Purpose |
|------|---------|
| `App.jsx` | Routes and role guards (user routes vs `/admin` routes) |
| `auth.jsx` | Session: login, logout, current user |
| `api.js` | `fetch` wrapper — token header, errors, CSV download |
| `utils.js` | Date/money formatting (NRs), stage labels, `useFetch` |
| `network.js` | Investment network helpers: reference data, NRs billions, compare list, share links |
| `components/PortfolioCard.jsx` | Portfolio card with Like · Comment · Share · Compare |
| `components/Layout.jsx` | Top bar and sidebar |
| `components/ui.jsx` | Shared pieces: cards, chips, banners, tables, stepper, modal |
| `pages/` | One file per screen — see the tables in the root README (`pages/network/` = investment network) |
| `styles.css` | All styling; colours are CSS variables at the top |
