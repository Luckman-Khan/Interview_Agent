"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toUserFriendlyError } from "@/lib/user-errors";

type Stage = "idle" | "uploading" | "blueprint";

const DEMO_JOB_TITLE = "AI Engineer Intern";

const DEMO_JOB_DESCRIPTION = `Role Overview

We are looking for a Python Developer - Agentic AI to join our growing AI team.

You will work on building intelligent, production-ready AI systems using modern LLM frameworks and backend technologies. This role offers hands-on exposure to real-world AI product development.

Key Responsibilities

Build agentic AI workflows (tool usage, multi-step reasoning, decision flows)
Develop and maintain RAG (Retrieval-Augmented Generation) pipelines
Integrate LLM APIs (OpenAI, Anthropic, etc.) into live products
Design and maintain scalable FastAPI-based backend services
Work on API integrations, databases, and third-party services
Write clean, scalable, and production-ready Python code
Collaborate closely with product and engineering teams

Required Qualification

B.Tech / B.E. in Computer Science, AI, Data Science, Mathematics, or related field
Strong foundation in Mathematics (Statistics, Probability, Linear Algebra)

Must Have Skills

Strong Python fundamentals (OOP, async programming, API design, error handling)
Hands-on experience with FastAPI or Flask
Experience integrating LLMs (OpenAI / Anthropic or similar APIs)
Understanding of RAG pipelines
Basic knowledge of Vector Databases
Strong grasp of Statistics & Probability
API integration & JSON handling
Git and clean coding practices

Good to Have

Experience with LangChain / LlamaIndex
Knowledge of Vector Databases (pgvector, Pinecone, Weaviate)
Basic understanding of Docker
Prompt engineering experience
0-24 months of experience in Python / AI development
OR
Strong AI/ML academic projects
Freshers must showcase real AI projects on GitHub.

Why to join us?

Competitive salary package
High-growth AI exposure in live products
Opportunity to work on next-gen Agentic AI systems
Collaborative and innovative work culture

Industry

IT Services and IT Consulting

Employment Type

Full-time

Job Types: Full-time, Permanent

Pay: Rs20,000.00 - Rs40,000.00 per month

Benefits:

Health insurance
Paid sick time
Paid time off
Provident Fund`;

export default function HomePage() {
  const router = useRouter();
  const cvInputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [usePreloadedDetails, setUsePreloadedDetails] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function startInterview(formData: FormData) {
    setError(null);

    try {
      setStage("uploading");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = (await uploadResponse.json()) as {
        sessionId?: string;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadResult.sessionId) {
        throw new Error(uploadResult.error ?? "Failed to upload CV.");
      }

      setStage("blueprint");

      const blueprintResponse = await fetch("/api/blueprint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: uploadResult.sessionId }),
      });

      const blueprintResult = (await blueprintResponse.json()) as {
        error?: string;
      };

      if (!blueprintResponse.ok) {
        throw new Error(blueprintResult.error ?? "Failed to generate interview blueprint.");
      }

      startTransition(() => {
        router.push(`/interview/${uploadResult.sessionId}`);
      });
    } catch (submitError) {
      setError(
        toUserFriendlyError(
          submitError instanceof Error
            ? submitError.message
            : "Something went wrong while starting the interview.",
          "startup",
        ),
      );
      setStage("idle");
    }
  }

  async function appendDemoResume(formData: FormData) {
    const demoResumeResponse = await fetch("/demo/Luckman_AIResume.pdf");

    if (!demoResumeResponse.ok) {
      throw new Error("The bundled demo resume could not be loaded.");
    }

    const demoResumeBlob = await demoResumeResponse.blob();
    formData.append(
      "cv",
      new File([demoResumeBlob], "Luckman_AIResume.pdf", {
        type: "application/pdf",
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedCv = formData.get("cv");
    const hasUploadedCv = selectedCv instanceof File && selectedCv.size > 0;

    if (!hasUploadedCv) {
      if (!usePreloadedDetails) {
        setError("Please upload a CV PDF or use the pre loaded details.");
        return;
      }

      formData.delete("cv");
      await appendDemoResume(formData);
    }

    await startInterview(formData);
  }

  const loadingText =
    stage === "uploading"
      ? "Parsing your CV..."
      : stage === "blueprint"
        ? "Generating your interview blueprint..."
        : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.24),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#020617_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <section className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-sm font-medium text-blue-200 shadow-sm backdrop-blur">
              Job Search Optimiser
            </div>
            <h1 className="mt-6 max-w-2xl text-5xl font-semibold tracking-tight text-white">
              Mock Interview Agent
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Upload your CV and paste the Job Description to begin.
            </p>
            <div className="mt-8 grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/65 p-4 shadow-sm backdrop-blur">
                Direct PDF CV parsing
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/65 p-4 shadow-sm backdrop-blur">
                Gemini-powered interview flow
              </div>
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/65 p-4 shadow-sm backdrop-blur">
                Structured performance report
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/85 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-200" htmlFor="cv">
                    CV (PDF only)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setJobTitle(DEMO_JOB_TITLE);
                      setJobDescription(DEMO_JOB_DESCRIPTION);
                      setUsePreloadedDetails(true);

                      if (cvInputRef.current) {
                        cvInputRef.current.value = "";
                      }
                    }}
                    disabled={stage !== "idle" || isPending}
                    className="text-xs font-medium text-blue-300 transition hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Autofill Demo details
                  </button>
                </div>
                <input
                  ref={cvInputRef}
                  id="cv"
                  name="cv"
                  type="file"
                  accept="application/pdf"
                  onChange={() => setUsePreloadedDetails(false)}
                  className="block w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
                {usePreloadedDetails ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Demo resume ready. The bundled PDF, role, and job description will be used
                    when you start the interview.
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium text-slate-200"
                  htmlFor="jobTitle"
                >
                  Job Title
                </label>
                <input
                  id="jobTitle"
                  name="jobTitle"
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Senior Product Analyst"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="jd">
                  Job Description
                </label>
                <textarea
                  id="jd"
                  name="jd"
                  required
                  rows={12}
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Paste the full job description here..."
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={stage !== "idle" || isPending}
                className="w-full rounded-2xl bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {loadingText ?? "Start Interview"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
