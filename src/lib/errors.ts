/**
 * Maps API or raw errors to human-readable messages. Never surface technical
 * details (stack traces, raw API payloads) to users.
 */
const KNOWN_MESSAGES: Record<string, string> = {
  Unauthorized: "Please sign in again.",
  Forbidden: "You don't have permission to do that.",
  "Tenant not found": "This workspace could not be found.",
  "Student not found": "That student could not be found.",
  "Not found": "That item could not be found.",
  "Source material not found": "That document could not be found.",
  "SRS card not found": "That flashcard is no longer available.",
  "Upload not completed": "Upload was not completed. Please try again.",
  "Only PDF files are supported": "Please upload a PDF file.",
  "Storage is not configured. Set S3_* environment variables.":
    "File upload is not available right now. Please try again later.",
  "Finish or abandon your current attempt first.":
    "You have an exam in progress. Finish or leave it before starting another.",
  "Internal server error": "Something went wrong. Please try again.",
  "Validation failed": "Please check your input and try again.",
  "Invalid JSON body": "Invalid request. Please try again.",
  "Invalid body": "Please check your input and try again.",
};

const DEFAULT_MESSAGE = "Something went wrong. Please try again.";

/**
 * Returns a safe, user-facing error message. Use for all UI error display
 * and alerts so we never show raw API errors or [object Object].
 */
export function toUserMessage(error: unknown, fallback = DEFAULT_MESSAGE): string {
  if (error == null) return fallback;
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (!trimmed) return fallback;
    return KNOWN_MESSAGES[trimmed] ?? trimmed;
  }
  if (typeof error === "object" && "error" in error) {
    const e = (error as { error?: unknown }).error;
    if (typeof e === "string") return toUserMessage(e, fallback);
    if (typeof e === "object" && e !== null && "message" in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string") return toUserMessage(m, fallback);
    }
  }
  if (error instanceof Error && error.message) {
    return toUserMessage(error.message, fallback);
  }
  return fallback;
}
