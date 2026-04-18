import { decodeAmp } from "./html-entities.js";

const COMMENT_RE = /^[ \t]*\/\/ .*$\n?/gm;

/**
 * Strip AFL comment lines from a description.
 * Comments start with // (followed by a space) at the beginning of a line,
 * with optional leading whitespace. Entire comment lines are removed.
 * Also decodes &amp; → & for consistency with downstream extractors.
 */
export function stripComments(description) {
  if (!description) return "";
  let text = decodeAmp(description);
  // Normalize CRLF → LF so the regex matches regardless of line-ending style.
  text = text.replace(/\r\n/g, "\n");
  // Remove comment lines (the `\n?` consumes the trailing newline so no
  // orphan blank line is left where the comment stood).
  text = text.replace(COMMENT_RE, "");
  // Clean up: collapse runs of 3+ newlines to 2, trim leading/trailing newlines
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return text;
}
