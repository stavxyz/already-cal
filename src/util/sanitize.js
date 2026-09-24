const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Shared URL-matching pattern used by link, image, and attachment extractors
export const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

/** Escape HTML special characters in a string. */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/**
 * Remove extracted URLs or directives from `text`: each match itself, plus
 * any `<a ...>X</a>` element whose content X is one of the matched strings
 * (tag and content compared case-insensitively). `matches` are
 * `{ index, text }` records of substrings found in this same `text`.
 *
 * All removals are collected as spans and applied in one pass, so the cost
 * is linear in the length of `text`. Removing each URL with its own
 * search-and-replace over the whole string cost one full scan per distinct
 * URL, which is quadratic on a description of thousands of distinct URLs,
 * and building a RegExp from each URL threw "Regular expression too large"
 * on a long enough one.
 *
 * Because it removes the matched positions rather than every copy of each
 * string, a URL that also appears inside a longer, different URL no longer
 * cuts a hole in that longer URL.
 */
export function stripMatches(text, matches) {
  if (matches.length === 0) return text;
  const wanted = new Set(matches.map((m) => m.text.toLowerCase()));
  const spans = matches.map((m) => [m.index, m.index + m.text.length]);
  for (const span of wrappingAnchorSpans(text, wanted)) spans.push(span);
  spans.sort((a, b) => a[0] - b[0]);

  let out = "";
  let cursor = 0;
  for (const [start, end] of spans) {
    if (start > cursor) out += text.slice(cursor, start);
    if (end > cursor) cursor = end;
  }
  return out + text.slice(cursor);
}

const ANCHOR_OPEN_RE = /<a/gi;

/**
 * Spans of every `<a[^>]*>X</a>` in `text` (case-insensitive) whose X,
 * lowercased, is in `wanted`. X never contains `<`, since none of the
 * patterns that find URLs or directives match one.
 *
 * An opener's `[^>]*>` always ends at the first `>` after it, and X runs from
 * there to the next `<`. Openers that share that `>` share the result, so it
 * is computed once per `>` and the scan stays linear, even on a long run of
 * `<a` with no `>`.
 */
function wrappingAnchorSpans(text, wanted) {
  const spans = [];
  let gt = -1;
  let closeEnd = -1; // end of `X</a>` after `gt`, or -1 if X is not wanted
  ANCHOR_OPEN_RE.lastIndex = 0;
  let open = ANCHOR_OPEN_RE.exec(text);
  while (open !== null) {
    const afterOpen = open.index + 2;
    if (gt < afterOpen) {
      gt = text.indexOf(">", afterOpen);
      // No `>` after this opener means none after any later opener either.
      if (gt === -1) break;
      const lt = text.indexOf("<", gt + 1);
      closeEnd =
        lt !== -1 &&
        text.slice(lt, lt + 4).toLowerCase() === "</a>" &&
        wanted.has(text.slice(gt + 1, lt).toLowerCase())
          ? lt + 4
          : -1;
    }
    if (closeEnd !== -1) {
      spans.push([open.index, closeEnd]);
      ANCHOR_OPEN_RE.lastIndex = closeEnd;
    } else {
      ANCHOR_OPEN_RE.lastIndex = open.index + 1;
    }
    open = ANCHOR_OPEN_RE.exec(text);
  }
  return spans;
}

/** Clean up HTML after URL extraction: collapse orphaned <br> runs, remove leading/trailing <br>, and normalize whitespace. */
export function cleanupHtml(str) {
  if (!str) return "";
  return (
    str
      // Collapse 2+ consecutive <br> (with optional whitespace between) into a double line break
      .replace(/(<br\s*\/?>[\s]*){2,}/gi, "<br><br>")
      // Remove <br> at the very start or end
      .replace(/^(\s*<br\s*\/?>[\s]*)+/gi, "")
      // Trailing <br> run. Written as `\s*(?:<br...>\s*)+`, the same language
      // as the older `(\s*<br...>\s*)+`, so the output is unchanged. The
      // older form was quadratic in two ways. Every position inside a long
      // whitespace run was a new start whose `\s*` scanned to the end of
      // the run and failed; `(?<!\s)` rules those starts out, and it never
      // rules out the real match, because a match's leftmost start can't
      // follow whitespace (the leading `\s*` would have absorbed it). And on
      // "<br>" + spaces + "x", each backtrack step in the whitespace after a
      // <br> let the next repetition's own `\s*` rescan the rest of it; with
      // the whitespace only after the tag, each step checks for `<br` once.
      .replace(/(?<!\s)\s*(?:<br\s*\/?>\s*)+$/gi, "")
      // Collapse 3+ newlines into 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
