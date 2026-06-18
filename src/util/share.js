/**
 * Attempt the native share sheet, falling back to copying the URL to the
 * clipboard. Pure of DOM — returns the outcome so the caller renders feedback.
 *
 *   "shared" — navigator.share resolved (or the user dismissed the sheet)
 *   "copied" — fell back to clipboard and the write succeeded
 *   "failed" — neither path worked (no throw; caller leaves the URL selectable)
 */
export async function shareOrCopy({ title, url }) {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (err) {
      // User dismissed the sheet — not an error; don't fall back to copy.
      if (err && err.name === "AbortError") return "shared";
      // Any other rejection (e.g. web-share Permissions-Policy not delegated
      // to the frame) falls through to the clipboard path below.
    }
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
