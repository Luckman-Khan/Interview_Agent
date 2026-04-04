type ErrorContext = "startup" | "interview" | "speech" | "report" | "general";

function isResourceLimitError(message: string) {
  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("resource exhausted") ||
    message.includes("exceeded your current quota") ||
    message.includes("insufficient_quota") ||
    message.includes("credits") ||
    (message.includes("elevenlabs") && message.includes("failed")) ||
    message.includes("transcription failed with status 429") ||
    message.includes("status 429")
  );
}

export function toUserFriendlyError(
  message: string | null | undefined,
  context: ErrorContext = "general",
) {
  const normalized = (message ?? "").toLowerCase();

  if (isResourceLimitError(normalized)) {
    if (context === "speech") {
      return "Sorry 😔, voice features are temporarily unavailable right now. Please try again later or continue with typing.";
    }

    if (context === "report") {
      return "Sorry 😔, we could not generate the report right now because our AI resources are temporarily used up. Please try again a little later.";
    }

    if (context === "startup") {
      return "Sorry 😔, we could not start the interview right now because our AI resources are temporarily used up. Please try again a little later.";
    }

    return "Sorry 😔, we are temporarily out of AI resources right now. Please try again a little later.";
  }

  if (normalized.includes("redis") || normalized.includes("session state")) {
    return "Sorry 😔, the live interview session is temporarily unavailable. Please try again in a little while.";
  }

  if (normalized.includes("supabase") || normalized.includes("database")) {
    return "Sorry 😔, our storage service is having trouble right now. Please try again later.";
  }

  if (normalized.includes("no transcription text was returned")) {
    return "Sorry 😔, we could not hear enough speech in that recording. Please try again or type your answer instead.";
  }

  return message ?? "Something went wrong.";
}
