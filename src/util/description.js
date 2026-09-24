import { marked } from "marked";
import { decodeHtmlEntities } from "./html-entities.js";
import { escapeHtml } from "./sanitize.js";

/**
 * Default tag allow-list. Frozen so consumers can't mutate the shared
 * default at runtime.
 */
export const DEFAULT_ALLOWED_TAGS = Object.freeze([
  "p",
  "a",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "br",
  "img",
  "blockquote",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/**
 * Default per-tag attribute allow-list. Frozen (including inner arrays) so
 * consumers can't mutate the shared default at runtime.
 *
 * `rel` is permitted on `<a>` so authors can opt into hints like
 * `external` / `nofollow` / `me`. Independent of this allow-list, the
 * sanitizer additionally FORCES `noopener noreferrer` into the `rel`
 * value on any `<a target="_blank">` — defense-in-depth against
 * window.opener leaks on older browsers without the modern implicit
 * `noopener` default for `_blank`. See `sanitizeAttributes`.
 *
 * The forced rel is UNCONDITIONAL: a consumer who passes a custom
 * `allowedAttrs.a` that omits `rel` does NOT opt out of the security
 * guarantee. The post-filter pass in `sanitizeAttributes` writes `rel`
 * directly on the element after the allow-list strip, so the attribute
 * survives regardless of the consumer's config. Removing `rel` from a
 * custom allow-list only prevents author-supplied `rel` hints from
 * passing through; it cannot disable the noopener/noreferrer force.
 */
export const DEFAULT_ALLOWED_ATTRS = deepFreezeRecord({
  a: ["href", "target", "rel"],
  img: ["src", "alt"],
});

/**
 * `rel` tokens forced onto `<a target="_blank">` regardless of author input.
 * Merged with any tokens the author already supplied so unrelated hints
 * (e.g. `external`, `nofollow`) are preserved.
 *
 * Both tokens are needed:
 * - `noopener` — prevents the opened tab from accessing `window.opener`
 *   and tabnabbing the source page.
 * - `noreferrer` — additionally suppresses the `Referer` header, which
 *   is desirable for embed surfaces where the embedding host may not
 *   want to leak its own URL to outbound destinations.
 *
 * Modern Chrome/Firefox/Safari default `_blank` to behave as if
 * `noopener` were set, but the explicit attribute remains the industry-
 * standard belt-and-suspenders and survives older browsers / nested
 * iframe contexts that don't apply the implicit default consistently.
 */
const FORCED_BLANK_REL_TOKENS = Object.freeze(["noopener", "noreferrer"]);

/**
 * Default URL-scheme allow-list, applied per-attribute.
 * `<a href>` permits http/https/mailto/tel; `<img src>` permits http/https only.
 * Relative URLs (no scheme prefix, e.g. "/path", "#frag", "//host") are ALWAYS
 * allowed regardless of this list — they have no scheme to validate.
 * `data:` is intentionally NOT on the img allow-list — it would let
 * `data:image/svg+xml;base64,...` smuggle SVG XSS through. Operators who need
 * inline data images can override via `config.sanitization.allowedUrlSchemes`.
 *
 * Frozen (including inner arrays) so consumers can't mutate the shared
 * default at runtime.
 */
export const DEFAULT_ALLOWED_URL_SCHEMES = deepFreezeRecord({
  a: ["http", "https", "mailto", "tel"],
  img: ["http", "https"],
});

/**
 * Elements whose children are NOT user-visible content in the normal flow:
 * program source (<script>, <style>), declarative-only (<template>),
 * fallback-when-JS-disabled (<noscript>), or form-state initial-value
 * (<textarea>). When any of these are disallowed, drop the whole element
 * — hoisting their children would render program text or form values as
 * visible content.
 *
 * Frozen so consumers can't mutate the shared default at runtime.
 * Exposed as an array (not a Set) so it's truly immutable — `Object.freeze`
 * is a no-op on Set's prototype methods (`add`/`delete`), so freezing a Set
 * doesn't actually prevent mutation. Exposed for inspection / re-export
 * only — there is intentionally no `config.sanitization.rawTextElements`
 * knob, because dropping these tags whole-element (rather than hoisting
 * children) is a security invariant: an operator who let `<style>` content
 * render as text would expose raw CSS source, and an operator who let
 * `<script>` children render would expose script bodies. The set is
 * deliberately not extensible at config time. Consumers needing different
 * behavior should wrap `sanitizeHtml` or fork the helper.
 */
export const DEFAULT_RAW_TEXT_ELEMENTS = Object.freeze([
  "script",
  "style",
  "noscript",
  "template",
  "textarea",
]);

/** Internal lookup, built at module init from the frozen public list. */
const RAW_TEXT_ELEMENTS_SET = new Set(DEFAULT_RAW_TEXT_ELEMENTS);

const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*[\s>]/i;
// The link branch detects `[text](url)`. Neither class may accept `[`. The
// simpler `\[.+?\]\(.+?\)` is super-linear: on a string like "[a](" repeated,
// every `[` starts a lazy scan to the end of the line looking for a `)` that
// never comes, which takes seconds at a few thousand characters. Excluding
// `[` from both the text and the url classes stops each attempt at the next
// `[`, where the next attempt starts, so no character is scanned by more
// than one attempt and the test is linear. The length bounds are generous
// limits for real links. Cost: link text containing nested brackets
// (`[a [b] c](url)`) or a url containing `[` is not detected by this branch
// alone.
const MARKDOWN_RE =
  /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[[^[\]\n]{1,500}\]\([^[)\n]{1,2000}\)/;
// Extracts the URL scheme (everything before the first colon), case-insensitive.
// Anchored at start with no leading-whitespace allowance because the caller
// (`isUrlSchemeAllowed`) explicitly strips leading C0 controls + space first
// — see the WHATWG URL parser comment there.
const URL_SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

/** Auto-detect whether text is HTML, markdown, or plain text. */
export function detectFormat(text) {
  if (!text) return "plain";
  if (HTML_TAG_RE.test(text)) return "html";
  if (MARKDOWN_RE.test(text)) return "markdown";
  return "plain";
}

/** Freeze a record-of-arrays, freezing each inner array as well. */
function deepFreezeRecord(obj) {
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) Object.freeze(obj[key]);
  }
  return Object.freeze(obj);
}

