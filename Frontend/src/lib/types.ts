// Shared TypeScript types for TIC Contest - matching backend Prisma models and API responses.

// ---- Auth ----
export interface User {
  email: string;
  userId: string;
  name: string;
  role: "ADMIN" | "STUDENT" | string;
}

export type UserPayload = User;

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
}

// ---- Problems ----
export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  test_cases_count?: number;
  createdAt?: string;
}

export interface ProblemDetail extends Problem {
  sample_test_cases?: SampleTestCase[];
}

export interface SampleTestCase {
  input: string;
  expected_output: string;
}

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

export interface TestCaseInput {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

// ---- Contests ----
export type ContestStatus = "UPCOMING" | "LIVE" | "ENDED";

export interface Contest {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: ContestStatus;
  problem_count: number;
}

export interface ContestProblem {
  id: string;
  title: string;
  difficulty: string;
  points: number;
}

export interface ContestDetail {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  problems: ContestProblem[];
}

export interface StandingUser {
  rank: number;
  userId: string;
  username: string;
  problems_solved: number;
  total_points: number;
  total_penalty_minutes: number;
  problem_results: Record<string, { solved: boolean; attempts: number; solved_at?: number }>;
}

export interface ContestLeaderboard {
  contest_id: string;
  contest_title: string;
  problems: { id: string; points: number }[];
  standings: StandingUser[];
}

// ---- Submissions ----
export type SubmissionStatus =
  | "PENDING"
  | "IN_QUEUE"
  | "PROCESSING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "COMPILATION_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "JUDGE0_UNAVAILABLE"
  | "QUEUE_OFFLINE"
  | "INTERNAL_ERROR"
  | string;

export interface Submission {
  id: string;
  code: string;
  languageId: number;
  status: SubmissionStatus;
  problemId: string;
  userId: string;
  contestId: string | null;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  executionTime: string | null;
  memory: number | null;
  createdAt: string;
}

export interface SubmissionStatusResponse {
  submission_id: string;
  status: SubmissionStatus;
  language_id: number;
  problem_id: string;
  created_at: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  execution_time: string | null;
  memory: number | null;
}

// ---- Leaderboard ----
export interface LeaderboardUser {
  rank: number;
  userId: string;
  username: string;
  accepted_count: number;
}

// ---- User Stats ----
export interface UserStats {
  userId: string;
  total_attempts: number;
  accepted_attempts: number;
  win_rate_percentage: number;
}

// ---- User Submissions ----
export interface UserSubmissionsResponse {
  count: number;
  submissions: Submission[];
}
