import { NextResponse } from "next/server";

import { getGeminiModel, interviewReportSchema } from "@/lib/gemini";
import { ensureRedisConnection } from "@/lib/redis";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { InterviewBlueprint, InterviewReport } from "@/types";

function compactContext(text: string | null | undefined, maxChars: number) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars)}...`;
}

function extractJsonPayload(text: string) {
  const trimmed = text.trim();
  const withoutCodeFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (withoutCodeFence.startsWith("{") && withoutCodeFence.endsWith("}")) {
    return withoutCodeFence;
  }

  const match = withoutCodeFence.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error(
      `Gemini did not return valid JSON. Raw response preview: ${withoutCodeFence.slice(0, 300)}`,
    );
  }

  return match[0];
}

async function generateReport(
  jdText: string,
  blueprint: InterviewBlueprint,
  transcript: string,
  conciseMode = false,
) {
  const model = getGeminiModel(
    "You are an expert HR analyst evaluating interview performance. Return valid JSON only.",
  );

  const prompt = conciseMode
    ? `Job Description Summary:
${jdText}

Interview Blueprint:
${JSON.stringify(blueprint)}

Interview Transcript Summary:
${transcript}

Return one compact JSON object with exactly these rules:
- overall_score: integer between 0 and 100
- strengths: exactly 3 short strings
- weaknesses: exactly 3 short strings
- topics_covered: up to 5 short strings
- topics_missed: up to 5 short strings
- recommended_focus: 2 concise sentences

Do not add any extra keys. Keep every value concise.`
    : `Job Description:
${jdText}

Interview Blueprint:
${JSON.stringify(blueprint)}

Interview Transcript:
${transcript}

Evaluate the candidate and return compact JSON with exactly these fields:
{
  "overall_score": "integer between 0 and 100",
  "strengths": ["exactly 3 concise strengths"],
  "weaknesses": ["exactly 3 concise weaknesses"],
  "topics_covered": ["up to 5 concise topics"],
  "topics_missed": ["up to 5 concise topics"],
  "recommended_focus": "2 concise sentences"
}

Keep the JSON concise and do not include markdown.`;

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: conciseMode ? 1024 : 1800,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: interviewReportSchema,
    },
  });

  return JSON.parse(extractJsonPayload(response.response.text())) as InterviewReport;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const existingReport = await supabase
      .from("interview_reports")
      .select("overall_score, strengths, weaknesses, topics_covered, topics_missed, recommended_focus")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sessionResponse = await supabase
      .from("interview_sessions")
      .select("id, job_title, jd_text, blueprint")
      .eq("id", sessionId)
      .single();

    if (sessionResponse.error || !sessionResponse.data) {
      return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
    }

    if (existingReport.data) {
      return NextResponse.json({
        report: existingReport.data,
        jobTitle: sessionResponse.data.job_title,
      });
    }

    const redis = await ensureRedisConnection();
    const redisState = await redis.get(`session:${sessionId}`);

    if (!redisState) {
      return NextResponse.json(
        { error: "Interview transcript was not found in Redis." },
        { status: 400 },
      );
    }

    const { data: questions, error: questionsError } = await supabase
      .from("interview_questions")
      .select("question, answer, turn_number")
      .eq("session_id", sessionId)
      .order("turn_number", { ascending: true });

    if (questionsError) {
      throw new Error(questionsError.message);
    }

    const blueprint = sessionResponse.data.blueprint as InterviewBlueprint | null;

    if (!blueprint) {
      return NextResponse.json(
        { error: "Interview blueprint is missing for this session." },
        { status: 400 },
      );
    }

    const transcript = (questions ?? [])
      .map((turn) => `Q: ${turn.question ?? ""}\nA: ${turn.answer ?? ""}`)
      .join("\n\n");
    const primaryJdText = compactContext(sessionResponse.data.jd_text, 4500);
    const primaryTranscript = compactContext(transcript, 7000);
    const fallbackJdText = compactContext(sessionResponse.data.jd_text, 2200);
    const fallbackTranscript = compactContext(transcript, 3200);

    let report: InterviewReport;

    try {
      report = await generateReport(primaryJdText, blueprint, primaryTranscript);
    } catch (primaryError) {
      const message =
        primaryError instanceof Error ? primaryError.message : "Report generation failed.";

      if (!message.includes("valid JSON")) {
        throw primaryError;
      }

      report = await generateReport(
        fallbackJdText,
        blueprint,
        fallbackTranscript,
        true,
      );
    }

    const insertReport = await supabase.from("interview_reports").insert({
      session_id: sessionId,
      overall_score: report.overall_score,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      topics_covered: report.topics_covered,
      topics_missed: report.topics_missed,
      recommended_focus: report.recommended_focus,
    });

    if (insertReport.error) {
      throw new Error(insertReport.error.message);
    }

    const updateSession = await supabase
      .from("interview_sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);

    if (updateSession.error) {
      throw new Error(updateSession.error.message);
    }

    await redis.del(`session:${sessionId}`);

    return NextResponse.json({
      report,
      jobTitle: sessionResponse.data.job_title,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate report.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
