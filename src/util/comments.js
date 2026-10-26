import { decodeAmp } from "./html-entities.js";

// A line break for comment purposes is a newline or a <br> in any spelling.
// Google Calendar's editor writes <br> between lines, so a comment typed on
// its own line there follows a <br>, not a newline.
const BREAK_RE = /\n|<br\s*\/?>/gi;
const COMMENT_START_RE = /[ \t]*\/\/ /y;
const TAG_RE = /<(\/?)([a-z][a-z0-9]*)(?![\w-])[^<>]{0,1024}>/iy;
const BLOCK_TAGS = new Set(
  (
    "br p div ul ol li h1 h2 h3 h4 h5 h6 blockquote pre table tr td th hr " +
    "tbody thead tfoot section article header footer nav aside figure dl " +
    "dt dd form"
  ).split(" "),
);
const VOID_TAGS = new Set(["img", "input", "wbr", "source", "area", "col"]);

// Index where the comment whose text starts at `from` ends. The comment runs
// to the first newline, <br>, opening block-level tag, or closing tag that
// closes something opened before the comment. An inline tag opened inside the
// comment, and its closing tag, belong to the comment. One pass, each
// character visited once.
function commentEnd(text, from) {
  const open = [];
  let j = from;
  while (j < text.length) {
    const c = text[j];
    if (c === "\n") return j;
    if (c !== "<") {
      j++;
      continue;
    }
    TAG_RE.lastIndex = j;
    const m = TAG_RE.exec(text);
    if (!m) {
      j++;
      continue;
    }
    const name = m[2].toLowerCase();
    if (m[1]) {
      const k = open.lastIndexOf(name);
      if (k === -1) return j;
      open.length = k;
    } else if (BLOCK_TAGS.has(name)) {
      return j;
    } else if (!VOID_TAGS.has(name) && !m[0].endsWith("/>")) {
      open.push(name);
    }
    j += m[0].length;
  }
  return j;
}

// End of the comment starting at `pos` (optional indent, then `// `), or -1.
function commentAt(text, pos) {
  COMMENT_START_RE.lastIndex = pos;
  const m = COMMENT_START_RE.exec(text);
  return m ? commentEnd(text, pos + m[0].length) : -1;
}

function removeComments(text) {
  let out = "";
  let i = 0;
  let lineStart = true;
  while (i <= text.length) {
    if (lineStart) {
      const end = commentAt(text, i);
      if (end !== -1) {
        // Take the break that ends the comment with it, so no blank line or
        // orphan <br> is left.
        BREAK_RE.lastIndex = end;
        const m = BREAK_RE.exec(text);
        i = m && m.index === end ? end + m[0].length : end;
        lineStart = Boolean(m && m.index === end);
        continue;
      }
    }
    BREAK_RE.lastIndex = i;
    const m = BREAK_RE.exec(text);
    if (!m) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, m.index);
    const after = m.index + m[0].length;
    const end = m[0] === "\n" ? -1 : commentAt(text, after);
    if (end !== -1) {
      // Comment after a <br>: the <br> goes with it, what follows stays.
      i = end;
      lineStart = false;
    } else {
      out += m[0];
      i = after;
      lineStart = true;
    }
  }
  return out;
}

/**
 * Strip AFL comment lines from a description.
 * Comments start with // (followed by a space) at the beginning of a line,
 * with optional leading whitespace. A line begins at the start of the text,
 * after a newline, or after a <br> (any spelling: <br>, <br/>, <br />, any
 * case). A comment ends at the next newline, <br>, opening block-level
 * tag, or closing tag that was not opened inside the comment (`// a <b>b</b>`
 * keeps its pair). Entire comment lines are removed together with the line break that
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
  text = removeComments(text);
  // Clean up: collapse runs of 3+ newlines to 2, trim leading/trailing newlines
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return text;
}
