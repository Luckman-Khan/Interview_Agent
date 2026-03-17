# Mock Interview Agent

A Next.js mock interview application that lets a user upload a CV, paste a job description, run a Gemini-powered interview, answer by typing or speaking, and receive a structured performance report.

The live flow is:

1. Upload a PDF CV and paste a job description
2. Parse the CV and store session data
3. Generate an interview blueprint with Gemini
4. Run the interview turn by turn
5. Read each question aloud with ElevenLabs TTS
6. Let the candidate answer by typing or recording voice
7. Transcribe recorded answers with ElevenLabs STT
8. Generate a final interview report with Gemini

## Features

- PDF CV upload and text extraction with `pdf-parse`
- Demo autofill flow with a bundled sample resume
- Gemini-based interview blueprint generation
- Gemini-based interview question flow
- ElevenLabs text-to-speech for spoken interview questions
- ElevenLabs speech-to-text for recorded answers
- Redis-backed interview session state
- Supabase-backed session, question, and report storage
- S3 upload for CV file storage
- Dark-theme interview and report experience
- Vercel Analytics integration

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Gemini (`@google/generative-ai`)
- ElevenLabs
- Supabase
- Redis (`ioredis`)
- AWS S3

## Project Structure

```text
src/
  app/
    page.tsx                              Landing page
    interview/[sessionId]/
      page.tsx                            Interview page loader
      InterviewClient.tsx                 Interview UI, TTS, STT, text fallback
    report/[sessionId]/
      page.tsx                            Report page loader
      ReportClient.tsx                    Report UI
    api/
      upload/route.ts                     CV upload, parse, session creation
      blueprint/route.ts                  Interview blueprint generation
      interview/
        turn/route.ts                     Interview turn streaming
        speak/route.ts                    ElevenLabs TTS proxy
        transcribe/route.ts               ElevenLabs STT proxy
      report/generate/route.ts            Final report generation
  lib/
    gemini.ts                             Gemini client and schemas
    redis.ts                              Redis client
    s3.ts                                 S3 helper
    supabase.ts                           Supabase clients
  types/
    index.ts                              Shared TypeScript types

public/
  demo/Luckman_AIResume.pdf               Bundled demo resume

supabase-schema.sql                       Database schema
```

## Environment Variables

Create a `.env.local` file in the project root.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_bucket_name

REDIS_URL=rediss://default:your_password@your_host.upstash.io:6379

ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
```

Notes:

- `GEMINI_MODEL` is optional. The app defaults to `gemini-2.5-flash`.
- `ELEVENLABS_VOICE_ID` controls the interview voice used by `/api/interview/speak`.
- Keep `.env.local` out of version control.

## Setup

1. Install dependencies

```bash
npm install
```

2. Apply the database schema

Run `supabase-schema.sql` in your Supabase SQL editor.

3. Start the app

```bash
npm run dev
```

4. Open the app

```text
http://localhost:3000
```

## Demo Flow

The landing page includes an `Autofill Demo details` action.

When used, the app:

- fills the role and job description
- uses the bundled sample resume
- lets reviewers try the interview without searching for files first

## How the Interview Works

### 1. Upload

`/api/upload`

- validates the uploaded PDF
- parses the CV text with `pdf-parse`
- uploads the file to S3
- stores the session in Supabase

### 2. Blueprint

`/api/blueprint`

- sends the CV and job description to Gemini
- creates a structured blueprint:
  - role summary
  - topics to cover
  - skill gaps
  - red flags
  - opening question
  - difficulty progression

### 3. Interview

`/api/interview/turn`

- uses the saved blueprint, CV summary, job description, and conversation history
- streams one question at a time
- probes deeper when answers are vague
- ends after the configured question count

### 4. Voice Layer

`/api/interview/speak`

- converts each assistant question into audio using ElevenLabs TTS

`/api/interview/transcribe`

- sends recorded audio to ElevenLabs STT
- returns transcript text for the answer box

### 5. Report

`/api/report/generate`

- evaluates the finished interview with Gemini
- stores the report in Supabase
- returns the structured report to the UI

## Current Behaviour Notes

- The interview flow is adaptive, but the overall system is still mostly linear:
  upload -> blueprint -> interview -> report
- The first question is intentionally kept broad and easier than later questions
- Voice and typed answers coexist; typing remains the fallback path
- Silent voice captures can auto-send after transcription, while manual mic stops leave the text editable

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Known Limitations

- The interview loop is prompt-driven, not a full agentic controller
- Voice quality and transcription accuracy depend on browser mic support and ElevenLabs responses
- The `elevenlabs` package currently shows a deprecation warning, but the app uses direct `fetch` calls for the ElevenLabs routes
- Authentication is still prototype-level
- The report is rendered in-app rather than exported as a PDF

## Useful Files

- [src/app/page.tsx](C:/Projects/Interview_Agent/GPT_5.4/src/app/page.tsx)
- [src/app/api/blueprint/route.ts](C:/Projects/Interview_Agent/GPT_5.4/src/app/api/blueprint/route.ts)
- [src/app/api/interview/turn/route.ts](C:/Projects/Interview_Agent/GPT_5.4/src/app/api/interview/turn/route.ts)
- [src/app/api/interview/speak/route.ts](C:/Projects/Interview_Agent/GPT_5.4/src/app/api/interview/speak/route.ts)
- [src/app/api/interview/transcribe/route.ts](C:/Projects/Interview_Agent/GPT_5.4/src/app/api/interview/transcribe/route.ts)
- [src/app/api/report/generate/route.ts](C:/Projects/Interview_Agent/GPT_5.4/src/app/api/report/generate/route.ts)
