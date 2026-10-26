import { decodeAmp } from "./html-entities.js";

// A line break for comment purposes is a newline or a <br> in any spelling.
// Google Calendar's editor writes <br> between lines, so a comment typed on
// its own line there follows a <br>, not a newline. A comment runs to the
// next newline or <br>.
const BR = "<br\\s*\\/?>";
const COMMENT_BODY = `[ \\t]*\\/\\/ (?:(?!${BR})[^\\n])*`;
// Comment after a <br>: remove the <br> with it, keep what follows.
const BR_COMMENT_RE = new RegExp(`${BR}${COMMENT_BODY}`, "gi");
// Comment at the start of a line: remove it with its line break (newline or
// <br>), so no blank line or orphan <br> is left.
const LINE_COMMENT_RE = new RegExp(`^${COMMENT_BODY}(?:\\n|${BR})?`, "gmi");

/**
 * Strip AFL comment lines from a description.
 * Comments start with // (followed by a space) at the beginning of a line,
 * with optional leading whitespace. A line begins at the start of the text,
 * after a newline, or after a <br> (any spelling: <br>, <br/>, <br />, any
 * case). Entire comment lines are removed together with the line break that
 * preceded them (after a <br>) or followed them (after a newline).
 * Mixed input such as `line<br>// note\nnext` becomes `line\nnext`: the
 * <br> goes with the comment and the newline stays.
 * Also decodes &amp; → & for consistency with downstream extractors.
 */
export function stripComments(description) {
  if (!description) return "";
  let text = decodeAmp(description);
  // Normalize CRLF → LF so the regex matches regardless of line-ending style.
  text = text.replace(/\r\n/g, "\n");
  // <br> comments go first: in `// a<br>// b<br>x` removing the first line
  // with its trailing <br> would otherwise leave `// b` mid-line.
  text = text.replace(BR_COMMENT_RE, "");
  // Remove comment lines at a line start (the trailing break is consumed so
  // no orphan blank line or <br> is left where the comment stood).
  text = text.replace(LINE_COMMENT_RE, "");
  // Clean up: collapse runs of 3+ newlines to 2, trim leading/trailing newlines
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return text;
}
