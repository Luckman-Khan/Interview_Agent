import { notFound } from "next/navigation";

import { ReportClient } from "./ReportClient";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { sessionId } = await params;
  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase
    .from("interview_sessions")
    .select("id, job_title")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    notFound();
  }

  return (
    <ReportClient
      sessionId={sessionId}
      jobTitle={session.job_title ?? "Interview Session"}
    />
  );
}
