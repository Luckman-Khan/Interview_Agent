import { NextResponse } from "next/server";

import { getGeminiModel, interviewReportSchema } from "@/lib/gemini";
import { ensureRedisConnection } from "@/lib/redis";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { InterviewBlueprint, InterviewReport } from "@/types";

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

    const model = getGeminiModel(
      "You are an expert HR analyst evaluating an interview performance. Respond with JSON only. No explanation, no markdown, just raw JSON.",
    );
    const response = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `Job Description:
${sessionResponse.data.jd_text ?? ""}

Interview Blueprint (what was supposed to be covered):
${JSON.stringify(blueprint)}

Full Interview Transcript:
${transcript}

Evaluate the candidate's performance and return this exact JSON:
{
  "overall_score": number between 0 and 100,
  "strengths": ["array of 3 specific strengths with brief explanation"],
  "weaknesses": ["array of 3 specific weaknesses with brief explanation"],
  "topics_covered": ["topics that were adequately addressed"],
  "topics_missed": ["topics from blueprint not covered or poorly answered"],
  "recommended_focus": 
    "one paragraph: what the candidate should focus on before the HR session"
}` }] },
      ],
      generationConfig: {
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
        responseSchema: interviewReportSchema,
      },
    });

    const textResponse = response.response.text();

    const report = JSON.parse(extractJsonPayload(textResponse)) as InterviewReport;

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
