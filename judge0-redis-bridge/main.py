
import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import httpx
import jwt
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
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
     "redis://127.0.0.1:6380"
)

QUEUE_NAME = "judge0_queue"
RATE_LIMIT = 5
RATE_WINDOW_SECONDS = 60

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

prisma = Prisma()
redis_client = None
worker_task = None
http_client = None


# --------------------------------------------------
# APPLICATION LIFECYCLE
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, worker_task, http_client

    await prisma.connect()

    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0)
    )

    try:
        redis_client = redis.Redis(
        host="127.0.0.1",
        port=6380,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=None
    )

        await redis_client.ping()

        print("Connected to ZeroSJT Redis")

        worker_task = asyncio.create_task(
            judge0_worker()
        )

        print("Judge0 worker started")

    except Exception as exc:
        print(f"Redis connection failed: {exc}")
        print("Submissions cannot be processed until Redis is available.")

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
    title="ZeroSJT Code Judge API",
    version="2.0.0",
    lifespan=lifespan
)


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class CodeSubmit(BaseModel):
    problem_id: str
    user_id: str
    language_id: int
    source_code: str


class Judge0Webhook(BaseModel):
    status: dict
    stdout: str | None = None
    stderr: str | None = None
    compile_output: str | None = None


class ProblemCreate(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str


class ProblemResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
async def health_check():
    redis_ok = False
    judge0_ok = False

    if redis_client:
        try:
            await redis_client.ping()
            redis_ok = True
        except Exception:
            pass

    if http_client:
        try:
            response = await http_client.get(
                f"{JUDGE0_URL}/languages",
                timeout=5
            )
            judge0_ok = response.is_success
        except Exception:
            pass

    return {
        "status": "ok",
        "redis": redis_ok,
        "judge0": judge0_ok
    }


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/register")
async def register_user(user: UserCreate):
    existing_user = await prisma.user.find_unique(
        where={"email": user.email}
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = pwd_context.hash(user.password)

    new_user = await prisma.user.create(
        data={
            "email": user.email,
            "password": hashed_password
        }
    )

    return {
        "message": "User created successfully!",
        "user_id": new_user.id
    }


@app.post("/login")
async def login_user(user: UserLogin):
    db_user = await prisma.user.find_unique(
        where={"email": user.email}
    )

    if not db_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )

    if not pwd_context.verify(
        user.password,
        db_user.password
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid email or password"
        )

    expire = datetime.utcnow() + timedelta(hours=2)

    payload = {
        "sub": db_user.id,
        "email": db_user.email,
        "exp": expire
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# --------------------------------------------------
# PROBLEMS
# --------------------------------------------------

@app.post("/admin/problems")
async def create_problem(problem: ProblemCreate):
    existing = await prisma.problem.find_unique(
        where={"id": problem.id}
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Problem ID already exists"
        )

    new_problem = await prisma.problem.create(
        data={
            "id": problem.id,
            "title": problem.title,
            "description": problem.description,
            "difficulty": problem.difficulty
        }
    )

    return {
        "message": "Problem created successfully!",
        "problem": new_problem
    }


@app.get("/problems")
async def get_all_problems():
    return await prisma.problem.find_many()


@app.get("/problems/{problem_id}")
async def get_problem(problem_id: str):
    problem = await prisma.problem.find_unique(
        where={"id": problem_id}
    )

    if not problem:
        raise HTTPException(
            status_code=404,
            detail="Problem not found"
        )

    return problem


# --------------------------------------------------
# REDIS QUEUE PUSHER
# --------------------------------------------------

async def push_to_queue(
    submission_id: str,
    problem_id: str,
    source_code: str,
    language_id: int
):
    try:
        if not redis_client:
            await prisma.submission.update(
                where={"id": submission_id},
                data={"status": "INTERNAL_ERROR"}
            )
            return

        job_data = {
            "submission_id": submission_id,
            "problem_id": problem_id,
            "source_code": source_code,
            "language_id": language_id
        }

        # LPUSH + BRPOP = FIFO queue
        await redis_client.lpush(
            QUEUE_NAME,
            json.dumps(job_data)
        )

        await prisma.submission.update(
            where={"id": submission_id},
            data={"status": "IN_QUEUE"}
        )

        print(f"Queued submission: {submission_id}")

    except Exception as exc:
        print(f"Queue push failed: {exc}")

        try:
            await prisma.submission.update(
                where={"id": submission_id},
                data={"status": "INTERNAL_ERROR"}
            )
        except Exception:
            pass


# --------------------------------------------------
# JUDGE0 WORKER
# --------------------------------------------------

@app.get("/judge0/languages")
async def get_judge0_languages():
    try:
        response = await http_client.get(
            f"{JUDGE0_URL}/languages"
        )
        response.raise_for_status()
        return response.json()

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Judge0 unavailable: {str(exc)}"
        )


async def judge0_worker():
    print("Waiting for jobs in Redis queue...")

    while True:
        try:
            if not redis_client:
                await asyncio.sleep(2)
                continue

            item = await redis_client.brpop(
                QUEUE_NAME,
                timeout=5
            )

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

                # Fetch test cases for this problem
                test_cases = await prisma.testcase.find_many(
                    where={"problemId": job["problem_id"]}
                )

                # Do not accept a submission without test cases
                if not test_cases:
                    await prisma.submission.update(
                        where={"id": submission_id},
                        data={"status": "INTERNAL_ERROR"}
                    )
                    print(
                        f"Submission {submission_id}: "
                        "No test cases found"
                    )
                    continue

                all_passed = True
                final_status = "ACCEPTED"

                last_stdout = None
                last_stderr = None
                last_compile_output = None
                last_execution_time = None
                last_memory = None

                # Run the submitted program against every test case
                for test_case in test_cases:
                    payload = {
                        "source_code": job["source_code"],
                        "language_id": job["language_id"],
                        "stdin": test_case.input
                    }

                    response = await http_client.post(
                        (
                            f"{JUDGE0_URL}/submissions"
                            "?base64_encoded=false&wait=true"
                        ),
                        json=payload
                    )

                    response.raise_for_status()
                    result = response.json()

                    status_description = (
                        result.get("status", {})
                        .get("description", "Internal Error")
                    )

                    last_stdout = result.get("stdout")
                    last_stderr = result.get("stderr")
                    last_compile_output = result.get(
                        "compile_output"
                    )
                    last_execution_time = result.get("time")
                    last_memory = result.get("memory")

                    # Compilation error
                    if status_description == "Compilation Error":
                        final_status = "COMPILATION_ERROR"
                        all_passed = False
                        break

                    # Runtime error or other execution failure
                    if status_description != "Accepted":
                        if status_description == "Time Limit Exceeded":
                            final_status = "TIME_LIMIT_EXCEEDED"
                        elif status_description == "Runtime Error":
                            final_status = "RUNTIME_ERROR"
                        else:
                            final_status = (
                                status_description.upper()
                                .replace(" ", "_")
                            )

                        all_passed = False
                        break

                    # Compare actual and expected output
                    actual_output = (last_stdout or "").strip()
                    expected_output = (
                        test_case.expectedOutput or ""
                    ).strip()

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
                        "executionTime": (
                            str(last_execution_time)
                            if last_execution_time is not None
                            else None
                        ),
                        "memory": last_memory
                    }
                )

                print(
                    f"Submission {submission_id}: "
                    f"{final_status}"
                )

            except Exception as exc:
                print(
                    f"Submission {submission_id} failed: {exc}"
                )

                try:
                    await prisma.submission.update(
                        where={"id": submission_id},
                        data={"status": "INTERNAL_ERROR"}
                    )
                except Exception:
                    pass

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(f"Worker error: {exc}")
            await asyncio.sleep(2)


