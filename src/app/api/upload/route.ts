import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { v4 as uuidv4 } from "uuid";

import { uploadToS3 } from "@/lib/s3";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  let sessionId: string | null = null;

  try {
    const formData = await request.formData();
    const cvFile = formData.get("cv");
    const jd = formData.get("jd");
    const jobTitle = formData.get("jobTitle");

    if (!(cvFile instanceof File)) {
      return NextResponse.json(
        { error: "A CV PDF file is required." },
        { status: 400 },
      );
    }

    if (typeof jd !== "string" || !jd.trim()) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 },
      );
    }

    if (typeof jobTitle !== "string" || !jobTitle.trim()) {
      return NextResponse.json(
        { error: "Job title is required." },
        { status: 400 },
      );
    }

    const isPdf =
      cvFile.type === "application/pdf" ||
      cvFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        { error: "Only PDF CV uploads are supported." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const sessionInsert = await supabase
      .from("interview_sessions")
      .insert({
        user_id: "prototype-user",
        job_title: jobTitle.trim(),
        status: "uploading",
        jd_text: jd.trim(),
      })
      .select("id")
      .single();

    if (sessionInsert.error || !sessionInsert.data) {
      throw new Error(
        sessionInsert.error?.message ?? "Failed to create interview session.",
      );
    }

    sessionId = sessionInsert.data.id;

    const arrayBuffer = await cvFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsedPdf = await pdfParse(buffer);
    const parsedText = parsedPdf.text?.trim();

    if (!parsedText) {
      throw new Error("No readable text could be extracted from the PDF.");
    }

    const s3Key = `cvs/${uuidv4()}.pdf`;

    await uploadToS3(buffer, s3Key, "application/pdf");

    const updateResult = await supabase
      .from("interview_sessions")
      .update({
        status: "ready",
        cv_s3_key: s3Key,
        cv_parsed_text: parsedText,
        jd_text: jd.trim(),
        job_title: jobTitle.trim(),
      })
      .eq("id", sessionId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    return NextResponse.json({ sessionId });
  } catch (error) {
    if (sessionId) {
      try {
        const supabase = getSupabaseServerClient();
        await supabase
          .from("interview_sessions")
          .update({ status: "uploading" })
          .eq("id", sessionId);
      } catch (updateError) {
        console.error("Failed to preserve session state after upload error:", updateError);
      }
    }

    const message =
      error instanceof Error ? error.message : "Failed to upload and parse CV.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
