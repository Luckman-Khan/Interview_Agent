import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured.");
    }

    const incomingFormData = await request.formData();
    const audioFile = incomingFormData.get("audio");

    if (!(audioFile instanceof File) || audioFile.size === 0) {
      return NextResponse.json({ error: "An audio file is required." }, { status: 400 });
    }

    const formData = new FormData();
    formData.append("file", audioFile, audioFile.name || "answer.webm");
    formData.append("model_id", "scribe_v1");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(errorText || "Failed to transcribe audio.");
    }

    const payload = (await response.json()) as { text?: string };
    const text = payload.text?.trim();

    if (!text) {
      throw new Error("No transcription text was returned.");
    }

    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to transcribe audio.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
