import { marked } from "marked";
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
const MARKDOWN_RE = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;
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
