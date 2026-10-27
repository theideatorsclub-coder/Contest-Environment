# TIC Contest — Deployment Guide

## Prerequisites

- Docker + Docker Compose
- Node.js 20+
- Python 3.11+

## Quick Start (Docker)

```bash
# 1. Start infrastructure (Postgres, Redis, Judge0)
cd backend
docker compose up -d

# 2. Backend
cd ../backend
cp .env.example .env
# Edit .env — set SECRET_KEY, DATABASE_URL for Postgres, etc.
pip install -r requirements.txt
prisma generate
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Frontend
cd ../Frontend
npm install
# Set API URL (defaults to http://localhost:8000)
# NEXT_PUBLIC_API_URL=http://your-api-host:8000
npm run build
npm start
```

## Environment Variables

### Backend (.env)
| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite path or Postgres URL |
| `SECRET_KEY` | **Yes** | — | JWT signing key (generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `REDIS_URL` | Yes | `redis://127.0.0.1:6379` | Redis for submission queue |
| `JUDGE0_URL` | Yes | `http://127.0.0.1:2358` | Judge0 code execution server |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |

### Frontend
| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Backend API base URL |

## Production Checklist

- [ ] `SECRET_KEY` changed from default
- [ ] `ALLOWED_ORIGINS` set to your domain(s) only
- [ ] `DATABASE_URL` pointing to PostgreSQL (not SQLite)
- [ ] Redis running and reachable
- [ ] Judge0 running and reachable
- [ ] Frontend built with `npm run build` (not dev mode)
- [ ] Backend running with `uvicorn` (no `--reload`)
- [ ] HTTPS enabled (reverse proxy: nginx/caddy)
- [ ] Default admin password changed after first login

## Infrastructure Services

### Redis
Required for:
- Submission queue (background grading)
- Rate limiting (5 submissions/60s per user, 5 login attempts/60s)

### Judge0
Required for:
- Code execution (`POST /run`)
- Submission grading (test case evaluation)

Both are included in `docker-compose.yml`. Start with:
```bash
cd backend && docker compose up -d
```

## Security

- All `/admin/*` endpoints require a valid JWT with `role=ADMIN`
- Hidden test cases (`?include_hidden=true`) require admin authentication
- Login endpoint is rate-limited (5 attempts/60s)
- JWT tokens expire after 6 hours
- Passwords hashed with bcrypt
