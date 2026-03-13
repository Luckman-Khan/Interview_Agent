create extension if not exists pgcrypto;

create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  job_title text,
  status text not null check (status in ('uploading', 'ready', 'active', 'completed')),
  cv_s3_key text,
  cv_parsed_text text,
  jd_text text,
  blueprint jsonb,
  created_at timestamptz not null default now()
);

create table if not exists interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  question text,
  answer text,
  turn_number integer,
  created_at timestamptz not null default now()
);

create table if not exists interview_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  overall_score integer,
  strengths text[],
  weaknesses text[],
  topics_covered text[],
  topics_missed text[],
  recommended_focus text,
  created_at timestamptz not null default now()
);
