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
 */
export const DEFAULT_ALLOWED_ATTRS = deepFreezeRecord({
  a: ["href", "target"],
  img: ["src", "alt"],
});

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
 * doesn't actually prevent mutation. Consumers extending the default should
 * write `new Set([...DEFAULT_RAW_TEXT_ELEMENTS, "mytag"])`.
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

/** Normalize per-tag scheme entries to arrays so `.includes()` always works. */
function normalizeUrlSchemes(raw) {
  return Object.fromEntries(
    Object.entries(raw).map(([tag, schemes]) => [
      tag,
      Array.isArray(schemes) ? schemes : Array.from(schemes),
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
 *   to extend, e.g. `[...DEFAULT_ALLOWED_TAGS, "details", "summary"]`.
 * @param {object} [config.sanitization.allowedAttrs] - per-tag attribute
 *   allow-list. Per-tag MERGE with the defaults — keys you provide override
 *   that tag's allow-list, keys you omit fall back to the default. To disable
 *   attributes for a tag entirely, pass that tag with an empty array (e.g.
 *   `{ a: [] }` to allow no attrs on `<a>`). Setting the entire option to
 *   `{}` is indistinguishable from omitting it; both yield defaults.
 * @param {object} [config.sanitization.allowedUrlSchemes] - per-tag URL-scheme
 *   allow-list. Same per-tag MERGE semantics as `allowedAttrs`. Shape:
 *   `{ a: ["http", "https", ...], img: [...] }`. Values may be arrays or Sets
 *   — both are accepted. Relative URLs (no scheme prefix, e.g. "/path",
 *   "#frag", "//host") are ALWAYS allowed regardless of this list. Schemes
 *   outside the list cause the attribute to be stripped, but the element
 *   survives. Per-tag null/undefined values are dropped before merge so the
 *   default for that tag is preserved.
 * @returns {string} sanitized HTML.
 */
export function sanitizeHtml(html, config) {
  const sanitization = config?.sanitization;
  const allowedTags = new Set(
    sanitization?.allowedTags || DEFAULT_ALLOWED_TAGS,
  );
  // Drop null/undefined per-tag values from user input BEFORE merging so they
  // don't shadow the default for that tag (e.g. `{ a: null }` → keep default).
  const allowedAttrs = {
    ...DEFAULT_ALLOWED_ATTRS,
    ...dropNullishValues(sanitization?.allowedAttrs ?? {}),
  };
  const allowedUrlSchemes = normalizeUrlSchemes({
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
 * Strip attributes whose name isn't in `allowedNames`. For `href` on <a> and
 * `src` on <img>, additionally validate the URL scheme — if the scheme isn't
 * on the allow-list, drop the attribute (but keep the element so link text /
 * image alt survive).
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