/**
 * Normalize per-tag list entries to arrays so `.includes()` always works.
 * Used for both `allowedAttrs` and `allowedUrlSchemes` so callers can pass
 * arrays OR Sets symmetrically — the alternative would be a subtle crash
 * if someone passes a Set to one option but not the other.
 */
function normalizePerTagLists(raw) {
  return Object.fromEntries(
    Object.entries(raw).map(([tag, list]) => [
      tag,
      Array.isArray(list) ? list : Array.from(list),
    ]),
  );
}

/**
 * Drop keys whose values are null/undefined. Used before per-tag merges so
 * that `{ a: null }` from a caller falls back to the default for `<a>` rather
 * than crashing the merge (e.g. `Array.from(null)` throws TypeError).
 */
function dropNullishValues(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}

/**
 * Sanitize HTML by removing disallowed tags and attributes.
 *
 * Each `config.sanitization` option has its own merge semantics — see the
 * per-option `@param` docs below. The general principle: per-tag options
 * (`allowedAttrs`, `allowedUrlSchemes`) merge with the defaults so that
 * tightening one tag doesn't accidentally disable the safety rails on
 * others; the flat tag list (`allowedTags`) is replaced wholesale.
 *
 * @param {string} html - raw HTML to sanitize.
 * @param {object} [config] - optional configuration.
 * @param {object} [config.sanitization]
 * @param {string[]|Set<string>} [config.sanitization.allowedTags] - tag
 *   allow-list. REPLACES the default; use the exported `DEFAULT_ALLOWED_TAGS`
 *   to extend, e.g. `[...DEFAULT_ALLOWED_TAGS, "details", "summary"]`. An
 *   empty array or Set IS respected (not coerced to the default — the `||`
 *   fallback only catches `null`/`undefined`/missing), so passing `[]`
 *   correctly means "allow zero tags, hoist everything to text".
 * @param {object} [config.sanitization.allowedAttrs] - per-tag attribute
 *   allow-list. Per-tag MERGE with the defaults — keys you provide override
 *   that tag's allow-list, keys you omit fall back to the default. Per-tag
 *   values may be arrays or Sets (both accepted; normalized to arrays
 *   internally). To disable attributes for a tag entirely, pass that tag
 *   with an empty array (e.g. `{ a: [] }` to allow no attrs on `<a>`).
 *   Setting the entire option to `{}` is indistinguishable from omitting it;
 *   both yield defaults. Per-tag null/undefined values are dropped before
 *   merge so the default for that tag is preserved.
 * @param {object} [config.sanitization.allowedUrlSchemes] - per-tag URL-scheme
 *   allow-list. Same per-tag MERGE semantics as `allowedAttrs`, including
 *   array/Set acceptance and null-drop. Shape: `{ a: ["http", "https", ...],
 *   img: [...] }`. Relative URLs (no scheme prefix, e.g. "/path", "#frag",
 *   "//host") are ALWAYS allowed regardless of this list. Schemes outside
 *   the list cause the attribute to be stripped, but the element survives.
 * @returns {string} sanitized HTML.
 */
