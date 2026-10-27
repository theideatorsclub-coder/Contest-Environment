# TIC Contest Platform

A competitive programming platform for college coding contests — built by The Ideators Club.

Features live contest rounds, automated code grading (Judge0), ICPC-style scoring, an admin panel for problem authoring and contest management, and real-time leaderboards.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI (Python), Prisma ORM, Pydantic |
| Database | SQLite (dev), PostgreSQL (production) |
| Code Execution | Judge0 (production), Mock Judge (local dev) |
| Queue | Redis (submission queue + rate limiting) |
| Auth | JWT (6-hour expiry), bcrypt password hashing |

## Prerequisites

- **Python 3.11+** — [Download](https://www.python.org/downloads/)
- **Node.js 20+** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)

Optional (for full production setup):
- Docker + Docker Compose (for Redis + Judge0 + PostgreSQL)
- A code compiler: Python, Node.js, g++, gcc, or Java JDK (for mock judge)

## Quick Start (Local — No Docker Required)

### 1. Clone the repo

```bash
git clone https://github.com/theideatorsclub-coder/Contest-Environment.git
cd Contest-Environment
```

### 2. Set up the backend

```bash
cd backend

# Create and activate a Python virtual environment
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate Prisma client
prisma generate

# Create .env file (mock judge mode — no Docker needed)
# On Windows:
copy .env.example .env
# On macOS/Linux:
cp .env.example .env
```

Edit `backend/.env` and make sure `JUDGE0_URL="mock"` for local testing:

```env
DATABASE_URL="file:./dev.db"
SECRET_KEY="your-secret-key-here"
REDIS_URL="redis://127.0.0.1:6379"
JUDGE0_URL="mock"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

Generate a proper secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Initialize the database:
```bash
prisma db push
```

Start the backend:
```bash
python -m uvicorn main:app --reload
```

Backend runs at **http://localhost:8000**

### 3. Set up the frontend

Open a **new terminal**:

```bash
cd Frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**

### 4. Open the app

Go to http://localhost:3000 in your browser.

**Default credentials:**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@tic.edu` | `admin123` |
| Student | `student@tic.edu` | `student123` |

> These users are auto-seeded on first startup. Change the admin password before going live.

## Mock Judge Mode

When `JUDGE0_URL="mock"` in your `.env`, the backend runs submitted code locally using your machine's compilers — no Docker or Judge0 needed.

**Supported languages:**

| Language | ID | Requires |
|---|---|---|
| Python 3 | 71 | `python` |
| C++ (GCC) | 54 | `g++` |
| C (GCC) | 50 | `gcc` |
| Java | 62 | `javac`, `java` |
| JavaScript | 63 | `node` |

> **Warning:** Mock judge has NO sandboxing. Only use for local development. Never deploy with `JUDGE0_URL=mock` in production.

**Without Redis:** Submissions are graded synchronously (immediately) instead of via queue. Everything works — just no rate limiting.

## Production Setup (with Docker)

### 1. Start infrastructure

```bash
cd backend
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Judge0 Server on port 2358
- Judge0 Workers (background grading)