# --------------------------------------------------
# SUBMIT CODE
# --------------------------------------------------

@app.post("/submit")
async def submit_code(
    submission: CodeSubmit,
    background_tasks: BackgroundTasks
):
    if not redis_client:
        raise HTTPException(
            status_code=503,
            detail="Redis queue is unavailable"
        )

    # Validate the user
    user = await prisma.user.find_unique(
        where={"id": submission.user_id}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found. Register first."
        )

    # Validate the problem
    problem = await prisma.problem.find_unique(
        where={"id": submission.problem_id}
    )

    if not problem:
        raise HTTPException(
            status_code=404,
            detail="Problem not found"
        )

    # Rate limiting: 5 submissions per 60 seconds
    rate_key = f"rate_limit:{submission.user_id}"

    request_count = await redis_client.incr(rate_key)

    if request_count == 1:
        await redis_client.expire(
            rate_key,
            RATE_WINDOW_SECONDS
        )

    if request_count > RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Wait 60 seconds."
        )

    # Create database record
    new_submission = await prisma.submission.create(
        data={
            "problemId": submission.problem_id,
            "userId": submission.user_id,
            "languageId": submission.language_id,
            "code": submission.source_code,
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
# GET SUBMISSION STATUS
# --------------------------------------------------

@app.get("/status/{submission_id}")
async def get_submission_status(submission_id: str):
    submission = await prisma.submission.find_unique(
        where={"id": submission_id}
    )

    if not submission:
        raise HTTPException(
            status_code=404,
            detail="Submission not found"
        )

    return {
        "submission_id": submission.id,
        "status": submission.status,
        "language_id": submission.languageId,
        "problem_id": submission.problemId,
        "created_at": submission.createdAt
    }


# --------------------------------------------------
# WEBHOOK
# --------------------------------------------------

@app.put("/webhook/{submission_id}")
async def judge_webhook(
    submission_id: str,
    result: Judge0Webhook
):
    submission = await prisma.submission.find_unique(
        where={"id": submission_id}
    )

    if not submission:
        raise HTTPException(
            status_code=404,
            detail="Submission not found"
        )

    final_status = (
        result.status.get("description", "ERROR")
        .upper()
    )

    await prisma.submission.update(
        where={"id": submission_id},
        data={"status": final_status}
    )

    return {
        "message": "Database updated successfully",
        "status": final_status
    }


# --------------------------------------------------
# USER SUBMISSION HISTORY
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


# --------------------------------------------------
# LEADERBOARD
# --------------------------------------------------

@app.get("/leaderboard")
async def get_leaderboard():
    submissions = await prisma.submission.find_many(
        where={"status": "ACCEPTED"}
    )

    scores = {}

    for submission in submissions:
        user_id = submission.userId
        scores[user_id] = scores.get(user_id, 0) + 1

    ranked_users = [
        {
            "userId": user_id,
            "accepted_count": count
        }
        for user_id, count in sorted(
            scores.items(),
            key=lambda item: item[1],
            reverse=True
        )
    ]

    return {"leaderboard": ranked_users}


# --------------------------------------------------
# USER PROFILE STATS
# --------------------------------------------------

@app.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str):
    submissions = await prisma.submission.find_many(
        where={"userId": user_id}
    )

    total_attempts = len(submissions)

    accepted_attempts = sum(
        1 for submission in submissions
        if submission.status == "ACCEPTED"
    )

    win_rate = (
        accepted_attempts / total_attempts * 100
        if total_attempts > 0
        else 0
    )

    return {
        "userId": user_id,
        "total_attempts": total_attempts,
        "accepted_attempts": accepted_attempts,
        "win_rate_percentage": round(win_rate, 2)
    }

