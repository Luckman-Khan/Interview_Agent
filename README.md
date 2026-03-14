# Mock Interview Agent

An AI-powered mock interview platform that simulates a real, voice-driven interview experience. Built as part of the JSO Phase-2 Agentic Career Intelligence ecosystem.

---

## What It Does

1. User uploads their CV and pastes a Job Description
2. The system parses the CV and generates a personalised Interview Blueprint
3. A voice-first interview begins — the agent asks questions, the user speaks answers
4. The agent autonomously decides its next action after each answer (probe deeper, advance topic, challenge, or close)
5. A performance report is generated and delivered to both the user and the HR Consultant Dashboard

---

## Tech Stack

### Frontend + API (JavaScript/TypeScript)
- **Next.js 14** — Frontend and API routes
- **Node.js** — API Gateway, session routing, quota enforcement
- **Vercel** — Hosting

### AI Layer (Python Microservice)
- **Python + FastAPI** — Exposes the agentic loop as an internal HTTP endpoint
- **LangGraph** — StateGraph with conditional edges for autonomous decision making
- **Gemini 2.5 Flash** — Blueprint generation, structuring, agentic loop reasoning
- **Gemini 3.1 Pro** — Final report synthesis

### AWS Services
- **AWS S3** — CV storage and PDF report storage
- **AWS Textract** — Layout-aware CV parsing
- **AWS Transcribe** — Real-time speech to text
- **AWS Lambda** — Serverless compute for upload, blueprint, scoring, report routes
- **AWS ElastiCache (Redis)** — Sub-millisecond live session state

### Google Cloud
- **Google Cloud TTS (Neural2)** — Voices interview questions aloud

### Database
- **Supabase (PostgreSQL)** — Blueprint, scores, structured report data

---

## Project Structure

```
mock-interview-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page — CV + JD upload
│   │   ├── interview/
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx            # Live interview chat UI
│   │   ├── report/
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx            # Performance report display
│   │   └── api/
│   │       ├── upload/route.ts         # CV upload + S3 + pdf-parse
│   │       ├── blueprint/route.ts      # Blueprint generation
│   │       ├── interview/
│   │       │   └── turn/route.ts       # Calls Python FastAPI agent service
│   │       └── report/
│   │           └── generate/route.ts   # Report synthesis
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client
│   │   ├── redis.ts                    # Redis client
│   │   └── s3.ts                       # S3 upload helper
│   └── types/
│       └── index.ts                    # Shared TypeScript interfaces
│
└── agent-service/                      # Python FastAPI microservice
    ├── main.py                         # FastAPI app — POST /agent/turn
    ├── graph.py                        # LangGraph StateGraph definition
    ├── tools.py                        # ask_followup, advance_topic, challenge, close_interview
    ├── state.py                        # InterviewState schema
    └── requirements.txt
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
S3_BUCKET_NAME=your_bucket_name_here

# Redis (Upstash)
REDIS_URL=rediss://default:your_password@your_host.upstash.io:6379
```

Create a `.env` file inside `agent-service/`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
REDIS_URL=rediss://default:your_password@your_host.upstash.io:6379
```

> Never commit `.env.local` or `.env` to version control. Both are already covered by `.gitignore` in a standard Next.js project.

---

## Database Setup

Copy the contents of `supabase-schema.sql` (included in the project root) and run it in your Supabase SQL Editor.

Go to your Supabase project → SQL Editor → New Query → paste → Run.

Once successful, three tables will appear in your Table Editor:
- `interview_sessions`
- `interview_questions`
- `interview_reports`

---

## Getting Started

### 1. Install Next.js dependencies

```bash
npm install
```

### 2. Install Python dependencies

```bash
cd agent-service
pip install -r requirements.txt
```

### 3. Run the Python agent service

```bash
cd agent-service
uvicorn main:app --reload --port 8000
```

### 4. Run the Next.js app

```bash
npm run dev
```

Open `http://localhost:3000`

---

## How the Agentic Loop Works

The interview turn is powered by a **LangGraph StateGraph** running inside the Python FastAPI service. On every turn:

```
User speaks answer
      ↓
AWS Transcribe converts to text
      ↓
Redis fetches full conversation history
      ↓
reason_and_decide node (Gemini 2.5 Flash)
autonomously selects one of four tools:
      ↓
┌─────────────────┬──────────────────┬───────────┬─────────────────┐
│  ask_followup   │  advance_topic   │ challenge │ close_interview │
│  Probe deeper   │  Move forward    │ Push back │  Wrap up        │
└─────────────────┴──────────────────┴───────────┴─────────────────┘
      ↓
Google Cloud TTS voices the next question
      ↓
Node.js streams audio back to browser
```

Node.js calls the Python service via a single HTTP request:

```
POST http://localhost:8000/agent/turn
{ session_id, user_answer, blueprint, questions_asked }
```

---

## Agent Outputs

| Output | When Generated | Model |
|---|---|---|
| Discussion Topics | Blueprint generation (pre-session) | Gemini 2.5 Flash |
| Career Questions | Every conversation turn (adaptive) | Gemini 2.5 Flash |
| Interview Prep Advice | End of session report | Gemini 3.1 Pro |

---

## Prototype Limitations

The current prototype intentionally excludes:

- User authentication (hardcoded `prototype-user`)
- AWS Textract (replaced with `pdf-parse` for cost)
- AWS Transcribe (text input only in prototype)
- Google Cloud TTS (text responses only in prototype)
- PDF report generation (report shown as UI cards)
- HR Consultant Dashboard (only User Dashboard implemented)

These are all designed and documented in the architecture but deferred from the prototype build.

---

## Built For

JSO Phase-2 — Agentic Career Intelligence Ecosystem
Aariyatech Corp Private Limited — Agentic AI Engineer Intern Assignment