export function sanitizeHtml(html, config) {
  const sanitization = config?.sanitization;
  const allowedTags = new Set(
    sanitization?.allowedTags || DEFAULT_ALLOWED_TAGS,
  );
  // Drop null/undefined per-tag values from user input BEFORE merging so they
  // don't shadow the default for that tag (e.g. `{ a: null }` → keep default).
  // Normalize both options to arrays so callers may pass arrays OR Sets
  // symmetrically (avoids a subtle TypeError on `.includes()` mid-render).
  const allowedAttrs = normalizePerTagLists({
    ...DEFAULT_ALLOWED_ATTRS,
    ...dropNullishValues(sanitization?.allowedAttrs ?? {}),
  });
  const allowedUrlSchemes = normalizePerTagLists({
    ...DEFAULT_ALLOWED_URL_SCHEMES,
    ...dropNullishValues(sanitization?.allowedUrlSchemes ?? {}),
  });

  const div = document.createElement("div");
  div.innerHTML = html;
  sanitizeNode(div, allowedTags, allowedAttrs, allowedUrlSchemes);
  return div.innerHTML;
}

/**
 * Returns true if the URL is acceptable under the per-tag scheme allow-list.
 * Values without a scheme (empty, fragment-only, path-only, protocol-relative)
 * are treated as relative and always allowed.
 *
 * Per the WHATWG URL parser, browsers strip leading C0 controls (0x00-0x1F)
 * and space (0x20) from a URL before parsing, plus embedded tab/LF/CR. Without
 * matching that, an attacker could hide the scheme as `\x01javascript:` or
 * `java\tscript:` and bypass a naive prefix check.
 */
function isUrlSchemeAllowed(url, allowedSchemes) {
  if (url == null) return true;
  // Leading 0x00-0x20 strip + embedded \t\n\r strip, mirroring the WHATWG URL
  // parser. The character class deliberately covers more than just \s: \s
  // doesn't include 0x00-0x08 or 0x0E-0x1F, but browsers do strip those.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: C0 controls are exactly what we need per WHATWG URL parser leading-strip rule.
  const normalized = url.replace(/^[\x00-\x20]+|[\t\n\r]/g, "");
  const match = URL_SCHEME_RE.exec(normalized);
  if (!match) return true; // no scheme → relative URL, allow
  const scheme = match[1].toLowerCase();
  return allowedSchemes.includes(scheme);
}

/**
 * Merge author-supplied `rel` tokens with the FORCED_BLANK_REL_TOKENS so
 * `noopener` and `noreferrer` are always present on `<a target="_blank">`
 * regardless of what the author wrote. Whitespace-splits per the HTML
 * spec (rel is a space-delimited token list) and case-insensitively
 * dedupes so an author who wrote `NOOPENER` doesn't end up with both
 * `NOOPENER` and `noopener` in the output. Token order: author tokens
 * first (preserving their intent), then any forced tokens not already
 * present.
 *
 * Author casing is preserved on retained tokens (we only lowercase for
 * dedupe comparison). HTML `rel` tokens are ASCII case-insensitive per
 * spec, so `NOOPENER noreferrer` and `noopener noreferrer` are
 * functionally identical to browsers; we don't normalize because it
 * would silently rewrite author intent.
 *
 * An explicit `rel="opener"` from the author is NOT stripped — it
 * survives alongside the forced `noopener`. Per spec, `noopener` takes
 * precedence in browsers when both are present, so the security
 * guarantee still holds (the opened tab cannot reach `window.opener`).
 */
