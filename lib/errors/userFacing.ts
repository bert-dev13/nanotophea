/**
 * Map database / domain errors to short researcher-facing messages.
 * Never surface raw stack traces.
 */

function logDevDatabaseError(error: unknown) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    // Technical detail for developers only
    console.warn("[NANO-HEPATOTEA] Database/permission detail:", error)
  }
}

export function toUserFacingError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error == null) return fallback

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code || "")
      : ""
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback

  if (code === "permission-denied" || /permission|insufficient permissions/i.test(message)) {
    logDevDatabaseError(error)
    if (fallback !== "Something went wrong. Please try again.") {
      return fallback
    }
    return "This study could not be opened. Sign in and try again."
  }
  if (code === "unavailable" || /unavailable|network|offline|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return "The database service is temporarily unavailable. Check your connection and try again."
  }
  if (code === "unauthenticated" || /not signed in|auth\/invalid|auth\/user/i.test(message)) {
    return "Please sign in to continue."
  }
  if (code === "not-found" || /not found/i.test(message)) {
    return "The requested record was not found in this study."
  }
  if (/no active study|select a study/i.test(message)) {
    return "Select an active study before continuing."
  }
  if (/SOURCE MISSING|missing/i.test(message) && /source|evidence|dataset|run/i.test(message)) {
    return message.length < 180 ? message : "A linked source record is missing. Review linked evidence."
  }

  // Domain validation messages are usually already clear — keep if short
  if (message && message.length <= 220 && !/at Object\.|Error:|stack/i.test(message)) {
    return message
  }

  logDevDatabaseError(error)
  return fallback
}
