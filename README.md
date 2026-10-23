# TIC Contest Platform 🚀
> College coding contest and practice platform built by **The Ideators Club (TIC)**. Inspired by LeetCode and Codeforces, powered by FastAPI, Next.js, Redis, and Judge0.

---

## 🏗️ Architecture Overview

```
                          ┌──────────────────────────┐
                          │   Frontend (Next.js 16)  │
                          │   Port 3000 (React 19)   │
                          └─────────────┬────────────┘
                                        │ REST APIs
                                        ▼
                          ┌──────────────────────────┐
                          │   Backend (FastAPI)      │
                          │   Port 8000              │
                          └──────┬────────────┬──────┘
             Pushes jobs         │            │ Queries & updates
             to Redis queue      ▼            ▼
             ┌─────────────────────────┐  ┌─────────────────────────┐
             │   Redis Queue (6379)    │  │ SQLite / PostgreSQL DB  │
             │   "judge0_queue"        │  │ (Prisma ORM)            │
             └───────────┬─────────────┘  └─────────────────────────┘
                         │
                         ▼ Worker pops jobs
             ┌─────────────────────────┐
             │ Judge0 Worker Loop      │
             │ (Async FastAPI task)    │
             └───────────┬─────────────┘
                         │ POST /submissions?wait=true
                         ▼
             ┌─────────────────────────┐
             │   Judge0 Runner Engine  │
             │   Port 2358             │
             └─────────────────────────┘
```

---

## 📁 Repository Structure

```
TIC-Contest/
├── backend/                  # FastAPI 2.1 Backend + Async Judge0 Worker
│   ├── main.py               # API routes (Auth, Problems, Submissions, Run, Contests, Leaderboard)
│   ├── requirements.txt      # Python dependencies (FastAPI, Redis, Prisma, PyJWT, etc.)
│   ├── docker-compose.yml    # Redis & PostgreSQL containers
│   └── prisma/
│       ├── schema.prisma     # Prisma models (User, Problem, TestCase, Submission, Contest)
│       └── dev.db            # SQLite database seeded with problems & test cases
│
├── Frontend/                 # Next.js 16 + React 19 + Tailwind CSS Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── problems/page.tsx   # Problems catalog (Search & filters)
│   │   │   ├── problems/[id]/page.tsx # LeetCode-style code workspace & console
│   │   │   ├── contests/page.tsx   # Contests schedule & live rounds
│   │   │   ├── leaderboard/page.tsx# Real-time campus leaderboard
│   │   │   └── admin/page.tsx      # Admin problem & testcase creator
│   │   └── components/
│   │       └── Navbar.tsx          # Responsive navigation & student auth modal
│   ├── package.json
│   └── tsconfig.json
│
└── README.md                 # Project documentation
```

---

## ⚡ Quick Start Guide

### 1. Start Services (Redis & Database)
Ensure Docker is running or start Redis on port `6379`:
```bash
cd backend
docker compose up -d
```
*(If running without Docker, start local Redis server on `localhost:6379`)*

### 2. Run the Backend API & Worker
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate Prisma Client
prisma generate --schema=prisma/schema.prisma

# Start FastAPI server (Runs API on :8000 and background worker)
uvicorn main:app --reload --port 8000
```
Backend API Documentation: `http://localhost:8000/docs`

### 3. Run the Frontend
```bash
cd Frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check API, Redis, and Judge0 connectivity |
| `POST` | `/register` | Student account registration |
| `POST` | `/login` | Student login returning JWT bearer token |
| `GET` | `/problems` | List all available coding problems |
| `GET` | `/problems/{id}` | Problem description + visible sample test cases |
| `POST` | `/admin/problems` | Create problem with sample and hidden test cases |
| `POST` | `/admin/problems/{id}/testcases` | Add test cases to existing problem |
| `POST` | `/run` | Synchronously test code against custom stdin |
| `POST` | `/submit` | Queue code submission to Redis (rate limited 5/min) |
| `GET` | `/status/{submission_id}` | Poll submission result (stdout, stderr, runtime, memory) |
| `GET` | `/contests` | List live, upcoming, and past contests |
| `GET` | `/contests/{id}` | Contest problem details and scoring |
| `GET` | `/leaderboard` | Campus ranking sorted by accepted submissions |
| `GET` | `/users/{id}/stats` | User attempt count, accepted count, and win rate |

---

## 🛠️ What Was Fixed in This Cleanup

1. **Eliminated Accidental Clones & Duplicates**:
   - `Frontend` had an accidental nested `.git` repo and full duplicate copies of `main.py`, `prisma/`, and `judge0-redis-bridge/`. All duplicates removed.
   - Outdated root `main.py` (v1) and root `prisma/` removed and unified into `backend/`.
2. **CORS Support**: Added `CORSMiddleware` to FastAPI so the Next.js frontend can communicate with the backend.
3. **Hardcoded Redis Connection**: Refactored Redis connection to respect `REDIS_URL` with automatic reconnection in worker.
4. **Missing Test Cases API**: Created `TestCaseCreate` models, `/admin/problems/{id}/testcases`, and automatic seeding in SQLite.
5. **Output Normalization**: Normalized CRLF (`\r\n`) to LF (`\n`) to prevent Windows/Linux newline false test failures.
6. **Execution Details in Status Route**: `GET /status/{id}` now returns `stdout`, `stderr`, `compile_output`, `execution_time`, and `memory`.
7. **Instant "Run Code" Endpoint**: Added `POST /run` for fast interactive testing in the browser before submitting.
8. **Prisma Schema Updated**: Added `TestCase`, `Contest`, and `ContestProblem` models.
9. **Full Frontend Implementation**: Built the complete problem catalog, interactive code solving workspace, live leaderboard, contest listing, admin problem manager, and authentication modal.