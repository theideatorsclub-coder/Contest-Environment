import asyncio
import json
import os
import uuid
import subprocess
import tempfile
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
load_dotenv()

import httpx
import jwt
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from prisma import Prisma


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "vit_super_secret_key_change_in_production"
)
ALGORITHM = "HS256"

JUDGE0_URL = os.getenv(
    "JUDGE0_URL",
    "http://127.0.0.1:2358"
)

# CORS: comma-separated origins, default to localhost dev ports
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
    if o.strip()
]

# Mock judge mode: set JUDGE0_URL=mock in .env to run code locally without Docker/Judge0
MOCK_JUDGE = JUDGE0_URL == "mock"

# Language config for mock judge
MOCK_LANGS = {
    71: {"name": "Python 3", "ext": ".py", "cmd": ["python"], "type": "interpreted"},
    63: {"name": "JavaScript", "ext": ".js", "cmd": ["node"], "type": "interpreted"},
    54: {"name": "C++ (GCC)", "ext": ".cpp", "cmd": ["g++"], "type": "compiled", "run_cmd": None},
    50: {"name": "C (GCC)", "ext": ".c", "cmd": ["gcc"], "type": "compiled", "run_cmd": None},
    62: {"name": "Java", "ext": ".java", "cmd": ["javac"], "type": "java", "run_cmd": ["java"]},
}


def mock_execute(source_code: str, language_id: int, stdin: str, timeout: int = 10):
    """
    Run code locally via subprocess. DEV ONLY — no sandboxing.
    Returns a dict matching Judge0's response shape.
    """
    lang = MOCK_LANGS.get(language_id)
    if not lang:
        return {
            "status": {"description": "Compilation Error"},
            "stdout": None,
            "stderr": f"Mock judge supports: {list(MOCK_LANGS.keys())}. Got language_id={language_id}",
            "compile_output": None,
            "time": None,
            "memory": None,
        }

    import time as _time

    # ── Interpreted languages (Python, JavaScript) ──
    if lang["type"] == "interpreted":
        interpreter = shutil.which(lang["cmd"][0])
        if not interpreter:
            return {
                "status": {"description": "Compilation Error"},
                "stdout": None,
                "stderr": f"'{lang['cmd'][0]}' not found. Install {lang['name']}.",
                "compile_output": None, "time": None, "memory": None,
            }
        with tempfile.NamedTemporaryFile(mode="w", suffix=lang["ext"], delete=False, encoding="utf-8") as f:
            f.write(source_code)
            tmp_path = f.name
        try:
            start = _time.time()
            proc = subprocess.run([interpreter, tmp_path], input=stdin, capture_output=True, text=True, timeout=timeout)
            elapsed = _time.time() - start
            return _build_result(proc, elapsed)
        except subprocess.TimeoutExpired:
            return _timeout_result(timeout)
        except Exception as e:
            return _error_result(str(e))
        finally:
            os.unlink(tmp_path)

    # ── Compiled languages (C, C++) ──
    elif lang["type"] == "compiled":
        compiler = shutil.which(lang["cmd"][0])
        if not compiler:
            return {
                "status": {"description": "Compilation Error"},
                "stdout": None,
                "stderr": f"'{lang['cmd'][0]}' not found. Install {lang['name']}.",
                "compile_output": None, "time": None, "memory": None,
            }
        with tempfile.NamedTemporaryFile(mode="w", suffix=lang["ext"], delete=False, encoding="utf-8") as f:
            f.write(source_code)
            src_path = f.name
        exe_path = src_path + ".exe"
        try:
            # Compile
            start = _time.time()
            compile_proc = subprocess.run([compiler, "-o", exe_path, src_path, "-std=c++17"], capture_output=True, text=True, timeout=timeout)
            if compile_proc.returncode != 0:
                return {
                    "status": {"description": "Compilation Error"},
                    "stdout": None, "stderr": None,
                    "compile_output": compile_proc.stderr,
                    "time": None, "memory": None,
                }
            # Run
            run_proc = subprocess.run([exe_path], input=stdin, capture_output=True, text=True, timeout=timeout)
            elapsed = _time.time() - start
            return _build_result(run_proc, elapsed)
        except subprocess.TimeoutExpired:
            return _timeout_result(timeout)
        except Exception as e:
            return _error_result(str(e))
        finally:
            for p in [src_path, exe_path]:
                if os.path.exists(p):
                    os.unlink(p)

    # ── Java ──
    elif lang["type"] == "java":
        javac = shutil.which("javac")
        java_bin = shutil.which("java")
        if not javac or not java_bin:
            return {
                "status": {"description": "Compilation Error"},
                "stdout": None,
                "stderr": "javac/java not found. Install JDK.",
                "compile_output": None, "time": None, "memory": None,
            }
        # Java requires the file to be named Main.java if the class is Main
        java_dir = tempfile.mkdtemp()
        java_file = os.path.join(java_dir, "Main.java")
        with open(java_file, "w", encoding="utf-8") as f:
            f.write(source_code)
        try:
            # Compile
            start = _time.time()
            compile_proc = subprocess.run([javac, java_file], capture_output=True, text=True, timeout=timeout, cwd=java_dir)
            if compile_proc.returncode != 0:
                return {
                    "status": {"description": "Compilation Error"},
                    "stdout": None, "stderr": None,
                    "compile_output": compile_proc.stderr,
                    "time": None, "memory": None,
                }
            # Run
            run_proc = subprocess.run([java_bin, "-cp", java_dir, "Main"], input=stdin, capture_output=True, text=True, timeout=timeout)
            elapsed = _time.time() - start
            return _build_result(run_proc, elapsed)
        except subprocess.TimeoutExpired:
            return _timeout_result(timeout)
        except Exception as e:
            return _error_result(str(e))
        finally:
            shutil.rmtree(java_dir, ignore_errors=True)

    return _error_result("Unknown language type")


