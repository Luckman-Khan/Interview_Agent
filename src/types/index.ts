export interface InterviewSession {
  id: string;
  status: string;
  jd_text: string;
  cv_parsed_text: string;
  blueprint: InterviewBlueprint | null;
}

export interface InterviewBlueprint {
  role_summary: string;
  topics_to_cover: string[];
  skill_gaps: string[];
  red_flags: string[];
  opening_question: string;
  difficulty_progression: string;
  total_questions_target: number;
}

export interface ConversationTurn {
  role: "assistant" | "user";
  content: string;
}

export interface InterviewReport {
  overall_score: number;
  strengths: string[];
  weaknesses: string[];
  topics_covered: string[];
  topics_missed: string[];
  recommended_focus: string;
}

export interface RedisInterviewState {
  conversation: ConversationTurn[];
  questionsAsked: number;
  currentTopic: string;
}
