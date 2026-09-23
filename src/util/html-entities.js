/**
 * Decode the HTML entity `&amp;` to `&`.
 * Google Calendar HTML-encodes ampersands in description text; all AFL
 * extractors need a decoded string to reliably match URLs and directives.
 * Idempotent — calling it on already-decoded text is a no-op.
 */
export function decodeAmp(text) {
  return text.replace(/&amp;/g, "&");
}

/**
 * Named HTML entities decoded by `decodeHtmlEntities`, beyond the numeric
 * forms it also handles. Covers the punctuation and accented letters that
 * show up in text pasted from Word or Google Docs (curly quotes, em/en
 * dashes, ellipsis) plus a handful of common accented Latin letters and
 * symbol entities. Not exhaustive; an unknown named entity is left as-is.
 */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ccedil: "ç",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
};

/** Matches `&#39;` / `&#x2019;` (any case) / `&name;` in one pass. */
const ENTITY_RE = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;

/**
 * Decode HTML entities in `text` for plain-text output: numeric entities
 * (decimal `&#39;` and hex `&#x2019;`, case-insensitive) via
 * `String.fromCodePoint`, plus the named entities in `NAMED_ENTITIES`. An
 * out-of-range or non-numeric code point, or an unrecognized named entity,
 * is left untouched rather than throwing or producing a replacement
 * character. Uses no DOM. Not a full HTML5 named-entity table (there are
 * ~2000); extend `NAMED_ENTITIES` if a real-world description needs more.
 */
export function decodeHtmlEntities(text) {
  if (!text) return text;
  return text.replace(ENTITY_RE, (match, body) => {
    if (body[0] === "#") {
      const isHex = body[1]?.toLowerCase() === "x";
      const codePoint = isHex
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      if (
        !Number.isInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff
      ) {
        return match;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    const decoded = NAMED_ENTITIES[body.toLowerCase()];
    return decoded === undefined ? match : decoded;
  });
}
