const COMMENT_RE = /^[ \t]*\/\/ .*$\n?/gm;

/**
 * Strip AFL comment lines from a description.
 * Comments start with // (followed by a space) at the beginning of a line,
 * with optional leading whitespace. Entire comment lines are removed.
 */
export function stripComments(description) {
  if (!description) return "";
  // Decode HTML entities before matching (consistent with other extractors)
  let text = description.replace(/&amp;/g, "&");
  // Remove comment lines
  text = text.replace(COMMENT_RE, "");
  // Clean up: collapse runs of 3+ newlines to 2, trim leading/trailing newlines
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return text;
}
