import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";

let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }

  return geminiClient;
}

export function getGeminiModel(systemInstruction?: string) {
  return getGeminiClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction,
  });
}

export const interviewBlueprintSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: [
    "role_summary",
    "topics_to_cover",
    "skill_gaps",
    "red_flags",
    "opening_question",
    "difficulty_progression",
    "total_questions_target",
  ],
  properties: {
    role_summary: { type: SchemaType.STRING },
    topics_to_cover: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    skill_gaps: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    red_flags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    opening_question: { type: SchemaType.STRING },
    difficulty_progression: { type: SchemaType.STRING },
    total_questions_target: { type: SchemaType.INTEGER },
  },
};

export const interviewReportSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: [
    "overall_score",
    "strengths",
    "weaknesses",
    "topics_covered",
    "topics_missed",
    "recommended_focus",
  ],
  properties: {
    overall_score: { type: SchemaType.NUMBER },
    strengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    weaknesses: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    topics_covered: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    topics_missed: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    recommended_focus: { type: SchemaType.STRING },
  },
};
