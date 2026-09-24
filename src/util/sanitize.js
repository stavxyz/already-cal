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
 * Remove a URL from HTML, stripping both bare URLs and <a>-wrapped versions.
 *
 * Equivalent to replacing `/<a[^>]*>URL<\/a>/gi` and then every literal
 * occurrence of URL with "", but builds no RegExp from `url`. The RegExp
 * version threw "Regular expression too large" on a long enough URL or
 * directive (a 64,000-character "#already:" run did it), and its `[^>]*`
 * made each call quadratic on a run of `<a` with no `>`.
 */
export function stripUrl(html, url) {
  return stripWrappingAnchors(html, url).split(url).join("");
}

const ANCHOR_OPEN_RE = /<a/gi;

/**
 * Remove every `<a ...>URL</a>` (tag and URL matched case-insensitively,
 * like the `gi` RegExp this replaces). An opener's `[^>]*>` always ends at
 * the first `>` after it, so that position is found with `indexOf` and
 * reused by later openers that sit before it, which keeps the scan linear.
 */
function stripWrappingAnchors(html, url) {
  const target = `${url}</a>`.toLowerCase();
  let out = "";
  let cursor = 0;
  let gt = -1;
  ANCHOR_OPEN_RE.lastIndex = 0;
  let open = ANCHOR_OPEN_RE.exec(html);
  while (open !== null) {
    const afterOpen = open.index + 2;
    if (gt < afterOpen) gt = html.indexOf(">", afterOpen);
    // No `>` after this opener means none after any later opener either.
    if (gt === -1) break;
    const end = gt + 1 + target.length;
    if (html.slice(gt + 1, end).toLowerCase() === target) {
      out += html.slice(cursor, open.index);
      cursor = end;
      ANCHOR_OPEN_RE.lastIndex = end;
    } else {
      ANCHOR_OPEN_RE.lastIndex = open.index + 1;
    }
    open = ANCHOR_OPEN_RE.exec(html);
  }
  return out + html.slice(cursor);
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
      .replace(/(\s*<br\s*\/?>[\s]*)+$/gi, "")
      // Collapse 3+ newlines into 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
