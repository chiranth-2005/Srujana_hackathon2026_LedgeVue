# LedgeVue

LedgeVue is a personal finance workspace for reviewing transactions, spending patterns, budgets, recurring charges, and financial scenarios. Data is based on transaction files imported by the signed-in user; the app does not connect to banks.

## Features

- Import transaction statements in CSV, XLSX, or XLS format.
- Review transactions, budgets, recurring charges, analytics, and reports.
- Explore purchase scenarios, savings goals, and configurable financial rules.
- Keep user accounts and financial records isolated in PostgreSQL.

The importer recognizes common date, merchant, amount, debit, and credit columns. CSV files can use comma, semicolon, tab, or pipe delimiters. Imports are validated and saved in batches. The finance API returns up to the latest 50,000 transactions per user.

## Requirements

- Node.js and npm
- Python 3.11 or newer
- Docker Compose with the Docker daemon running, or a local PostgreSQL server

## Local development

Clone the repository and enter its directory, then configure the backend:

```sh
cp .env.example .env
DB_PASSWORD="$(openssl rand -hex 32)"
sed -i "s/replace-with-a-strong-random-value/$DB_PASSWORD/; s/replace-with-the-same-value/$DB_PASSWORD/" .env

npm ci
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Start PostgreSQL and create the database schema:

```sh
npm run db:up
npm run db:migrate
```

If using a local PostgreSQL server instead of Docker Compose, start it separately and ensure its database, username, password, and port match `DATABASE_URL` in `.env`.

Run the API and frontend in separate terminals from the repository root. Activate `.venv` in the API terminal:

```sh
source .venv/bin/activate
npm run dev:api
```

```sh
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:8080`), create an account, and import a statement from Overview or Settings. `sample-transactions.csv` is a synthetic import example.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend development server |
| `npm run dev:api` | Start the FastAPI development server |
| `npm run db:up` | Start the PostgreSQL Compose service |
| `npm run db:migrate` | Apply Alembic migrations |
| `npm test` | Run frontend tests |
| `npm run test:watch` | Run frontend tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run build` | Build the production frontend/server bundle |
| `npm run preview` | Preview the production build |

Run backend tests from the `backend` directory with the virtual environment active:

```sh
cd backend
python -m unittest discover -s tests -p 'test_*.py'
```

## Data and security

Passwords are hashed with Argon2. Sessions use random tokens stored as hashes and HttpOnly cookies; state-changing requests require CSRF protection. Finance queries are scoped to the authenticated user. Uploaded files are parsed for import and are not retained as documents.

This application does not provide bank connections, automatic transfers, account-balance verification, password recovery, or multi-factor authentication. Purchase projections are indicative and are not financial advice or a certified financial service.

For production, use HTTPS on a single trusted origin, set `APP_ENV=production` and `SESSION_COOKIE_SECURE=true`, configure exact `APP_ORIGINS` and `ALLOWED_HOSTS`, store secrets outside source control, use managed PostgreSQL with backups, and run migrations as a deployment step. Do not expose the database port publicly. See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.

## Project layout

```text
backend/       FastAPI application, Alembic migrations, and backend tests
src/           TanStack Start frontend and frontend tests
public/        Static assets
compose.yaml   Local PostgreSQL service
```
