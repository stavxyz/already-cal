import { decodeAmp } from "./html-entities.js";

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
// A line, for comment purposes, begins after a newline, a <br> in any
// spelling, or a block-level tag, opening or closing. Google Calendar's
// editor writes <br> between lines; other editors wrap lines in <p> or
// <div>, and an HTML-to-text pass that turns block tags into line breaks
// treats both the same way. Group 1 is
// the slash of a closing block tag, group 2 the block tag's name; both are
// undefined for a newline or a <br>.
const BREAK_RE = new RegExp(
  `\\n|<br\\s*\\/?>|<(\\/?)(${[...BLOCK_TAGS]
    .filter((t) => t !== "br")
    .join("|")})(?![\\w-])[^<>]{0,1024}>`,
  "gi",
);

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

// Sticky twin of BREAK_RE for a look at one position.
const BREAK_AT_RE = new RegExp(BREAK_RE.source, "iy");
// An opening tag at the end of a string, with trailing whitespace allowed.
const OPENER_AT_END_RE = /<([a-z][a-z0-9]*)(?![\w-])[^<>]{0,1024}>\s*$/i;
const CLOSERS = new Map();

// A newline or <br> at `pos`, so the caller can take it with a comment it
// ends; a block-level tag there is structure and stays. Returns its length
// or 0.
function lineBreakAt(text, pos) {
  BREAK_AT_RE.lastIndex = pos;
  const m = BREAK_AT_RE.exec(text);
  return m && !m[2] ? m[0].length : 0;
}

// The closing tag of block element `name` at `pos`, whitespace before it
// allowed, or 0 when something else is there: a comment that fills an
// element goes out with the element. `name` is always a BLOCK_TAGS member.
function closingTagAt(text, pos, name) {
  let re = CLOSERS.get(name);
  if (!re) {
    re = new RegExp(`\\s*</${name}\\s*>`, "iy");
    CLOSERS.set(name, re);
  }
  re.lastIndex = pos;
  const m = re.exec(text);
  return m ? m[0].length : 0;
}

// After an element went out with the comment that filled it, the wrapper
// it alone filled is empty: `<div><p>// note</p></div>` leaves `<div>` in
// `out` and `</div>` next in `text`. Drop such pairs, outermost last.
function dropEmptyWrappers(out, text, i) {
  for (;;) {
    const lt = out.lastIndexOf("<");
    if (lt === -1) return { out, i };
    const m = OPENER_AT_END_RE.exec(out.slice(lt));
    if (!m || m[0].endsWith("/>")) return { out, i };
    const name = m[1].toLowerCase();
    if (!BLOCK_TAGS.has(name)) return { out, i };
    const closing = closingTagAt(text, i, name);
    if (!closing) return { out, i };
    out = out.slice(0, lt);
    i += closing;
  }
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
        const taken = lineBreakAt(text, end);
        i = end + taken;
        lineStart = taken > 0;
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
    if (end === -1) {
      out += m[0];
      i = after;
      lineStart = true;
      continue;
    }
    if (!m[2]) {
      // Comment after a <br>: the <br> goes with it, what follows stays.
      i = end;
      lineStart = false;
      continue;
    }
    // Comment right after a block-level tag. A newline or <br> that ends
    // the comment goes with it, so the block does not start with a blank
    // line. The tag stays, unless it opened an element the comment fills:
    // `<p>// note</p>` goes whole, and so does a wrapper left empty by it.
    const taken = lineBreakAt(text, end);
    if (!m[1] && !m[0].endsWith("/>")) {
      const closing = closingTagAt(text, end + taken, m[2]);
      if (closing) {
        ({ out, i } = dropEmptyWrappers(out, text, end + taken + closing));
        lineStart = false;
        continue;
      }
    }
    out += m[0];
    i = end + taken;
    lineStart = taken > 0;
  }
  return out;
}

/**
 * Strip AFL comment lines from a description.
 * Comments start with // (followed by a space) at the beginning of a line,
 * with optional leading whitespace. A line begins at the start of the text,
 * after a newline, after a <br> (any spelling: <br>, <br/>, <br />, any
 * case), or right after a block-level tag, opening or closing (<p>, </p>,
 * <li>, <div> and the rest). A comment ends at the next newline, <br>,
 * opening block-level tag, or closing tag that was not opened inside the
 * comment (`// a <b>b</b>` keeps its pair). Entire comment lines are removed
 * together with the line break that preceded them (after a <br>) or followed
 * them (after a newline); a block-level tag stays, except that an element a
 * comment fills goes out with it, together with any wrapper that element
 * alone filled (`<p>A</p><p>// note</p>` becomes `<p>A</p>`,
 * `<div><p>// note</p></div>` becomes nothing). Text after a block tag on
 * the same line is a line of its own, so `</p>// open daily` is a comment.
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