### 2. Configure for production

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:vitpassword123@localhost:5432/ticcontest"
SECRET_KEY="your-generated-secret-key"
REDIS_URL="redis://127.0.0.1:6379"
JUDGE0_URL="http://127.0.0.1:2358"
ALLOWED_ORIGINS="https://your-domain.com"
```

### 3. Initialize production database

```bash
cd backend
.\venv\Scripts\Activate.ps1  # or: source venv/bin/activate
prisma generate
prisma db push
```

### 4. Run with production settings

```bash
# Backend (multiple workers for concurrency)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Frontend (production build)
cd Frontend
npm run build
npm start
```

## Project Structure

```
Contest-Environment/
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints
│   ├── requirements.txt      # Python dependencies
│   ├── prisma/
│   │   ├── schema.prisma     # Database models (User, Problem, TestCase, Submission, Contest)
│   │   └── dev.db            # SQLite database (gitignored)
│   ├── docker-compose.yml    # Redis + PostgreSQL + Judge0
│   ├── Dockerfile            # Backend production container
│   ├── .env.example          # Environment template
│   └── .env                  # Your config (gitignored)
├── Frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── admin/        # Admin panel (dashboard, contests, problems, submissions, analytics)
│   │   │   ├── contests/     # Student contest pages + code workspace
│   │   │   ├── problems/     # Student practice problems + code workspace
│   │   │   └── leaderboard/  # Global standings
│   │   ├── components/       # Navbar, AuthGuard, AdminGuard, AdminUI, AdminSidebar
│   │   └── lib/             # API utilities, TypeScript types
│   ├── Dockerfile            # Frontend production container
│   └── package.json
├── DEPLOYMENT.md             # Full deployment guide
└── README.md
```

## API Endpoints

### Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register new user |
| POST | `/login` | — | Login, returns JWT |

### Problems
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/problems` | — | List all problems |
| GET | `/problems/{id}` | — | Problem detail + sample test cases |
| GET | `/problems/{id}/testcases` | — | Public test cases (hidden requires admin) |
| POST | `/admin/problems` | Admin | Create problem + test cases |
| PUT | `/admin/problems/{id}` | Admin | Edit problem |
| DELETE | `/admin/problems/{id}` | Admin | Delete problem + test cases |
| POST | `/admin/problems/{id}/testcases` | Admin | Add test case |
| PUT | `/admin/problems/{id}/testcases/{tc_id}` | Admin | Edit test case |
| DELETE | `/admin/problems/{id}/testcases/{tc_id}` | Admin | Delete test case |

### Contests
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/contests` | — | List all contests |
| GET | `/contests/{id}` | — | Contest detail + problems |
| GET | `/contests/{id}/leaderboard` | — | ICPC-style standings |
| POST | `/admin/contests` | Admin | Create contest |
| PUT | `/admin/contests/{id}` | Admin | Edit contest |
| DELETE | `/admin/contests/{id}` | Admin | Delete contest |
| PUT | `/admin/contests/{id}/problems` | Admin | Update contest problem set |

### Submissions
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/run` | — | Run code (custom stdin) |
| POST | `/submit` | — | Submit code for grading |
| GET | `/status/{id}` | — | Check submission status |
| GET | `/admin/submissions` | Admin | All submissions (with filters) |

### Analytics & Users
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/leaderboard` | — | Global leaderboard |
| GET | `/users/{id}/submissions` | — | User's submissions |
| GET | `/users/{id}/stats` | — | User stats (attempts, win rate) |
| GET | `/admin/users` | Admin | All registered users |
| GET | `/admin/analytics/overview` | Admin | Platform-wide stats |
| GET | `/admin/analytics/problems` | Admin | Per-problem stats |
| GET | `/admin/analytics/participation` | Admin | Per-contest participation |
| GET | `/judge0/languages` | — | Supported languages |
| GET | `/health` | — | Health check (redis, judge0 status) |

## Features

### For Students
- Browse and solve practice problems
- Run code with custom input (Python, C++, C, Java, JavaScript)
- Submit solutions for automated grading
- View live contest standings with ICPC scoring
- Global leaderboard

### For Admins
- Dashboard with platform-wide statistics
- Create, edit, delete problems with test cases
- Schedule and manage contests
- Add/remove problems from existing contests
- View all submissions with filters
- View all registered participants with stats
- Analytics: submission trends, problem difficulty, contest participation
- Export results to CSV

## Troubleshooting

**"Cannot reach the server" on login**
- Make sure the backend is running: `python -m uvicorn main:app --reload`
- Check http://localhost:8000/health

**"Judge0 Service Unavailable"**
- You're in production mode without Judge0 running
- For local dev, set `JUDGE0_URL="mock"` in `.env`

**"Module not found" errors**
- Backend: `pip install -r requirements.txt` inside the venv
- Frontend: `npm install` in the Frontend directory

**Prisma errors**
- Run `prisma generate` to generate the client
- Run `prisma db push` to create/update the database schema

**Port already in use**
- Backend: change port with `--port 8001`
- Frontend: it auto-selects the next available port (3001, 3002, etc.)

## Security Notes

- Change `SECRET_KEY` before deploying
- Set `ALLOWED_ORIGINS` to your domain only (not `*`)
- Change default admin password after first login
- Never deploy with `JUDGE0_URL=mock` — it has no sandboxing
- Hidden test cases require admin authentication to view

## License

This project is built for The Ideators Club. Contact the team for usage rights.
