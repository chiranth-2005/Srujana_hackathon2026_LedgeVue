# LedgeVue

LedgeVue is a personal finance workspace for organizing transaction data and understanding spending. Users import their own statements; the application does not connect to banks or retrieve account data automatically.

## Features

- Create an account and manage a private finance workspace.
- Import transaction statements in CSV, XLSX, or XLS format.
- Review transactions and organize spending with categories and budgets.
- Explore recurring payments, analytics, insights, and reports based on imported data.
- Use Financial Intelligence tools for purchase scenarios, savings goals, financial rules, and transaction reviews.
- Update account and application settings.

The importer supports common transaction date, merchant, amount, debit, and credit columns. CSV files may use comma, semicolon, tab, or pipe delimiters. [sample-transactions.csv](sample-transactions.csv) contains example data for trying an import.

## Workflow

```mermaid
flowchart LR
    A[Create account or sign in] --> B[Import CSV or Excel statement]
    B --> C[React frontend sends request]
    C --> D[FastAPI authenticates, validates, and processes]
    D --> E[(PostgreSQL stores user-scoped records)]
    E --> F[API returns finance data]
    F --> G[Review transactions, budgets, analytics, and insights]
    G --> H[Manage finances or sign out]

    classDef user fill:#eff6ff,stroke:#3b82f6,color:#172554
    classDef service fill:#f0fdf4,stroke:#22c55e,color:#14532d
    classDef storage fill:#fefce8,stroke:#eab308,color:#713f12
    class A,B,G,H user
    class C,D,F service
    class E storage
```

LedgeVue analyzes data that users import; it does not connect to financial institutions or fetch transactions automatically.

## Techstack

### Frontend

- **React 19** for the user interface.
- **TypeScript 5** for typed application code.
- **Tailwind CSS 4** for styling.
- **TanStack Start and TanStack Router** for the application framework, server rendering, and file-based routing.
- **Vite 8** for the frontend development server and build tooling.

The requested frontend technologies React, TypeScript, and Tailwind CSS are used in this project. Framework note: the checked-in application uses TanStack Start and TanStack Router with Vite; it does not currently use Next.js.

### Backend

- **Python 3.11 or newer** for the API service.
- **FastAPI** for HTTP API routes and request handling.
- **SQLAlchemy** for database models and queries.
- **Alembic** for database schema migrations.
- **Uvicorn** to run the API server locally.

### Database and containers

- **PostgreSQL 17** for persistent application data.
- **Docker Compose** to run PostgreSQL locally using the included `compose.yaml`.
- A separately managed PostgreSQL server can also be configured using `DATABASE_URL`.

## Requirements

- Node.js and npm.
- Python 3.11 or newer.
- Git.
- Docker Compose and a running Docker daemon, or access to a PostgreSQL server.

## Local setup

Clone the repository and run the following from the project root.

### 1. Install dependencies and configure the environment

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
npm ci
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
notepad .env
```

**macOS/Linux:**

```sh
cp .env.example .env
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
${EDITOR:-nano} .env
```

Set `POSTGRES_PASSWORD` in `.env` to a strong local password. Set `DATABASE_URL` to the same password, for example:

```dotenv
POSTGRES_PASSWORD=your-local-password
DATABASE_URL=postgresql+psycopg://ledgevue:your-local-password@localhost:5432/ledgevue
```

If the password contains URL-reserved characters, encode them in `DATABASE_URL`.

### 2. Start PostgreSQL and apply migrations

Start the database from the project root:

```sh
npm run db:up
```

Apply the schema migrations.

**Windows PowerShell:**

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
Set-Location ..
```

**macOS/Linux:**

```sh
cd backend
../.venv/bin/python -m alembic upgrade head
cd ..
```

### 3. Run the application

Start the API and frontend in separate terminals from the project root.

**Terminal 1 — API**

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
npm run dev:api
```

macOS/Linux:

```sh
source .venv/bin/activate
npm run dev:api
```

**Terminal 2 — frontend**

```sh
npm run dev
```

Open the local address printed by the frontend development server. Create an account and import a statement to populate the workspace. The Vite development server proxies `/api` requests to the API at `http://127.0.0.1:8000`.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the frontend development server. |
| `npm run dev:api` | Start the FastAPI development server. |
| `npm run db:up` | Start the PostgreSQL Docker Compose service. |
| `npm test` | Run frontend tests once. |
| `npm run test:watch` | Run frontend tests in watch mode. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Build the frontend and server bundle. |
| `npm run preview` | Preview the production build. |

Run backend tests from the `backend` directory with the project virtual environment active:

```sh
python -m unittest discover -s tests -p "test_*.py"
```

## Project structure

```text
backend/
  app/main.py                  FastAPI application, data models, and API endpoints
  migrations/                  Alembic environment and schema revisions
  tests/                       Backend tests
src/
  components/                  Application shell, authentication, and shared UI
  hooks/                       Shared React hooks
  lib/                         API client, finance types, and utilities
  routes/                      File-based application pages
  test/                        Frontend tests
  router.tsx                   TanStack Router setup
  server.ts                    Server entry point
  start.ts                     TanStack Start setup
  styles.css                   Global application styles
public/                         Static assets
compose.yaml                    Local PostgreSQL service
.env.example                    Environment variable template
package.json                    Frontend scripts and dependencies
backend/requirements.txt        Python backend dependencies
sample-transactions.csv         Example transaction import data
```

## Data and security

User passwords are hashed, sessions use HttpOnly cookies, and requests that change data use CSRF protection. Finance data is associated with the signed-in user. Uploaded statements are parsed for import rather than kept as downloadable documents.

LedgeVue does not provide bank connections, automatic transfers, or bank-balance verification. Financial projections are informational and are not financial advice.

For production, use HTTPS, secure session cookies, correctly configured allowed origins and hosts, secrets stored outside source control, and a protected database with backups. Apply migrations as part of deployment. See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.