def _build_result(proc, elapsed):
    if proc.returncode == 0:
        return {
            "status": {"description": "Accepted"},
            "stdout": proc.stdout, "stderr": None, "compile_output": None,
            "time": f"{elapsed:.3f}", "memory": None,
        }
    return {
        "status": {"description": "Runtime Error"},
        "stdout": proc.stdout, "stderr": proc.stderr, "compile_output": None,
        "time": f"{elapsed:.3f}", "memory": None,
    }


def _timeout_result(timeout):
    return {
        "status": {"description": "Time Limit Exceeded"},
        "stdout": None, "stderr": f"Execution timed out after {timeout}s",
        "compile_output": None, "time": None, "memory": None,
    }


def _error_result(msg):
    return {
        "status": {"description": "Runtime Error"},
        "stdout": None, "stderr": str(msg), "compile_output": None,
        "time": None, "memory": None,
    }

REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://127.0.0.1:6379"
)

QUEUE_NAME = "judge0_queue"
RATE_LIMIT = 5
RATE_WINDOW_SECONDS = 60

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

security = HTTPBearer(auto_error=False)


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role")
        if role != "ADMIN":
            raise HTTPException(status_code=403, detail="Forbidden: Admin credentials required")
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")


prisma = Prisma()
redis_client = None
worker_task = None
http_client = None


# --------------------------------------------------
# APPLICATION LIFECYCLE
# --------------------------------------------------

async def connect_redis():
    global redis_client
    # Try configured REDIS_URL first, then fallback to 6379 and 6380
    urls_to_try = [
        REDIS_URL,
        "redis://127.0.0.1:6379",
        "redis://127.0.0.1:6380",
    ]
    seen = set()
    for url in urls_to_try:
        if url in seen:
            continue
        seen.add(url)
        try:
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=None
            )
            await client.ping()
            print(f" Connected to Redis at {url}")
            return client
        except Exception:
            continue
    return None


async def seed_default_data():
    try:
        admin_user = await prisma.user.find_unique(where={"email": "admin@tic.edu"})
        if not admin_user:
            await prisma.user.create(
                data={
                    "email": "admin@tic.edu",
                    "password": pwd_context.hash("admin123"),
                    "name": "Club Admin",
                    "role": "ADMIN",
                }
            )
            print("[SEED] Default admin created: admin@tic.edu")

        student_user = await prisma.user.find_unique(where={"email": "student@tic.edu"})
        if not student_user:
            await prisma.user.create(
                data={
                    "email": "student@tic.edu",
                    "password": pwd_context.hash("student123"),
                    "name": "Demo Student",
                    "role": "STUDENT",
                }
            )
            print("[SEED] Default student created: student@tic.edu")

        prob_count = await prisma.problem.count()
        if prob_count == 0:
            await prisma.problem.create(
                data={
                    "id": "two-sum",
                    "title": "Two Sum",
                    "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
                    "difficulty": "Easy",
                }
            )
            await prisma.testcase.create(
                data={
                    "problemId": "two-sum",
                    "input": "2 7 11 15\n9",
                    "expectedOutput": "0 1",
                    "isHidden": False,
                }
            )
            await prisma.testcase.create(
                data={
                    "problemId": "two-sum",
                    "input": "3 2 4\n6",
                    "expectedOutput": "1 2",
                    "isHidden": True,
                }
            )

            await prisma.problem.create(
                data={
                    "id": "reverse-string",
                    "title": "Reverse String",
                    "description": "Write a program that takes a string from standard input and prints the reversed string to standard output.",
                    "difficulty": "Easy",
                }
            )
            await prisma.testcase.create(
                data={
                    "problemId": "reverse-string",
                    "input": "hello",
                    "expectedOutput": "olleh",
                    "isHidden": False,
                }
            )

        contest_count = await prisma.contest.count()
        if contest_count == 0:
            now = datetime.now(timezone.utc)
            contest = await prisma.contest.create(
                data={
                    "id": "tic-weekly-1",
                    "title": "TIC Weekly Contest #1",
                    "description": "Weekly college programming contest organized by The Ideators Club. Solve algorithmic challenges under strict time bounds.",
                    "startTime": now - timedelta(minutes=15),
                    "endTime": now + timedelta(minutes=75),
                }
            )
            await prisma.contestproblem.create(
                data={"contestId": contest.id, "problemId": "two-sum", "points": 100}
            )
            await prisma.contestproblem.create(
                data={"contestId": contest.id, "problemId": "reverse-string", "points": 100}
            )
            print("[SEED] Default contest and problems created")
    except Exception as e:
        print(f"[SEED] Startup data check: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, worker_task, http_client

    await prisma.connect()
    await seed_default_data()

    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0)
    )

    redis_client = await connect_redis()
    if redis_client:
        print(" Connected to Redis Queue")
    else:
        print(" Redis not currently available. Background worker will retry connecting.")

    worker_task = asyncio.create_task(judge0_worker())
    print("[WORKER] Judge0 worker background loop started")

    try:
        yield
    finally:
        if worker_task:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass

        if redis_client:
            await redis_client.aclose()

        if http_client:
            await http_client.aclose()

        await prisma.disconnect()


app = FastAPI(
    title="TIC Contest Platform API",
    description="Online Judge and Contest Platform Backend for The Ideators Club",
    version="2.1.0",
    lifespan=lifespan
)

# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# REQUEST & RESPONSE MODELS
# --------------------------------------------------