function mergeRelTokens(existing) {
  const seen = new Set();
  const tokens = [];
  for (const token of (existing || "").split(/\s+/)) {
    if (!token) continue;
    const lower = token.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    tokens.push(token);
  }
  for (const forced of FORCED_BLANK_REL_TOKENS) {
    if (seen.has(forced)) continue;
    seen.add(forced);
    tokens.push(forced);
  }
  return tokens.join(" ");
}

/**
 * Strip attributes whose name isn't in `allowedNames`. For `href` on <a> and
 * `src` on <img>, additionally validate the URL scheme — if the scheme isn't
 * on the allow-list, drop the attribute (but keep the element so link text /
 * image alt survive).
 *
 * Post-filter, `<a target="_blank">` always gets `rel` forced to include
 * `noopener noreferrer` — see FORCED_BLANK_REL_TOKENS for rationale.
 */
function sanitizeAttributes(element, allowedAttrs, allowedUrlSchemes) {
  const tag = element.tagName.toLowerCase();
  const allowedNames = allowedAttrs[tag] || [];
  const schemes = allowedUrlSchemes[tag];
  const attrs = Array.from(element.attributes);
  for (const attr of attrs) {
    if (!allowedNames.includes(attr.name)) {
      element.removeAttribute(attr.name);
      continue;
    }
    // URL-scheme validation for href/src (only when this tag has a scheme list).
    if (
      schemes &&
      ((tag === "a" && attr.name === "href") ||
        (tag === "img" && attr.name === "src")) &&
      !isUrlSchemeAllowed(attr.value, schemes)
    ) {
      element.removeAttribute(attr.name);
    }
  }

  // Defense-in-depth: window.opener leak via target="_blank". Force
  // `noopener noreferrer` into the rel attribute regardless of what the
  // author wrote. Runs after the allow-list filter so `rel` is already
  // permitted to survive; merges with author tokens to preserve any
  // unrelated hints (external/nofollow/etc.).
  if (
    tag === "a" &&
    (element.getAttribute("target") || "").toLowerCase() === "_blank"
  ) {
    element.setAttribute("rel", mergeRelTokens(element.getAttribute("rel")));
  }
}

/**
 * Walk `node`'s children in-place, removing disallowed elements.
 *
 * Uses a live firstChild/nextSibling walk (not a snapshot) so that when a
 * disallowed wrapper has its children hoisted, those hoisted children are
 * re-examined on the next iteration — otherwise nested disallowed elements
 * (e.g. `<form><input></form>`) would survive because they were not in the
 * original snapshot of the parent's children.
 *
 * Raw-text elements (script/style/noscript/template/textarea) are dropped
 * entirely without hoisting children, so their program/data contents don't
 * leak as visible text.
 *
 * HTML comment nodes (`<!-- ... -->`) pass through unmodified — they are
 * inert (do not execute) so this is safe; documenting it so a future reader
 * doesn't wonder why they aren't filtered.
 */
function sanitizeNode(node, allowedTags, allowedAttrs, allowedUrlSchemes) {
  let child = node.firstChild;
  while (child) {
    const next = child.nextSibling;
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        if (RAW_TEXT_ELEMENTS_SET.has(tag)) {
          // Drop entirely — no hoisting. Preserves the safety property that
          // `<script>alert(1)</script>` produces no visible text.
          node.removeChild(child);
          child = next;
          continue;
        }
        // Hoist children, then remove the wrapper. Advance the cursor to the
        // first hoisted child so the loop re-examines it (otherwise newly
        // hoisted siblings would be skipped).
        const firstHoisted = child.firstChild;
        while (child.firstChild) {
          node.insertBefore(child.firstChild, child);
        }
        node.removeChild(child);
        child = firstHoisted ?? next;
        continue;
      }
      sanitizeAttributes(child, allowedAttrs, allowedUrlSchemes);
      sanitizeNode(child, allowedTags, allowedAttrs, allowedUrlSchemes);
    }
    child = next;
  }
}

