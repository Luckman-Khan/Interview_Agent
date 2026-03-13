"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { InterviewReport } from "@/types";

type ReportClientProps = {
  sessionId: string;
  jobTitle: string;
};

type ReportResponse = {
  report?: InterviewReport;
  jobTitle?: string;
  error?: string;
};

export function ReportClient({ sessionId, jobTitle }: ReportClientProps) {
  const router = useRouter();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function generateReport() {
      try {
        const response = await fetch("/api/report/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        const payload = (await response.json()) as ReportResponse;

        if (!response.ok || !payload.report) {
          throw new Error(payload.error ?? "Failed to generate report.");
        }

        if (isMounted) {
          setReport(payload.report);
        }
      } catch (reportError) {
        if (isMounted) {
          setError(
            reportError instanceof Error
              ? reportError.message
              : "Failed to generate report.",
          );
        }
      }
    }

    generateReport();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const scoreColor = useMemo(() => {
    if (!report) {
      return "text-slate-300";
    }

    if (report.overall_score > 70) {
      return "text-emerald-500";
    }

    if (report.overall_score >= 50) {
      return "text-amber-500";
    }

    return "text-rose-500";
  }, [report]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-slate-900/90 p-8 shadow-xl">
          <h1 className="text-2xl font-semibold text-white">
            Interview Performance Report
          </h1>
          <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-300">
            Generating Report
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Interview Performance Report
          </h1>
          <p className="mt-4 text-base text-slate-300">
            Analysing the interview transcript and building your final assessment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#020617_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-[2rem] border border-slate-800 bg-slate-900/85 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-300">
            Final Assessment
          </p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-white">
                Interview Performance Report
              </h1>
              <p className="mt-3 text-lg text-slate-300">{jobTitle}</p>
            </div>
            <div className="rounded-3xl border border-slate-700 bg-slate-950 px-8 py-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Score</p>
              <p className={`mt-2 text-5xl font-semibold ${scoreColor}`}>
                {report.overall_score}
                <span className="text-2xl text-slate-400">/100</span>
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-emerald-500/20 bg-slate-900/85 p-8 shadow-lg">
            <h2 className="text-2xl font-semibold text-emerald-300">Strengths</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
              {report.strengths.map((strength) => (
                <li
                  key={strength}
                  className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3"
                >
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2rem] border border-rose-500/20 bg-slate-900/85 p-8 shadow-lg">
            <h2 className="text-2xl font-semibold text-rose-300">Weaknesses</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
              {report.weaknesses.map((weakness) => (
                <li
                  key={weakness}
                  className="rounded-2xl border border-rose-500/15 bg-rose-500/10 px-4 py-3"
                >
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/85 p-8 shadow-lg">
            <h2 className="text-xl font-semibold text-white">Topics Covered</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {report.topics_covered.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/85 p-8 shadow-lg">
            <h2 className="text-xl font-semibold text-white">Topics Missed</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {report.topics_missed.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-blue-500/20 bg-slate-900/85 p-8 shadow-lg">
          <h2 className="text-2xl font-semibold text-white">Recommended Focus</h2>
          <p className="mt-4 rounded-3xl border border-blue-500/20 bg-blue-500/10 px-5 py-5 text-sm leading-7 text-slate-200">
            {report.recommended_focus}
          </p>
        </section>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            Start New Interview
          </button>
        </div>
      </div>
    </main>
  );
}
