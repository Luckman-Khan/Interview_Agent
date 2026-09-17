type ErrorWithCause = Error & {
  cause?: unknown;
  code?: string;
  errno?: string;
  syscall?: string;
  hostname?: string;
};

function extractCauseFields(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const cause = value as {
    code?: string;
    errno?: string;
    syscall?: string;
    hostname?: string;
    message?: string;
    stack?: string;
  };

  return {
    causeMessage: cause.message,
    causeCode: cause.code,
    causeErrno: cause.errno,
    causeSyscall: cause.syscall,
    causeHostname: cause.hostname,
    causeStack: cause.stack,
  };
}

export function logDetailedError(
  label: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const normalizedError: ErrorWithCause =
    error instanceof Error
      ? (error as ErrorWithCause)
      : (new Error(typeof error === "string" ? error : "Unknown error") as ErrorWithCause);

  console.error(label, {
    ...context,
    message: normalizedError.message,
    stack: normalizedError.stack,
    code: normalizedError.code,
    errno: normalizedError.errno,
    syscall: normalizedError.syscall,
    hostname: normalizedError.hostname,
    cause: normalizedError.cause,
    ...extractCauseFields(normalizedError.cause),
  });
}

export function safeUrlHost(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