// Elements whose content is program text or stylesheet source, not visible
// copy: dropped whole (tag AND contents) before tag stripping so their
// bodies never leak into the plain-text output.
//
// Only the opener is matched by regex here; `[^<>]*` keeps that linear for
// the same reason as BLOCK_TAG_RE/TAG_RE below. A single combined regex
// with a non-greedy `[\s\S]*?<\/\1\s*>` (the previous approach) is
// quadratic when an opener has no matching closer: the engine scans
// forward to the end of the string looking for a closer that isn't there,
// then repeats that full scan for every later opener. stripScriptStyle
// below instead finds each opener with this regex and looks for its
// closer with a plain forward `indexOf`, never backtracking past text it
// already scanned.
const SCRIPT_STYLE_OPEN_RE = /<(script|style)\b[^<>]*>/gi;

/**
 * Remove `<script>`/`<style>` elements, including their contents, from
 * `html` in linear time. See the comment above `SCRIPT_STYLE_OPEN_RE` for
 * why this isn't one combined regex.
 *
 * If an opener's closer is never found, everything from that opener to the
 * end of the string is dropped and scanning stops there: this matches how
 * a real HTML parser treats an unclosed `<script>`/`<style>` (it consumes
 * the rest of the document as element content until EOF). It's also what
 * keeps the function linear: an unclosed opener is discovered by a single
 * forward `indexOf` scan to the end of the string, and once that happens
 * there's nothing left to scan, so the pathological case (many unclosed
 * openers in a row) costs at most one full-length scan for the whole
 * call, not one per opener.
 */
function stripScriptStyle(html) {
  const lower = html.toLowerCase();
  let out = "";
  let cursor = 0; // start of the next not-yet-appended segment of `html`
  SCRIPT_STYLE_OPEN_RE.lastIndex = 0;
  let match = SCRIPT_STYLE_OPEN_RE.exec(html);
  while (match !== null) {
    const name = match[1].toLowerCase();
    const openEnd = SCRIPT_STYLE_OPEN_RE.lastIndex;
    const closerIdx = lower.indexOf(`</${name}`, openEnd);
    if (closerIdx === -1) {
      // No closer anywhere in the rest of the string: keep everything up
      // to this opener, drop the opener through EOF, and stop scanning.
      out += html.slice(cursor, match.index);
      cursor = html.length;
      break;
    }
    const closeTagEnd = html.indexOf(">", closerIdx);
    const afterClose = closeTagEnd === -1 ? html.length : closeTagEnd + 1;
    out += html.slice(cursor, match.index);
    cursor = afterClose;
    SCRIPT_STYLE_OPEN_RE.lastIndex = cursor;
    match = SCRIPT_STYLE_OPEN_RE.exec(html);
  }
  return out + html.slice(cursor);
}

// Block-level tags: replaced with a space so text on either side of them
// doesn't get jammed together ("<p>a</p><p>b</p>" -> "a b", not "ab").
// `[^<>]*` (not `[^>]*`) keeps this linear-time: excluding `<` from the
// attribute-content class means a stray `<` with no matching `>` fails the
// match at that position in O(1) instead of backtracking through the rest
// of the string.
const BLOCK_TAG_RE =
  /<\/?(?:br|p|div|li|ul|ol|tr|td|h[1-6]|blockquote|hr)\b[^<>]*>/gi;

// Catch-all for any remaining (inline) tag, replaced with nothing so
// "Doors at <b>7pm</b>." becomes "Doors at 7pm." with no injected space.
// `[^<>]*`, not `[^>]*`: the latter is quadratic on a string of unclosed
// `<` characters (each failed match backtracks through the rest of the
// string before advancing), because `[^>]*` happily consumes `<` too.
// Excluding `<` bounds the backtrack to the run up to the next `<` or `>`.
const TAG_RE = /<[^<>]*>/g;

/** Strip HTML markup for plain-text output. See the tag-class comments above. */
function stripHtml(html) {
  return stripScriptStyle(html).replace(BLOCK_TAG_RE, " ").replace(TAG_RE, "");
}

