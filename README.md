# NEXORA

Full-stack CRM for lead, customer, task, and support management. Flask REST API + React SPA, fully responsive from 320px with light/dark/system themes.

## Stack

- **Backend:** Python 3.12, Flask 3, SQLAlchemy 2, JWT auth, SQLite (file-based, `backend/instance/nexora.db`)
- **Frontend:** React 18, Vite 6, React Router 7, Tailwind CSS, Recharts, lucide-react

## Layout

```
nexora/
├─ backend/          Flask app (app/), schema + seed script, pytest suite
└─ frontend/         Vite + React SPA (src/pages, src/components, src/context, src/services)
```

## Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
python seed.py                                       # builds DB + demo data
python run.py                                        # http://localhost:5000/api
```

Tests:

```bash
python -m pytest tests/ -q
```

## Frontend

```bash
cd frontend
npm install
npm run dev                                          # http://localhost:5173
npm run build                                        # production build → dist/
npm run lint                                         # ESLint (flat config, zero warnings)
```

The Vite dev server proxies `/api` to `http://localhost:5000/api` — start the backend first.

## Demo accounts

| Role     | Email                 | Password    |
| -------- | --------------------- | ----------- |
| Admin    | harini@nexora.dev     | Nexora@2026 |
| Manager  | arun@nexora.dev       | Nexora@2026 |
| Employee | karthik@nexora.dev    | Nexora@2026 |

New self-registrations start with the employee role.

## Features

- Leads: pipeline by status, conversions, contact logging, follow-up flags
- Customers: health scoring, account value, risk flags
- Tasks: list + kanban board, assignments, due dates
- Support: tickets, priority SLAs, escalation on breach
- Analytics: trend charts, funnel, workload, deterministic rule-based insights
- Team: roles, invites, reset password, workload per member
- Notifications, activity audit trail, profile, settings (theme + notification preferences)