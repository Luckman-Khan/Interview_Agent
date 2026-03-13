import { NextResponse } from "next/server";

import { getGeminiModel, interviewBlueprintSchema } from "@/lib/gemini";
import { ensureRedisConnection } from "@/lib/redis";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { InterviewBlueprint, RedisInterviewState } from "@/types";

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

async function generateBlueprint(
  cvText: string,
  jdText: string,
  conciseMode = false,
) {
  const model = getGeminiModel(
    "You are an expert HR interviewer preparing for a job interview. Return valid JSON only.",
  );

  const prompt = conciseMode
    ? `Candidate CV Summary:
${cvText}

Job Description Summary:
${jdText}

Return one compact JSON object with exactly these rules:
- role_summary: 1 sentence
- topics_to_cover: exactly 5 short strings
- skill_gaps: up to 3 short strings
- red_flags: up to 2 short strings
- opening_question: exactly 1 interview question
- difficulty_progression: exactly "easy -> medium -> hard -> scenario"
- total_questions_target: exactly 8

Do not add any extra keys. Keep every value concise.`
    : `Candidate CV:
${cvText}

Job Description:
${jdText}

Generate a compact interview blueprint as JSON with exactly these fields:
{
  "role_summary": "one sentence",
  "topics_to_cover": ["exactly 5 concise topics"],
  "skill_gaps": ["up to 3 concise skill gaps"],
  "red_flags": ["up to 2 concise probe points"],
  "opening_question": "one precise opening interview question",
  "difficulty_progression": "easy -> medium -> hard -> scenario",
  "total_questions_target": 8
}

Keep the JSON concise and do not include markdown.`;

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: conciseMode ? 1024 : 2048,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: interviewBlueprintSchema,
    },
  });

  return JSON.parse(extractJsonPayload(response.response.text())) as InterviewBlueprint;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const sessionResponse = await supabase
      .from("interview_sessions")
      .select("id, cv_parsed_text, jd_text")
      .eq("id", sessionId)
      .single();

    const session = sessionResponse.data as {
      id: string;
      cv_parsed_text: string | null;
      jd_text: string | null;
    } | null;

    if (sessionResponse.error || !session) {
      return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
    }

    const primaryCvText = compactContext(session.cv_parsed_text, 6000);
    const primaryJdText = compactContext(session.jd_text, 4500);
    const fallbackCvText = compactContext(session.cv_parsed_text, 2500);
    const fallbackJdText = compactContext(session.jd_text, 2000);

    let blueprint: InterviewBlueprint;

    try {
      blueprint = await generateBlueprint(primaryCvText, primaryJdText);
    } catch (primaryError) {
      const message =
        primaryError instanceof Error ? primaryError.message : "Blueprint generation failed.";

      if (!message.includes("valid JSON")) {
        throw primaryError;
      }

      blueprint = await generateBlueprint(fallbackCvText, fallbackJdText, true);
    }

    const { error: updateError } = await supabase
      .from("interview_sessions")
      .update({ blueprint })
      .eq("id", sessionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const redis = await ensureRedisConnection();
    const redisState: RedisInterviewState = {
      conversation: [],
      questionsAsked: 0,
      currentTopic: blueprint.topics_to_cover[0] ?? "general fit",
    };

    await redis.set(`session:${sessionId}`, JSON.stringify(redisState), "EX", 7200);

    return NextResponse.json({ blueprint });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate interview blueprint.";

    const status =
      message.includes("REDIS_URL") ||
      message.includes("Redis") ||
      message.includes("GEMINI_API_KEY")
        ? 500
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
