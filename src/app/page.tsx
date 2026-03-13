"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Stage = "idle" | "uploading" | "blueprint";

export default function HomePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

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
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while starting the interview.",
      );
      setStage("idle");
    }
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
                <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="cv">
                  CV (PDF only)
                </label>
                <input
                  id="cv"
                  name="cv"
                  type="file"
                  accept="application/pdf"
                  required
                  className="block w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
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
