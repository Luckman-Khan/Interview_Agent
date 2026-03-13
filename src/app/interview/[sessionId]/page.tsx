import { notFound } from "next/navigation";

import { InterviewClient } from "./InterviewClient";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { InterviewBlueprint } from "@/types";

export const dynamic = "force-dynamic";

type InterviewPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { sessionId } = await params;
  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("interview_sessions")
    .select("id, job_title, blueprint")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    notFound();
  }

  const blueprint = session.blueprint as InterviewBlueprint | null;

  if (!blueprint?.opening_question) {
    notFound();
  }

  return (
    <InterviewClient
      sessionId={sessionId}
      jobTitle={session.job_title ?? "Interview Session"}
      openingQuestion={blueprint.opening_question}
    />
  );
}
