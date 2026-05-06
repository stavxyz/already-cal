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
 * Any value that does not begin with a scheme (relative paths, fragments,
 * protocol-relative `//host`) is treated as relative and allowed.
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
 */
export const RAW_TEXT_ELEMENTS = Object.freeze(
  new Set(["script", "style", "noscript", "template", "textarea"]),
);

const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*[\s>]/i;
const MARKDOWN_RE = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;
// Extracts the URL scheme (everything before the first colon), case-insensitive.
// Allows leading whitespace because the browser strips it before scheme parsing
// — `" javascript:..."` is NOT a relative URL, it's a javascript: URL.
const URL_SCHEME_RE = /^\s*([a-z][a-z0-9+.-]*):/i;

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
 * Sanitize HTML by removing disallowed tags and attributes.
 *
 * Partial overrides in `config.sanitization` are merged with the defaults
 * (rather than replacing them), so an operator who tightens one tag doesn't
 * accidentally disable the safety rails on others.
 *
 * @param {string} html - raw HTML to sanitize.
 * @param {object} [config] - optional configuration.
 * @param {object} [config.sanitization]
 * @param {string[]|Set<string>} [config.sanitization.allowedTags] - tag allow-list (merged into default).
 * @param {object} [config.sanitization.allowedAttrs] - per-tag attribute allow-list (merged into default).
 * @param {object} [config.sanitization.allowedUrlSchemes] - per-tag URL-scheme allow-list
 *   (merged into default). Shape: `{ a: ["http", "https", ...], img: [...] }`.
 *   Values may be arrays or Sets — both are accepted.
 *   Values without a scheme (relative URLs, fragments, protocol-relative URLs) are always allowed.
 *   Schemes outside the list cause the attribute to be stripped, but the element survives.
 * @returns {string} sanitized HTML.
 */
export function sanitizeHtml(html, config) {
  const sanitization = config?.sanitization;
  const allowedTags = new Set(
    sanitization?.allowedTags || DEFAULT_ALLOWED_TAGS,
  );
  const allowedAttrs = {
    ...DEFAULT_ALLOWED_ATTRS,
    ...(sanitization?.allowedAttrs ?? {}),
  };
  const allowedUrlSchemes = normalizeUrlSchemes({
    ...DEFAULT_ALLOWED_URL_SCHEMES,
    ...(sanitization?.allowedUrlSchemes ?? {}),
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
 * Strips tab/LF/CR before scheme parsing, per the WHATWG URL spec — browsers
 * do this, so without normalization an attacker could hide the scheme as
 * `java\tscript:` and bypass a naive prefix check.
 */
function isUrlSchemeAllowed(url, allowedSchemes) {
  if (url == null) return true;
  const normalized = url.replace(/[\t\n\r]/g, "");
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
        if (RAW_TEXT_ELEMENTS.has(tag)) {
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
