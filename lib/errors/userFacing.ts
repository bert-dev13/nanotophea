/**
 * Map Firebase / domain errors to short researcher-facing messages.
 * Never surface raw stack traces.
 */

function logDevFirebaseError(error: unknown) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    // Technical detail for developers only
    console.warn("[NANOTOPHEA] Firebase/permission detail:", error)
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
    logDevFirebaseError(error)
    if (/member|ownership|owner/i.test(message)) {
      return "Your study ownership record is missing. Please verify the study configuration."
    }
    return "Administrator access could not be verified for this study."
  }
  if (code === "unavailable" || /unavailable|network|offline/i.test(message)) {
    return "Firebase is temporarily unavailable. Check your connection and try again."
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

  logDevFirebaseError(error)
  return fallback
}