class UserCreate(BaseModel):
    email: str
    password: str
    name: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class TestCaseCreate(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = True


class TestCaseResponse(BaseModel):
    id: str
    problem_id: str
    input: str
    expected_output: str
    is_hidden: bool


class ProblemCreate(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str  # "Easy", "Medium", "Hard"
    test_cases: list[TestCaseCreate] = []


class CodeSubmit(BaseModel):
    problem_id: str
    user_id: str
    language_id: int
    source_code: str
    contest_id: str | None = None



class CodeRun(BaseModel):
    source_code: str
    language_id: int
    stdin: str = ""


class ContestCreate(BaseModel):
    id: str
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    problem_ids: list[str] = []


class Judge0Webhook(BaseModel):
    status: dict
    stdout: str | None = None
    stderr: str | None = None
    compile_output: str | None = None


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
async def health_check():
    global redis_client
    redis_ok = False
    judge0_ok = False

    if redis_client:
        try:
            await redis_client.ping()
            redis_ok = True
        except Exception:
            redis_ok = False

    if MOCK_JUDGE:
        judge0_ok = True  # mock judge is always "available"
    elif http_client:
        try:
            response = await http_client.get(f"{JUDGE0_URL}/languages", timeout=4)
            judge0_ok = response.is_success
        except Exception:
            judge0_ok = False

    return {
        "status": "ok",
        "service": "TIC Contest Platform API",
        "redis": redis_ok,
        "judge0": judge0_ok,
        "mode": "mock" if MOCK_JUDGE else "production"
    }


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/register")
async def register_user(user: UserCreate):
    existing_user = await prisma.user.find_unique(where={"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = pwd_context.hash(user.password)
    new_user = await prisma.user.create(
        data={
            "email": user.email,
            "password": hashed_password,
            "name": user.name or user.email.split("@")[0]
        }
    )

    return {
        "message": "User created successfully!",
        "user_id": new_user.id,
        "email": new_user.email
    }


@app.post("/login")
async def login_user(user: UserLogin):
    # Rate limiting on login attempts (5 per 60s per email, if Redis available)
    if redis_client:
        try:
            rl_key = f"login_rate:{user.email}"
            count = await redis_client.incr(rl_key)
            if count == 1:
                await redis_client.expire(rl_key, RATE_WINDOW_SECONDS)
            if count > RATE_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="Too many login attempts. Please wait 60 seconds."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    db_user = await prisma.user.find_unique(where={"email": user.email})
    if not db_user or not pwd_context.verify(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    expire = datetime.now(timezone.utc) + timedelta(hours=6)
    payload = {
        "sub": db_user.id,
        "email": db_user.email,
        "role": db_user.role,
        "exp": expire
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": db_user.id,
        "email": db_user.email,
        "name": getattr(db_user, "name", None) or db_user.email.split("@")[0],
        "role": db_user.role
    }


# --------------------------------------------------
# PROBLEMS & TESTCASES
# --------------------------------------------------

@app.post("/admin/problems")
async def create_problem(
    problem: ProblemCreate,
    _admin: dict = Depends(require_admin)
):
    existing = await prisma.problem.find_unique(where={"id": problem.id})
    if existing:
        raise HTTPException(status_code=409, detail="Problem ID already exists")

    new_problem = await prisma.problem.create(
        data={
            "id": problem.id,
            "title": problem.title,
            "description": problem.description,
            "difficulty": problem.difficulty
        }
    )

    # Insert test cases if provided
    created_test_cases = 0
    if problem.test_cases:
        for tc in problem.test_cases:
            await prisma.testcase.create(
                data={
                    "problemId": problem.id,
                    "input": tc.input,
                    "expectedOutput": tc.expected_output,
                    "isHidden": tc.is_hidden
                }
            )
            created_test_cases += 1

    return {
        "message": "Problem created successfully!",
        "problem": new_problem,
        "test_cases_created": created_test_cases
    }


@app.get("/problems")
async def get_all_problems():
    problems = await prisma.problem.find_many(order={"createdAt": "asc"})
    # Fetch testcase counts
    result = []
    for p in problems:
        tc_count = await prisma.testcase.count(where={"problemId": p.id})
        result.append({
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "difficulty": p.difficulty,
            "test_cases_count": tc_count,
            "createdAt": p.createdAt
        })
    return result


@app.get("/problems/{problem_id}")
async def get_problem(problem_id: str):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Get sample test cases (non-hidden)
    sample_test_cases = await prisma.testcase.find_many(
        where={"problemId": problem_id, "isHidden": False}
    )

    return {
        "id": problem.id,
        "title": problem.title,
        "description": problem.description,
        "difficulty": problem.difficulty,
        "createdAt": problem.createdAt,
        "sample_test_cases": [
            {
                "input": tc.input,
                "expected_output": tc.expectedOutput
            }
            for tc in sample_test_cases
        ]
    }


@app.post("/admin/problems/{problem_id}/testcases")
async def add_test_case(
    problem_id: str,
    tc: TestCaseCreate,
    _admin: dict = Depends(require_admin)
):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    new_tc = await prisma.testcase.create(
        data={
            "problemId": problem_id,
            "input": tc.input,
            "expectedOutput": tc.expected_output,
            "isHidden": tc.is_hidden
        }
    )

    return {
        "message": "Test case added successfully!",
        "test_case_id": new_tc.id
    }


@app.get("/problems/{problem_id}/testcases")
async def get_problem_testcases(
    problem_id: str,
    include_hidden: bool = False,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # If requesting hidden test cases, require admin authentication
    if include_hidden:
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required to view hidden test cases")
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("role") != "ADMIN":
                raise HTTPException(status_code=403, detail="Admin access required to view hidden test cases")
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    where_filter = {"problemId": problem_id}
    if not include_hidden:
        where_filter["isHidden"] = False

    tcs = await prisma.testcase.find_many(where=where_filter)
    return [
        {
            "id": tc.id,
            "input": tc.input,
            "expected_output": tc.expectedOutput,
            "is_hidden": tc.isHidden
        }
        for tc in tcs
    ]


# --------------------------------------------------
# RUN CODE (Synchronous sample test)
# --------------------------------------------------

@app.post("/run")
async def run_code(req: CodeRun):
    """Executes code against Judge0 or local mock judge."""
    # ── Mock judge mode ──
    if MOCK_JUDGE:
        result = mock_execute(req.source_code, req.language_id, req.stdin)
        return {
            "status": result["status"]["description"],
            "stdout": result.get("stdout"),
            "stderr": result.get("stderr"),
            "compile_output": result.get("compile_output"),
            "time": result.get("time"),
            "memory": result.get("memory"),
        }

    # ── Real Judge0 ──
    if not http_client:
        raise HTTPException(status_code=503, detail="HTTP execution engine unavailable")

    payload = {
        "source_code": req.source_code,
        "language_id": req.language_id,
        "stdin": req.stdin
    }

    try:
        res = await http_client.post(
            f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=true",
            json=payload,
            timeout=15.0
        )
        res.raise_for_status()
        data = res.json()
        return {
            "status": data.get("status", {}).get("description", "Unknown"),
            "stdout": data.get("stdout"),
            "stderr": data.get("stderr"),
            "compile_output": data.get("compile_output"),
            "time": data.get("time"),
            "memory": data.get("memory")
        }
    except Exception as exc:
        return {
            "status": "Judge0 Service Unavailable",
            "stdout": None,
            "stderr": f"Could not connect to Judge0 runner at {JUDGE0_URL}: {str(exc)}",
            "compile_output": None,
            "time": None,
            "memory": None
        }


# --------------------------------------------------
# REDIS QUEUE PUSHER
# --------------------------------------------------

async def push_to_queue(
    submission_id: str,
    problem_id: str,
    source_code: str,
    language_id: int
):
    global redis_client
    try:
        if not redis_client:
            redis_client = await connect_redis()

        if not redis_client:
            await prisma.submission.update(
                where={"id": submission_id},
                data={"status": "QUEUE_OFFLINE", "stderr": "Redis queue is currently offline"}
            )
            return

        job_data = {
            "submission_id": submission_id,
            "problem_id": problem_id,
            "source_code": source_code,
            "language_id": language_id
        }

        await redis_client.lpush(QUEUE_NAME, json.dumps(job_data))
        await prisma.submission.update(
            where={"id": submission_id},
            data={"status": "IN_QUEUE"}
        )
        print(f" Queued submission: {submission_id}")

    except Exception as exc:
        print(f"Queue push failed: {exc}")
        try:
            await prisma.submission.update(
                where={"id": submission_id},
                data={"status": "INTERNAL_ERROR", "stderr": str(exc)}
            )
        except Exception:
            pass


# --------------------------------------------------
# JUDGE0 WORKER
# --------------------------------------------------

@app.get("/judge0/languages")
async def get_judge0_languages():
    if MOCK_JUDGE:
        return [{"id": k, "name": v["name"]} for k, v in MOCK_LANGS.items()]
    try:
        response = await http_client.get(f"{JUDGE0_URL}/languages")
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        # Fallback to standard languages if Judge0 is offline
        return [
            {"id": 71, "name": "Python (3.8.1)"},
            {"id": 54, "name": "C++ (GCC 9.2.0)"},
            {"id": 62, "name": "Java (OpenJDK 13.0.1)"},
            {"id": 63, "name": "JavaScript (Node.js 12.14.0)"},
            {"id": 74, "name": "TypeScript (3.7.4)"},
            {"id": 50, "name": "C (GCC 9.2.0)"}
        ]


async def judge0_worker():
    global redis_client
    print("[WORKER] Waiting for jobs in Redis queue...")

    while True:
        try:
            if not redis_client:
                redis_client = await connect_redis()
                if not redis_client:
                    await asyncio.sleep(4)
                    continue

            item = await redis_client.brpop(QUEUE_NAME, timeout=3)
            if not item:
                continue

            _, raw_job = item
            job = json.loads(raw_job)
            submission_id = job["submission_id"]

            try:
                await prisma.submission.update(
                    where={"id": submission_id},
                    data={"status": "PROCESSING"}
                )

                test_cases = await prisma.testcase.find_many(
                    where={"problemId": job["problem_id"]}
                )

                if not test_cases:
                    await prisma.submission.update(
                        where={"id": submission_id},
                        data={
                            "status": "INTERNAL_ERROR",
                            "stderr": "No test cases configured for this problem"
                        }
                    )
                    continue

                all_passed = True
                final_status = "ACCEPTED"
                last_stdout = None
                last_stderr = None
                last_compile_output = None
                last_execution_time = None
                last_memory = None

                for test_case in test_cases:
                    payload = {
                        "source_code": job["source_code"],
                        "language_id": job["language_id"],
                        "stdin": test_case.input
                    }

                    try:
                        response = await http_client.post(
                            f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=true",
                            json=payload,
                            timeout=20.0
                        )
                        response.raise_for_status()
                        result = response.json()
                    except Exception as http_err:
                        final_status = "JUDGE0_UNAVAILABLE"
                        last_stderr = f"Could not reach Judge0 runner: {str(http_err)}"
                        all_passed = False
                        break

                    status_description = result.get("status", {}).get("description", "Internal Error")
                    last_stdout = result.get("stdout")
                    last_stderr = result.get("stderr")
                    last_compile_output = result.get("compile_output")
                    last_execution_time = result.get("time")
                    last_memory = result.get("memory")

                    if status_description == "Compilation Error":
                        final_status = "COMPILATION_ERROR"
                        all_passed = False
                        break

                    if status_description != "Accepted":
                        if status_description == "Time Limit Exceeded":
                            final_status = "TIME_LIMIT_EXCEEDED"
                        elif status_description == "Runtime Error":
                            final_status = "RUNTIME_ERROR"
                        else:
                            final_status = status_description.upper().replace(" ", "_")
                        all_passed = False
                        break

                    actual_output = (last_stdout or "").replace("\r\n", "\n").strip()
                    expected_output = (test_case.expectedOutput or "").replace("\r\n", "\n").strip()

                    if actual_output != expected_output:
                        final_status = "WRONG_ANSWER"
                        all_passed = False
                        break

                if all_passed:
                    final_status = "ACCEPTED"

                await prisma.submission.update(
                    where={"id": submission_id},
                    data={
                        "status": final_status,
                        "stdout": last_stdout,
                        "stderr": last_stderr,
                        "compileOutput": last_compile_output,
                        "executionTime": str(last_execution_time) if last_execution_time is not None else None,
                        "memory": last_memory
                    }
                )

                print(f"[STATUS] Submission {submission_id} evaluated: {final_status}")

            except Exception as exc:
                print(f"Submission {submission_id} worker processing error: {exc}")
                try:
                    await prisma.submission.update(
                        where={"id": submission_id},
                        data={"status": "INTERNAL_ERROR", "stderr": str(exc)}
                    )
                except Exception:
                    pass

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"Worker iteration error: {exc}")
            await asyncio.sleep(2)


# --------------------------------------------------
# SUBMIT CODE
# --------------------------------------------------

@app.post("/submit")
async def submit_code(
    submission: CodeSubmit,
    background_tasks: BackgroundTasks
):
    global redis_client

    # Validate the user
    user = await prisma.user.find_unique(where={"id": submission.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Register first.")

    # Validate the problem
    problem = await prisma.problem.find_unique(where={"id": submission.problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Validate contest window if submitted during a contest
    if submission.contest_id:
        contest = await prisma.contest.find_unique(where={"id": submission.contest_id})
        if not contest:
            raise HTTPException(status_code=404, detail="Contest not found")

        now = datetime.now(timezone.utc)
        start = contest.startTime.replace(tzinfo=timezone.utc) if contest.startTime.tzinfo is None else contest.startTime
        end = contest.endTime.replace(tzinfo=timezone.utc) if contest.endTime.tzinfo is None else contest.endTime

        if now < start:
            raise HTTPException(status_code=400, detail="Contest has not started yet. Submissions are locked.")
        if now > end:
            raise HTTPException(status_code=400, detail="Contest has ended. Submissions are closed.")

    # Rate limiting: 5 submissions per 60 seconds (if Redis is connected)
    if redis_client:
        try:
            rate_key = f"rate_limit:{submission.user_id}"
            request_count = await redis_client.incr(rate_key)
            if request_count == 1:
                await redis_client.expire(rate_key, RATE_WINDOW_SECONDS)
            if request_count > RATE_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please wait 60 seconds."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Create submission record
    new_submission = await prisma.submission.create(
        data={
            "problemId": submission.problem_id,
            "userId": submission.user_id,
            "languageId": submission.language_id,
            "code": submission.source_code,
            "contestId": submission.contest_id,
            "status": "PENDING"
        }
    )

    # ── If Redis is available, queue for async grading ──
    if redis_client:
        background_tasks.add_task(
            push_to_queue,
            new_submission.id,
            submission.problem_id,
            submission.source_code,
            submission.language_id
        )
        return {
            "message": "Submission received and queued!",
            "submission_id": new_submission.id,
            "status": "PENDING"
        }

    # ── No Redis: grade synchronously (mock mode or real Judge0) ──
    await prisma.submission.update(
        where={"id": new_submission.id},
        data={"status": "PROCESSING"}
    )

    test_cases = await prisma.testcase.find_many(
        where={"problemId": submission.problem_id}
    )

    if not test_cases:
        await prisma.submission.update(
            where={"id": new_submission.id},
            data={"status": "INTERNAL_ERROR", "stderr": "No test cases configured"}
        )
        return {"message": "No test cases", "submission_id": new_submission.id, "status": "INTERNAL_ERROR"}

    final_status = "ACCEPTED"
    last_stdout = None
    last_stderr = None
    last_compile = None
    last_time = None
    last_mem = None

    for tc in test_cases:
        if MOCK_JUDGE:
            result = mock_execute(submission.source_code, submission.language_id, tc.input)
        elif http_client:
            try:
                resp = await http_client.post(
                    f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=true",
                    json={"source_code": submission.source_code, "language_id": submission.language_id, "stdin": tc.input},
                    timeout=20.0
                )
                resp.raise_for_status()
                result = resp.json()
            except Exception as e:
                final_status = "JUDGE0_UNAVAILABLE"
                last_stderr = str(e)
                break
        else:
            final_status = "JUDGE0_UNAVAILABLE"
            last_stderr = "No execution engine available"
            break

        status_desc = result.get("status", {}).get("description", "Error") if isinstance(result.get("status"), dict) else result.get("status", "Error")
        last_stdout = result.get("stdout")
        last_stderr = result.get("stderr")
        last_compile = result.get("compile_output")
        last_time = result.get("time")
        last_mem = result.get("memory")

        if "Compilation" in status_desc or "Compilation" in str(result.get("status", "")):
            final_status = "COMPILATION_ERROR"
            break
        if "Time Limit" in status_desc:
            final_status = "TIME_LIMIT_EXCEEDED"
            break
        if "Runtime" in status_desc:
            final_status = "RUNTIME_ERROR"
            break
        if status_desc != "Accepted":
            final_status = status_desc.upper().replace(" ", "_")
            break

        actual = (last_stdout or "").replace("\r\n", "\n").strip()
        expected = (tc.expectedOutput or "").replace("\r\n", "\n").strip()
        if actual != expected:
            final_status = "WRONG_ANSWER"
            break

    await prisma.submission.update(
        where={"id": new_submission.id},
        data={
            "status": final_status,
            "stdout": last_stdout,
            "stderr": last_stderr,
            "compileOutput": last_compile,
            "executionTime": str(last_time) if last_time is not None else None,
            "memory": last_mem,
        }
    )

    return {
        "message": "Submission graded!",
        "submission_id": new_submission.id,
        "status": final_status
    }


# --------------------------------------------------
# SUBMISSION STATUS (With execution details)
# --------------------------------------------------

@app.get("/status/{submission_id}")
async def get_submission_status(submission_id: str):
    submission = await prisma.submission.find_unique(where={"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    return {
        "submission_id": submission.id,
        "status": submission.status,
        "language_id": submission.languageId,
        "problem_id": submission.problemId,
        "created_at": submission.createdAt,
        "stdout": submission.stdout,
        "stderr": submission.stderr,
        "compile_output": submission.compileOutput,
        "execution_time": submission.executionTime,
        "memory": submission.memory
    }


@app.put("/webhook/{submission_id}")
async def judge_webhook(submission_id: str, result: Judge0Webhook):
    submission = await prisma.submission.find_unique(where={"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    final_status = result.status.get("description", "ERROR").upper()
    await prisma.submission.update(
        where={"id": submission_id},
        data={"status": final_status}
    )
    return {"message": "Database updated successfully", "status": final_status}


# --------------------------------------------------
# USER SUBMISSIONS & PROFILE
# --------------------------------------------------

@app.get("/users/{user_id}/submissions")
async def get_user_submissions(user_id: str):
    submissions = await prisma.submission.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"}
    )
    return {
        "count": len(submissions),
        "submissions": submissions
    }


@app.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str):
    submissions = await prisma.submission.find_many(where={"userId": user_id})
    total_attempts = len(submissions)
    accepted_attempts = sum(1 for s in submissions if s.status == "ACCEPTED")
    win_rate = (accepted_attempts / total_attempts * 100) if total_attempts > 0 else 0

    return {
        "userId": user_id,
        "total_attempts": total_attempts,
        "accepted_attempts": accepted_attempts,
        "win_rate_percentage": round(win_rate, 2)
    }


# --------------------------------------------------
# LEADERBOARD
# --------------------------------------------------

@app.get("/leaderboard")
async def get_leaderboard():
    submissions = await prisma.submission.find_many(where={"status": "ACCEPTED"})
    scores = {}
    for s in submissions:
        scores[s.userId] = scores.get(s.userId, 0) + 1

    ranked_users = []
    rank = 1
    for user_id, count in sorted(scores.items(), key=lambda item: item[1], reverse=True):
        # Fetch user email if available
        user = await prisma.user.find_unique(where={"id": user_id})
        username = getattr(user, "name", None) or (user.email.split("@")[0] if user else user_id[:8])
        ranked_users.append({
            "rank": rank,
            "userId": user_id,
            "username": username,
            "accepted_count": count
        })
        rank += 1

    return {"leaderboard": ranked_users}


# --------------------------------------------------
# CONTESTS
# --------------------------------------------------

@app.post("/admin/contests")
async def create_contest(
    contest: ContestCreate,
    _admin: dict = Depends(require_admin)
):
    new_contest = await prisma.contest.create(
        data={
            "id": contest.id,
            "title": contest.title,
            "description": contest.description,
            "startTime": contest.start_time,
            "endTime": contest.end_time
        }
    )

    for pid in contest.problem_ids:
        await prisma.contestproblem.create(
            data={
                "contestId": contest.id,
                "problemId": pid
            }
        )

    return {"message": "Contest created successfully!", "contest": new_contest}


@app.get("/contests")
async def get_all_contests():
    contests = await prisma.contest.find_many(order={"startTime": "asc"})
    result = []
    now = datetime.now(timezone.utc)

    for c in contests:
        # Determine status
        start = c.startTime.replace(tzinfo=timezone.utc) if c.startTime.tzinfo is None else c.startTime
        end = c.endTime.replace(tzinfo=timezone.utc) if c.endTime.tzinfo is None else c.endTime

        if now < start:
            status = "UPCOMING"
        elif start <= now <= end:
            status = "LIVE"
        else:
            status = "ENDED"

        problem_count = await prisma.contestproblem.count(where={"contestId": c.id})

        result.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "startTime": c.startTime,
            "endTime": c.endTime,
            "status": status,
            "problem_count": problem_count
        })

    return result


@app.get("/contests/{contest_id}")
async def get_contest_detail(contest_id: str):
    contest = await prisma.contest.find_unique(where={"id": contest_id})
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    contest_problems = await prisma.contestproblem.find_many(where={"contestId": contest_id})
    problems_data = []
    for cp in contest_problems:
        p = await prisma.problem.find_unique(where={"id": cp.problemId})
        if p:
            problems_data.append({
                "id": p.id,
                "title": p.title,
                "difficulty": p.difficulty,
                "points": cp.points
            })

    return {
        "id": contest.id,
        "title": contest.title,
        "description": contest.description,
        "startTime": contest.startTime,
        "endTime": contest.endTime,
        "problems": problems_data
    }


@app.get("/contests/{contest_id}/leaderboard")
async def get_contest_leaderboard(contest_id: str):
    contest = await prisma.contest.find_unique(where={"id": contest_id})
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    contest_problems = await prisma.contestproblem.find_many(where={"contestId": contest_id})
    problem_map = {cp.problemId: cp.points for cp in contest_problems}

    submissions = await prisma.submission.find_many(
        where={"contestId": contest_id},
        order={"createdAt": "asc"}
    )

    user_stats = {}
    contest_start = contest.startTime.replace(tzinfo=timezone.utc) if contest.startTime.tzinfo is None else contest.startTime

    for sub in submissions:
        uid = sub.userId
        pid = sub.problemId
        if uid not in user_stats:
            user_stats[uid] = {
                "userId": uid,
                "problems_solved": 0,
                "total_points": 0,
                "total_penalty_minutes": 0,
                "problem_results": {}
            }

        res = user_stats[uid]["problem_results"].setdefault(pid, {"solved": False, "attempts": 0, "solved_at": None})
        if res["solved"]:
            continue

        if sub.status == "ACCEPTED":
            res["solved"] = True
            res["attempts"] += 1
            sub_time = sub.createdAt.replace(tzinfo=timezone.utc) if sub.createdAt.tzinfo is None else sub.createdAt
            minutes_elapsed = max(0, int((sub_time - contest_start).total_seconds() / 60))
            res["solved_at"] = minutes_elapsed
            user_stats[uid]["problems_solved"] += 1
            user_stats[uid]["total_points"] += problem_map.get(pid, 100)
            penalty = minutes_elapsed + (res["attempts"] - 1) * 20
            user_stats[uid]["total_penalty_minutes"] += penalty
        else:
            res["attempts"] += 1

    ranked = []
    for uid, stats in user_stats.items():
        user = await prisma.user.find_unique(where={"id": uid})
        username = getattr(user, "name", None) or (user.email.split("@")[0] if user else uid[:8])
        stats["username"] = username
        ranked.append(stats)

    ranked.sort(key=lambda s: (-s["total_points"], s["total_penalty_minutes"]))
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    return {
        "contest_id": contest.id,
        "contest_title": contest.title,
        "problems": [
            {"id": cp.problemId, "points": cp.points}
            for cp in contest_problems
        ],
        "standings": ranked
    }



# --------------------------------------------------
# EDIT / DELETE PROBLEMS  (missing endpoints)
# --------------------------------------------------

class ProblemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    difficulty: str | None = None


@app.put("/admin/problems/{problem_id}")
async def update_problem(
    problem_id: str,
    update: ProblemUpdate,
    _admin: dict = Depends(require_admin)
):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    data: dict = {}
    if update.title is not None:
        data["title"] = update.title
    if update.description is not None:
        data["description"] = update.description
    if update.difficulty is not None:
        data["difficulty"] = update.difficulty

    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await prisma.problem.update(where={"id": problem_id}, data=data)
    return {"message": "Problem updated successfully", "problem": updated}


@app.delete("/admin/problems/{problem_id}")
async def delete_problem(
    problem_id: str,
    _admin: dict = Depends(require_admin)
):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Delete related test cases first
    await prisma.testcase.delete_many(where={"problemId": problem_id})
    # Remove from any contests
    await prisma.contestproblem.delete_many(where={"problemId": problem_id})
    # Delete the problem
    await prisma.problem.delete(where={"id": problem_id})

    return {"message": f"Problem '{problem_id}' deleted successfully"}


# --------------------------------------------------
# EDIT / DELETE CONTESTS  (missing endpoints)
# --------------------------------------------------

class ContestUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None


@app.put("/admin/contests/{contest_id}")
async def update_contest(
    contest_id: str,
    update: ContestUpdate,
    _admin: dict = Depends(require_admin)
):
    contest = await prisma.contest.find_unique(where={"id": contest_id})
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    data: dict = {}
    if update.title is not None:
        data["title"] = update.title
    if update.description is not None:
        data["description"] = update.description
    if update.start_time is not None:
        data["startTime"] = update.start_time
    if update.end_time is not None:
        data["endTime"] = update.end_time

    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await prisma.contest.update(where={"id": contest_id}, data=data)
    return {"message": "Contest updated successfully", "contest": updated}


@app.delete("/admin/contests/{contest_id}")
async def delete_contest(
    contest_id: str,
    _admin: dict = Depends(require_admin)
):
    contest = await prisma.contest.find_unique(where={"id": contest_id})
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    # Remove contest–problem links
    await prisma.contestproblem.delete_many(where={"contestId": contest_id})
    # Delete the contest
    await prisma.contest.delete(where={"id": contest_id})

    return {"message": f"Contest '{contest_id}' deleted successfully"}


# --------------------------------------------------
# ADD / REMOVE PROBLEMS IN EXISTING CONTEST  (missing endpoint)
# --------------------------------------------------

class ContestProblemsUpdate(BaseModel):
    problem_ids: list[str]


@app.put("/admin/contests/{contest_id}/problems")
async def update_contest_problems(
    contest_id: str,
    body: ContestProblemsUpdate,
    _admin: dict = Depends(require_admin)
):
    contest = await prisma.contest.find_unique(where={"id": contest_id})
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")

    # Validate all problems exist
    for pid in body.problem_ids:
        p = await prisma.problem.find_unique(where={"id": pid})
        if not p:
            raise HTTPException(status_code=404, detail=f"Problem '{pid}' not found")

    # Replace existing links
    await prisma.contestproblem.delete_many(where={"contestId": contest_id})
    for pid in body.problem_ids:
        await prisma.contestproblem.create(
            data={"contestId": contest_id, "problemId": pid}
        )

    return {
        "message": f"Contest problems updated ({len(body.problem_ids)} problems)",
        "contest_id": contest_id,
        "problem_ids": body.problem_ids
    }


# --------------------------------------------------
# ADMIN: ALL SUBMISSIONS  (missing endpoint)
# --------------------------------------------------

@app.get("/admin/submissions")
async def get_all_submissions(
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
    problem_id: str | None = None,
    contest_id: str | None = None,
    _admin: dict = Depends(require_admin)
):
    where: dict = {}
    if status:
        where["status"] = status
    if problem_id:
        where["problemId"] = problem_id
    if contest_id:
        where["contestId"] = contest_id

    total = await prisma.submission.count(where=where if where else None)
    submissions = await prisma.submission.find_many(
        where=where if where else None,
        order={"createdAt": "desc"},
        take=limit,
        skip=offset
    )

    # Enrich with user email and problem title
    result = []
    for s in submissions:
        user = await prisma.user.find_unique(where={"id": s.userId})
        problem = await prisma.problem.find_unique(where={"id": s.problemId})
        result.append({
            "id": s.id,
            "status": s.status,
            "languageId": s.languageId,
            "problemId": s.problemId,
            "problemTitle": problem.title if problem else s.problemId,
            "userId": s.userId,
            "userEmail": user.email if user else s.userId,
            "contestId": s.contestId,
            "executionTime": s.executionTime,
            "memory": s.memory,
            "createdAt": s.createdAt
        })

    return {"total": total, "count": len(result), "submissions": result}


# --------------------------------------------------
# ADMIN: ALL USERS  (missing endpoint for participants page)
# --------------------------------------------------

@app.get("/admin/users")
async def get_all_users(
    limit: int = 50,
    offset: int = 0,
    _admin: dict = Depends(require_admin)
):
    total = await prisma.user.count()
    users = await prisma.user.find_many(
        order={"createdAt": "desc"},
        take=limit,
        skip=offset
    )

    result = []
    for u in users:
        submission_count = await prisma.submission.count(where={"userId": u.id})
        accepted_count = await prisma.submission.count(
            where={"userId": u.id, "status": "ACCEPTED"}
        )
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name or u.email.split("@")[0],
            "role": u.role,
            "createdAt": u.createdAt,
            "submission_count": submission_count,
            "accepted_count": accepted_count
        })

    return {"total": total, "count": len(result), "users": result}


# --------------------------------------------------
# TEST CASE EDIT / DELETE  (missing endpoints)
# --------------------------------------------------

class TestCaseUpdate(BaseModel):
    input: str | None = None
    expected_output: str | None = None
    is_hidden: bool | None = None


@app.put("/admin/problems/{problem_id}/testcases/{testcase_id}")
async def update_testcase(
    problem_id: str,
    testcase_id: str,
    update: TestCaseUpdate,
    _admin: dict = Depends(require_admin)
):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    tc = await prisma.testcase.find_unique(where={"id": testcase_id})
    if not tc or tc.problemId != problem_id:
        raise HTTPException(status_code=404, detail="Test case not found")

    data: dict = {}
    if update.input is not None:
        data["input"] = update.input
    if update.expected_output is not None:
        data["expectedOutput"] = update.expected_output
    if update.is_hidden is not None:
        data["isHidden"] = update.is_hidden

    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await prisma.testcase.update(where={"id": testcase_id}, data=data)
    return {
        "message": "Test case updated",
        "test_case": {
            "id": updated.id,
            "input": updated.input,
            "expected_output": updated.expectedOutput,
            "is_hidden": updated.isHidden
        }
    }


@app.delete("/admin/problems/{problem_id}/testcases/{testcase_id}")
async def delete_testcase(
    problem_id: str,
    testcase_id: str,
    _admin: dict = Depends(require_admin)
):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    tc = await prisma.testcase.find_unique(where={"id": testcase_id})
    if not tc or tc.problemId != problem_id:
        raise HTTPException(status_code=404, detail="Test case not found")

    await prisma.testcase.delete(where={"id": testcase_id})
    return {"message": f"Test case {testcase_id} deleted"}


# --------------------------------------------------
# ANALYTICS ENDPOINTS  (missing — for analytics page)
# --------------------------------------------------

@app.get("/admin/analytics/overview")
async def get_analytics_overview(_admin: dict = Depends(require_admin)):
    """Aggregated platform-wide stats."""
    total_submissions = await prisma.submission.count()
    accepted_submissions = await prisma.submission.count(where={"status": "ACCEPTED"})
    total_problems = await prisma.problem.count()
    total_contests = await prisma.contest.count()
    total_users = await prisma.user.count(where={"role": "STUDENT"})

    acceptance_rate = round(
        (accepted_submissions / total_submissions * 100) if total_submissions > 0 else 0, 1
    )

    return {
        "total_submissions": total_submissions,
        "accepted_submissions": accepted_submissions,
        "acceptance_rate": acceptance_rate,
        "total_problems": total_problems,
        "total_contests": total_contests,
        "total_students": total_users,
    }


@app.get("/admin/analytics/problems")
async def get_analytics_problems(_admin: dict = Depends(require_admin)):
    """Per-problem attempt and acceptance stats."""
    problems = await prisma.problem.find_many(order={"createdAt": "asc"})
    result = []
    for p in problems:
        total_attempts = await prisma.submission.count(where={"problemId": p.id})
        accepted = await prisma.submission.count(where={"problemId": p.id, "status": "ACCEPTED"})
        rate = round((accepted / total_attempts * 100) if total_attempts > 0 else 0, 1)
        result.append({
            "id": p.id,
            "title": p.title,
            "difficulty": p.difficulty,
            "total_attempts": total_attempts,
            "accepted_count": accepted,
            "acceptance_rate": rate,
        })
    # Sort by total attempts descending
    result.sort(key=lambda x: x["total_attempts"], reverse=True)
    return result


@app.get("/admin/analytics/participation")
async def get_analytics_participation(_admin: dict = Depends(require_admin)):
    """Per-contest participation stats."""
    contests = await prisma.contest.find_many(order={"startTime": "asc"})
    now = datetime.now(timezone.utc)
    result = []
    for c in contests:
        start = c.startTime.replace(tzinfo=timezone.utc) if c.startTime.tzinfo is None else c.startTime
        end = c.endTime.replace(tzinfo=timezone.utc) if c.endTime.tzinfo is None else c.endTime
        status = "UPCOMING" if now < start else ("LIVE" if now <= end else "ENDED")

        # Unique participants who submitted in this contest
        subs = await prisma.submission.find_many(where={"contestId": c.id})
        unique_participants = len(set(s.userId for s in subs))
        total_subs = len(subs)
        accepted_subs = sum(1 for s in subs if s.status == "ACCEPTED")
        problem_count = await prisma.contestproblem.count(where={"contestId": c.id})

        result.append({
            "id": c.id,
            "title": c.title,
            "status": status,
            "startTime": c.startTime,
            "problem_count": problem_count,
            "unique_participants": unique_participants,
            "total_submissions": total_subs,
            "accepted_submissions": accepted_subs,
        })
    return result
