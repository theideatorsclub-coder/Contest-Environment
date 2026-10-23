import asyncio
import json
import os
import uuid
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
    allow_origins=["*"],
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

    if http_client:
        try:
            response = await http_client.get(f"{JUDGE0_URL}/languages", timeout=4)
            judge0_ok = response.is_success
        except Exception:
            judge0_ok = False

    return {
        "status": "ok",
        "service": "TIC Contest Platform API",
        "redis": redis_ok,
        "judge0": judge0_ok
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
async def get_problem_testcases(problem_id: str, include_hidden: bool = False):
    problem = await prisma.problem.find_unique(where={"id": problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

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
    """Executes code directly against Judge0 with custom stdin for rapid testing in editor."""
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

    # Queue the job
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