/**
 * Most characters of a Markdown description that `plainTextDescription`
 * hands to `marked.parse`. marked (v15) is super-linear on some inputs, so
 * this caps the cost on descriptions an attacker controls. Unclosed link
 * syntax with empty link text, "[](" or "![](" repeated, is the slowest
 * input found and is roughly cubic: 31 to 38 ms at 1,000 characters (best of
 * five runs), about 0.5 s at 2,000, and 3 to 7 s at 4,000. "[a](" and
 * "![a](" repeated take about half as long. "__a" repeated is quadratic,
 * 4 s at 64,000. These are marked 15.0.12 on Node 26, on one shared
 * development machine. At 500 the same inputs take about 4 ms, and the cost
 * is paid once per event, so a calendar of many hostile events multiplies
 * it. 500 characters still parse into more than the 200 or so characters a
 * link preview shows, unless most of them are link markup.
 */
const MARKDOWN_PARSE_LIMIT = 500;

/**
 * `marked.parse(text)` for at most the first MARKDOWN_PARSE_LIMIT characters.
 * A longer description is cut at the last newline before the limit if that
 * newline is in the second half of the limit, or else at the last newline or
 * space, whichever is later, so a line or word is not split in two. A newline
 * in the first half is passed over because cutting there would leave most
 * of the parse budget unused. The rest is appended unparsed, with only a `<`
 * that cannot start a tag escaped. The caller strips tags and decodes
 * entities from the whole result, so that rest still comes out as readable
 * text; only its Markdown syntax (such as `**` or `[text](url)`) is left in
 * place.
 */
function markdownToHtmlBounded(text) {
  if (text.length <= MARKDOWN_PARSE_LIMIT) return marked.parse(text);
  const head = text.slice(0, MARKDOWN_PARSE_LIMIT);
  const newline = head.lastIndexOf("\n");
  let cut =
    newline >= MARKDOWN_PARSE_LIMIT / 2
      ? newline
      : Math.max(newline, head.lastIndexOf(" "));
  if (cut <= 0) {
    cut = MARKDOWN_PARSE_LIMIT;
    // Don't split a UTF-16 surrogate pair (an emoji, say) in two.
    const code = text.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
  }
  return `${marked.parse(text.slice(0, cut))}\n${escapeNonTagLt(text.slice(cut))}`;
}

// A `<` that cannot start a tag, such as the one in "a < b", escaped so the
// caller's tag stripping does not treat "< b and c >" as a tag. marked does
// the same for the parsed head, so both parts keep such text.
const NON_TAG_LT_RE = /<(?![a-z/!?])/gi;

function escapeNonTagLt(text) {
  return text.replace(NON_TAG_LT_RE, "&lt;");
}

/**
 * Plain text of an enriched event's description, for places that cannot show
 * markup, such as link-preview text. Public core API (see src/core.js). The
 * output is unescaped plain text: decoded entities can leave literal `<` or
 * `&` characters in the result (e.g. a description containing `&amp;lt;3`
 * decodes to `<3`), so a caller embedding the result in HTML or an HTML
 * attribute must escape it itself. The contract is readable plain text;
 * exact whitespace and entity output may change between minor versions.
 * Only the first 500 characters of a Markdown description are parsed as
 * Markdown, and the rest keeps its Markdown syntax (see
 * MARKDOWN_PARSE_LIMIT and docs/core.md). Uses no DOM, so it runs in Workers.
 */
export function plainTextDescription(event) {
  const text = typeof event?.description === "string" ? event.description : "";
  if (!text) return "";
  const format = event.descriptionFormat ?? detectFormat(text);
  const html = format === "markdown" ? markdownToHtmlBounded(text) : text;
  const stripped = format === "plain" ? html : stripHtml(html);
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

/** Render event description text as sanitized HTML based on auto-detected format. */
export function renderDescription(text, config) {
  if (!text) return "";
  const format = detectFormat(text);
  switch (format) {
    case "html":
      return sanitizeHtml(text, config);
    case "markdown":
      return sanitizeHtml(marked.parse(text), config);
    default:
      return escapeHtml(text).replace(/\n/g, "<br>");
  }
}
