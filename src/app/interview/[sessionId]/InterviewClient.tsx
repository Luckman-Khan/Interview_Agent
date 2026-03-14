"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type InterviewClientProps = {
  sessionId: string;
  jobTitle: string;
  openingQuestion: string;
};

export function InterviewClient({
  sessionId,
  jobTitle,
  openingQuestion,
}: InterviewClientProps) {
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: openingQuestion },
  ]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const thread = threadRef.current;

    if (thread) {
      thread.scrollTo({
        top: thread.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  async function handleSend() {
    const trimmedAnswer = answer.trim();

    if (!trimmedAnswer || isSending || isComplete) {
      return;
    }

    setError(null);
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedAnswer },
      { role: "assistant", content: "" },
    ]);
    setAnswer("");

    try {
      const response = await fetch("/api/interview/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          userAnswer: trimmedAnswer,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to continue interview.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantMessage = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event
            .split("\n")
            .find((entry) => entry.startsWith("data: "));

          if (!line) {
            continue;
          }

          const payload = JSON.parse(line.slice(6)) as {
            delta?: string;
            error?: string;
            done?: boolean;
          };

          if (payload.error) {
            throw new Error(payload.error);
          }

          if (payload.delta) {
            assistantMessage += payload.delta;

            setMessages((current) => {
              const nextMessages = [...current];
              const lastMessage = nextMessages[nextMessages.length - 1];

              if (lastMessage?.role === "assistant") {
                lastMessage.content = assistantMessage;
              }

              return nextMessages;
            });
          }
        }
      }

      if (assistantMessage.includes("INTERVIEW_COMPLETE")) {
        setIsComplete(true);
      }
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to continue the interview.",
      );

      setMessages((current) => current.slice(0, -1));
      setAnswer(trimmedAnswer);
    } finally {
      setIsSending(false);
    }
  }

  async function handleEndInterview() {
    if (isEndingInterview) {
      return;
    }

    setError(null);
    setIsEndingInterview(true);

    try {
      const response = await fetch("/api/report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate report.");
      }

      startTransition(() => {
        router.push(`/report/${sessionId}`);
      });
    } catch (endError) {
      setError(
        endError instanceof Error ? endError.message : "Failed to end interview cleanly.",
      );
      setIsEndingInterview(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Live Interview
            </p>
            <h1 className="text-lg font-semibold text-white">{jobTitle}</h1>
          </div>
          <button
            type="button"
            onClick={handleEndInterview}
            disabled={isPending || isEndingInterview}
            className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEndingInterview ? "Ending interview..." : "End Interview"}
          </button>
        </div>
      </header>

      <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-3xl rounded-3xl px-5 py-4 text-sm leading-7 shadow-lg ${
                message.role === "assistant"
                  ? "self-start bg-slate-800 text-slate-100"
                  : "self-end bg-blue-600 text-white"
              }`}
            >
              {message.content ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mx-auto mb-4 w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        </div>
      ) : null}

      {isEndingInterview ? (
        <div className="mx-auto mb-4 w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Ending the interview and preparing your report...
          </div>
        </div>
      ) : null}

      {isComplete ? (
        <div className="border-t border-slate-800 bg-slate-900 px-6 py-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-sm text-slate-300">
              The interview is complete. Generate the performance report when you&apos;re
              ready.
            </p>
            <button
              type="button"
              onClick={handleEndInterview}
              disabled={isPending || isEndingInterview}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEndingInterview ? "Generating Report..." : "Generate Report"}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-800 bg-slate-900 px-6 py-6">
          <div className="mx-auto flex max-w-5xl gap-4">
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={3}
              placeholder="Type your answer here..."
              disabled={isEndingInterview}
              className="min-h-[84px] flex-1 rounded-3xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm leading-6 text-white outline-none transition focus:border-blue-400 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || isEndingInterview || !answer.trim()}
              className="self-end rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
