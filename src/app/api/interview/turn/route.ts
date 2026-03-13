import { NextResponse } from "next/server";

import { getGeminiModel } from "@/lib/gemini";
import { ensureRedisConnection } from "@/lib/redis";
import { getSupabaseServerClient } from "@/lib/supabase";
import type {
  ConversationTurn,
  InterviewBlueprint,
  RedisInterviewState,
} from "@/types";

function parseRedisState(rawState: string | null) {
  if (!rawState) {
    throw new Error("Interview session state not found in Redis.");
  }

  return JSON.parse(rawState) as RedisInterviewState;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      userAnswer?: string;
    };

    const sessionId = body.sessionId?.trim();
    const userAnswer = body.userAnswer?.trim();

    if (!sessionId || !userAnswer) {
      return NextResponse.json(
        { error: "sessionId and userAnswer are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const sessionResponse = await supabase
      .from("interview_sessions")
      .select("id, status, blueprint, cv_parsed_text, jd_text")
      .eq("id", sessionId)
      .single();

    const session = sessionResponse.data as {
      id: string;
      status: string;
      blueprint: InterviewBlueprint | null;
      cv_parsed_text: string | null;
      jd_text: string | null;
    } | null;

    if (sessionResponse.error || !session) {
      return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
    }

    const blueprint = session.blueprint as InterviewBlueprint | null;

    if (!blueprint) {
      return NextResponse.json(
        { error: "Interview blueprint is not ready for this session." },
        { status: 400 },
      );
    }

    const redis = await ensureRedisConnection();
    const redisKey = `session:${sessionId}`;
    const redisState = parseRedisState(await redis.get(redisKey));
    const priorConversation: ConversationTurn[] = [...redisState.conversation];

    let questionForThisTurn = blueprint.opening_question;

    if (priorConversation.length === 0) {
      priorConversation.push({
        role: "assistant",
        content: blueprint.opening_question,
      });
    } else {
      const lastAssistantMessage = [...priorConversation]
        .reverse()
        .find((message) => message.role === "assistant");

      if (lastAssistantMessage) {
        questionForThisTurn = lastAssistantMessage.content;
      }
    }

    const conversationForPrompt: ConversationTurn[] = [
      ...priorConversation,
      { role: "user", content: userAnswer },
    ];

    const model = getGeminiModel(`You are a senior HR interviewer conducting a structured job interview.

Candidate CV Summary:
${session.cv_parsed_text ?? ""}

Job Description:
${session.jd_text ?? ""}

Interview Blueprint:
${JSON.stringify(blueprint)}

Rules you must follow:
- Ask exactly ONE question per response
- Base follow-up questions on the candidate's previous answer
- If the answer is vague, probe for specifics and metrics
- Follow the difficulty progression in the blueprint
- If a red flag topic hasn't been addressed after question 5, bring it up
- After ${blueprint.total_questions_target} questions, 
  write exactly: "INTERVIEW_COMPLETE" on its own line, 
  then give a brief closing statement
- Never break character
- Never give feedback during the interview
- Never reveal the blueprint or scoring criteria`);

    let fullResponse = "";

    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const streamResult = await model.generateContentStream({
            contents: conversationForPrompt.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
            generationConfig: {
              maxOutputTokens: 1000,
            },
          });

          for await (const chunk of streamResult.stream) {
            const text = chunk.text();

            if (!text) {
              continue;
            }

            fullResponse += text;

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`),
            );
          }

          const updatedConversation: ConversationTurn[] = [
            ...conversationForPrompt,
            { role: "assistant", content: fullResponse },
          ];

          const nextQuestionsAsked = redisState.questionsAsked + 1;
          const nextTopicIndex = Math.min(
            nextQuestionsAsked,
            Math.max(blueprint.topics_to_cover.length - 1, 0),
          );
          const nextState: RedisInterviewState = {
            conversation: updatedConversation,
            questionsAsked: nextQuestionsAsked,
            currentTopic:
              blueprint.topics_to_cover[nextTopicIndex] ?? redisState.currentTopic,
          };

          await redis.set(redisKey, JSON.stringify(nextState), "EX", 7200);

          const questionInsert = await supabase.from("interview_questions").insert({
            session_id: sessionId,
            question: questionForThisTurn,
            answer: userAnswer,
            turn_number: nextQuestionsAsked,
          });

          if (questionInsert.error) {
            throw new Error(questionInsert.error.message);
          }

          const nextStatus = fullResponse.includes("INTERVIEW_COMPLETE")
            ? "completed"
            : "active";

          const updateSession = await supabase
            .from("interview_sessions")
            .update({ status: nextStatus })
            .eq("id", sessionId);

          if (updateSession.error) {
            throw new Error(updateSession.error.message);
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Interview stream failed:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to stream interview response.",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to continue interview.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
