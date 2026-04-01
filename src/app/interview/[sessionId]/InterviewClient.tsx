"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const shouldAutoSendTranscriptRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastSpokenMessageRef = useRef("");
  const silenceIntervalRef = useRef<number | null>(null);
  const lastAudioActivityAtRef = useRef<number>(Date.now());
  const autoStopTimeoutRef = useRef<number | null>(null);
  const autoSendTimeoutRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: openingQuestion },
  ]);
  const [answer, setAnswer] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      cleanupRecordingResources();
      clearAutoSendTimer();
    };
  }, []);

  const playQuestionAudioEvent = useEffectEvent(async (text: string) => {
    try {
      stopAudioPlayback();

      const response = await fetch("/api/interview/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to generate audio.");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioRef.current = audio;
      audioUrlRef.current = audioUrl;
      setIsSpeaking(true);

      audio.onended = () => {
        stopAudioPlayback();
      };

      audio.onerror = () => {
        stopAudioPlayback();
      };

      await audio.play();
    } catch (audioError) {
      stopAudioPlayback();
      console.error("Question audio playback failed:", audioError);
    }
  });

  useEffect(() => {
    if (isSending) {
      return;
    }

    const lastAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.content.trim());

    if (!lastAssistantMessage) {
      return;
    }

    if (lastAssistantMessage.content === lastSpokenMessageRef.current) {
      return;
    }

    lastSpokenMessageRef.current = lastAssistantMessage.content;
    void playQuestionAudioEvent(lastAssistantMessage.content);
  }, [isSending, messages]);

  function stopAudioPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsSpeaking(false);
  }

  function clearAutoSendTimer() {
    if (autoSendTimeoutRef.current) {
      window.clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  }

  async function handleSend(prefilledAnswer?: string) {
    const trimmedAnswer = (prefilledAnswer ?? answer).trim();

    if (!trimmedAnswer || isSending || isComplete) {
      return;
    }

    clearAutoSendTimer();
    setError(null);
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedAnswer },
      { role: "assistant", content: "" },
    ]);
    setAnswer("");
    setTranscriptPreview(trimmedAnswer);

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

  function cleanupRecordingResources() {
    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }

    if (autoStopTimeoutRef.current) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    mediaRecorderRef.current = null;
  }

  async function transcribeAudio(audioBlob: Blob) {
    try {
      setIsTranscribing(true);

      const formData = new FormData();
      formData.append("audio", new File([audioBlob], "answer.webm", { type: "audio/webm" }));

      const response = await fetch("/api/interview/transcribe", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !payload.text) {
        throw new Error(payload.error ?? "Failed to transcribe audio.");
      }

      setTranscriptPreview(payload.text);
      setAnswer(payload.text);

      if (shouldAutoSendTranscriptRef.current) {
        clearAutoSendTimer();
        autoSendTimeoutRef.current = window.setTimeout(() => {
          void handleSend(payload.text);
        }, 2500);
      }
    } catch (transcriptionError) {
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : "Voice transcription failed. Please type your answer instead.",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  function stopRecording(reason: "manual" | "silence" | "timeout" = "manual") {
    shouldAutoSendTranscriptRef.current = reason !== "manual";

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      return;
    }

    cleanupRecordingResources();
    setIsRecording(false);
  }

  async function handleMicToggle() {
    if (isRecording) {
      stopRecording("manual");
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not available in this browser.");
      return;
    }

    try {
      setError(null);
      stopAudioPlayback();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const dataArray = new Uint8Array(analyser.fftSize);

      source.connect(analyser);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      lastAudioActivityAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          lastAudioActivityAtRef.current = Date.now();
        }
      };

      recorder.onstop = () => {
        void audioContext.close();
        cleanupRecordingResources();
        setIsRecording(false);

        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" });
          void transcribeAudio(audioBlob);
        }
      };

      recorder.start(250);
      setIsRecording(true);

      silenceIntervalRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);

        let peak = 0;

        for (const value of dataArray) {
          peak = Math.max(peak, Math.abs(value - 128));
        }

        if (peak > 6) {
          lastAudioActivityAtRef.current = Date.now();
        }

        if (Date.now() - lastAudioActivityAtRef.current > 8000) {
          stopRecording("silence");
        }
      }, 250);

      autoStopTimeoutRef.current = window.setTimeout(() => {
        stopRecording("timeout");
      }, 90000);
    } catch (recordingError) {
      cleanupRecordingResources();
      setIsRecording(false);
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "Could not start voice recording.",
      );
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
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-white">{jobTitle}</h1>
              {isSpeaking ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-100">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-300" />
                  Speaking
                </span>
              ) : null}
            </div>
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

      {isTranscribing ? (
        <div className="mx-auto mb-4 w-full max-w-5xl px-6">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Transcribing your answer...
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
          <div className="mx-auto max-w-5xl space-y-4">
            {transcriptPreview ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                Heard: {transcriptPreview}
              </div>
            ) : null}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={isSending || isEndingInterview || isTranscribing}
                className={`flex h-[84px] w-14 items-center justify-center self-end rounded-full border text-lg transition ${
                  isRecording
                    ? "border-red-400/60 bg-red-500/15 text-red-100"
                    : "border-slate-700 bg-slate-950 text-slate-200 hover:border-blue-400"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
                title={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? "Rec" : "Mic"}
              </button>
              <div className="flex-1">
                {isRecording ? (
                  <p className="mb-2 text-xs font-medium text-red-200">
                    Recording... click the mic again when you finish. It will also stop after about
                    8 seconds of silence, and silent recordings will auto-send shortly after
                    transcription.
                  </p>
                ) : (
                  <p className="mb-2 text-xs text-slate-400">
                    Speak with the mic or type your answer below. Transcribed answers stay editable
                    until you press Send.
                  </p>
                )}
                <div className="flex gap-4">
                  <textarea
                    value={answer}
                    onChange={(event) => {
                      setAnswer(event.target.value);
                    }}
                    rows={3}
                    placeholder="Type your answer here..."
                    disabled={isEndingInterview}
                    className="min-h-[84px] flex-1 rounded-3xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm leading-6 text-white outline-none transition focus:border-blue-400 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={isSending || isEndingInterview || isTranscribing || !answer.trim()}
                    className="self-end rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-600"
                  >
                    {isSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
