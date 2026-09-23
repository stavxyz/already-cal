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
 *
 * Keys are matched exactly (case-sensitive), per the WHATWG named character
 * references table (https://html.spec.whatwg.org/multipage/named-characters.html):
 * HTML named references are case-sensitive, so `&Eacute;` and `&eacute;` are
 * different entities decoding to different characters ("É" vs "é"), and
 * `&MDASH;` is not a valid reference at all (only lowercase `mdash` is), so
 * it is left unchanged. The uppercase accented-letter keys and the legacy
 * all-caps aliases (`AMP`, `LT`, `GT`, `QUOT`, `COPY`, `REG`) below were each
 * checked against that table before being added; no alias is included that
 * the table lacks.
 */
const NAMED_ENTITIES = {
  amp: "&",
  AMP: "&",
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  eacute: "é",
  Eacute: "É",
  egrave: "è",
  Egrave: "È",
  aacute: "á",
  Aacute: "Á",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  uacute: "ú",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  ouml: "ö",
  Ouml: "Ö",
  auml: "ä",
  Auml: "Ä",
  ccedil: "ç",
  Ccedil: "Ç",
  copy: "©",
  COPY: "©",
  reg: "®",
  REG: "®",
  trade: "™",
  deg: "°",
};

/** Matches `&#39;` / `&#x2019;` (any case) / `&name;` in one pass. */
const ENTITY_RE = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;

/**
 * Windows-1252 replacements for numeric character references in the range
 * 0x80-0x9F, per the WHATWG "numeric character reference end state"
 * (https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state).
 * HTML numeric character references were designed to match how old browsers
 * misread these bytes as Windows-1252 instead of the Unicode C1 control
 * codes they nominally are, so e.g. `&#8217;`'s hex form `&#x92;` (the
 * Windows-1252 byte for a right single quote) must decode to U+2019, not
 * U+0092. Code points in this range that aren't in the table (0x81, 0x8D,
 * 0x8F, 0x90, 0x9D) are left as their own code point: the spec defines no
 * override for them.
 *
 * A `Map` rather than an object literal, so the keys can stay as hex
 * literals matching the spec table above (Biome's `useSimpleNumberKeys`
 * rule disallows hex literals as object-literal property keys, since those
 * get silently stringified to decimal; array-literal elements passed to
 * `Map` aren't property keys, so the rule doesn't apply and the hex stays
 * readable).
 */
const WIN1252_C1_REPLACEMENTS = new Map([
  [0x80, 0x20ac],
  [0x82, 0x201a],
  [0x83, 0x0192],
  [0x84, 0x201e],
  [0x85, 0x2026],
  [0x86, 0x2020],
  [0x87, 0x2021],
  [0x88, 0x02c6],
  [0x89, 0x2030],
  [0x8a, 0x0160],
  [0x8b, 0x2039],
  [0x8c, 0x0152],
  [0x8e, 0x017d],
  [0x91, 0x2018],
  [0x92, 0x2019],
  [0x93, 0x201c],
  [0x94, 0x201d],
  [0x95, 0x2022],
  [0x96, 0x2013],
  [0x97, 0x2014],
  [0x98, 0x02dc],
  [0x99, 0x2122],
  [0x9a, 0x0161],
  [0x9b, 0x203a],
  [0x9c, 0x0153],
  [0x9e, 0x017e],
  [0x9f, 0x0178],
]);

/**
 * Decode HTML entities in `text` for plain-text output: numeric entities
 * (decimal `&#39;` and hex `&#x2019;`, case-insensitive) via
 * `String.fromCodePoint`, plus the named entities in `NAMED_ENTITIES`
 * (matched case-sensitively, per spec). A numeric reference of 0, one
 * outside the Unicode range, or a UTF-16 surrogate (0xD800-0xDFFF) decodes
 * to U+FFFD per the WHATWG numeric-character-reference-end-state algorithm;
 * a non-numeric or unrecognized named entity is left untouched rather than
 * throwing. Uses no DOM. Not the full WHATWG named character reference
 * table (https://html.spec.whatwg.org/multipage/named-characters.html);
 * extend `NAMED_ENTITIES` if a real-world description needs more.
 */
export function decodeHtmlEntities(text) {
  if (!text) return text;
  return text.replace(ENTITY_RE, (match, body) => {
    if (body[0] === "#") {
      const isHex = body[1]?.toLowerCase() === "x";
      const codePoint = isHex
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      if (!Number.isInteger(codePoint) || codePoint > 0x10ffff) {
        return match;
      }
      if (codePoint === 0 || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return "�";
      }
      return String.fromCodePoint(
        WIN1252_C1_REPLACEMENTS.get(codePoint) ?? codePoint,
      );
    }
    const decoded = NAMED_ENTITIES[body];
    return decoded === undefined ? match : decoded;
  });
}
