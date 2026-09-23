const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let decodeAmp;
let decodeHtmlEntities;

before(async () => {
  const mod = await import("../src/util/html-entities.js");
  decodeAmp = mod.decodeAmp;
  decodeHtmlEntities = mod.decodeHtmlEntities;
});

describe("decodeAmp", () => {
  it("decodes &amp; to &", () => {
    assert.strictEqual(decodeAmp("a &amp; b"), "a & b");
  });

  it("decodes multiple occurrences", () => {
    assert.strictEqual(decodeAmp("&amp;&amp;&amp;"), "&&&");
  });

  it("is idempotent on already-decoded text", () => {
    assert.strictEqual(decodeAmp("a & b"), "a & b");
  });

  it("leaves other entities alone", () => {
    assert.strictEqual(decodeAmp("&lt;tag&gt;"), "&lt;tag&gt;");
  });

  it("passes through empty string", () => {
    assert.strictEqual(decodeAmp(""), "");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes a numeric decimal entity (Word curly apostrophe)", () => {
    assert.strictEqual(
      decodeHtmlEntities("It&#8217;s great &mdash; really!"),
      "It’s great — really!",
    );
  });

  it("decodes a named accented-letter entity alongside &amp;", () => {
    assert.strictEqual(
      decodeHtmlEntities("Caf&eacute; visit &amp; tour"),
      "Café visit & tour",
    );
  });

  it("decodes a numeric hex entity, case-insensitively", () => {
    assert.strictEqual(decodeHtmlEntities("&#x2019;"), "’");
    assert.strictEqual(decodeHtmlEntities("&#X2019;"), "’");
  });

  it("decodes the basic named entities amp/lt/gt/quot/apos/nbsp", () => {
    assert.strictEqual(decodeHtmlEntities("&amp;"), "&");
    assert.strictEqual(decodeHtmlEntities("&lt;"), "<");
    assert.strictEqual(decodeHtmlEntities("&gt;"), ">");
    assert.strictEqual(decodeHtmlEntities("&quot;"), '"');
    assert.strictEqual(decodeHtmlEntities("&apos;"), "'");
    assert.strictEqual(decodeHtmlEntities("&nbsp;"), " ");
    assert.strictEqual(decodeHtmlEntities("&#39;"), "'");
  });

  it("leaves an unknown named entity untouched", () => {
    assert.strictEqual(decodeHtmlEntities("&foobar;"), "&foobar;");
  });

  it("does not resolve inherited Object.prototype properties as named entities", () => {
    // A plain `{}` lookup (`NAMED_ENTITIES[body]`) would also see inherited
    // properties like `constructor` and `toString`, "decoding" them to
    // function source instead of leaving the entity text alone.
    assert.strictEqual(decodeHtmlEntities("&constructor;"), "&constructor;");
    assert.strictEqual(decodeHtmlEntities("&toString;"), "&toString;");
  });

  it("decodes an out-of-range numeric entity to U+FFFD instead of throwing", () => {
    assert.doesNotThrow(() => decodeHtmlEntities("&#99999999;"));
    assert.strictEqual(decodeHtmlEntities("&#99999999;"), "�");
  });

  it("decodes a numeric entity just above the Unicode range (0x110000) to U+FFFD", () => {
    assert.strictEqual(decodeHtmlEntities("&#x110000;"), "�");
  });

  it("decodes a large-but-finite out-of-range digit string (&#99999999999;) to U+FFFD", () => {
    // 11 nines parses to a normal finite integer (99999999999), just one
    // that's far above 0x10FFFF; covered separately from the
    // Infinity-overflow case below because it exercises the
    // `codePoint > 0x10ffff` branch rather than `!Number.isInteger`.
    assert.doesNotThrow(() => decodeHtmlEntities("&#99999999999;"));
    assert.strictEqual(decodeHtmlEntities("&#99999999999;"), "�");
  });

  it("decodes a digit string long enough to overflow to Infinity to U+FFFD instead of throwing", () => {
    const hugeEntity = `&#${"9".repeat(400)};`;
    assert.doesNotThrow(() => decodeHtmlEntities(hugeEntity));
    assert.strictEqual(decodeHtmlEntities(hugeEntity), "�");
  });

  it("passes through text with no entities unchanged", () => {
    assert.strictEqual(decodeHtmlEntities("plain text"), "plain text");
  });

  it("passes through empty string", () => {
    assert.strictEqual(decodeHtmlEntities(""), "");
  });

  it("matches named entities case-sensitively per the WHATWG table", () => {
    assert.strictEqual(decodeHtmlEntities("&eacute;"), "é");
    assert.strictEqual(decodeHtmlEntities("&Eacute;"), "É");
    assert.strictEqual(decodeHtmlEntities("&EACUTE;"), "&EACUTE;");
  });

  it("decodes the legacy all-caps aliases AMP/LT/GT/QUOT/COPY/REG", () => {
    assert.strictEqual(decodeHtmlEntities("&AMP;"), "&");
    assert.strictEqual(decodeHtmlEntities("&LT;"), "<");
    assert.strictEqual(decodeHtmlEntities("&GT;"), ">");
    assert.strictEqual(decodeHtmlEntities("&QUOT;"), '"');
    assert.strictEqual(decodeHtmlEntities("&COPY;"), "©");
    assert.strictEqual(decodeHtmlEntities("&REG;"), "®");
  });

  it("leaves &MDASH; unchanged (no uppercase alias exists for mdash)", () => {
    assert.strictEqual(decodeHtmlEntities("&MDASH;"), "&MDASH;");
    assert.strictEqual(decodeHtmlEntities("&mdash;"), "—");
  });

  it("decodes all the newly added uppercase accented-letter entities", () => {
    assert.strictEqual(decodeHtmlEntities("&Egrave;"), "È");
    assert.strictEqual(decodeHtmlEntities("&Aacute;"), "Á");
    assert.strictEqual(decodeHtmlEntities("&Iacute;"), "Í");
    assert.strictEqual(decodeHtmlEntities("&Oacute;"), "Ó");
    assert.strictEqual(decodeHtmlEntities("&Uacute;"), "Ú");
    assert.strictEqual(decodeHtmlEntities("&Ntilde;"), "Ñ");
    assert.strictEqual(decodeHtmlEntities("&Uuml;"), "Ü");
    assert.strictEqual(decodeHtmlEntities("&Ouml;"), "Ö");
    assert.strictEqual(decodeHtmlEntities("&Auml;"), "Ä");
    assert.strictEqual(decodeHtmlEntities("&Ccedil;"), "Ç");
  });

  it("decodes &#0; and surrogate code points to U+FFFD", () => {
    assert.strictEqual(decodeHtmlEntities("&#0;"), "�");
    assert.strictEqual(decodeHtmlEntities("&#x0;"), "�");
    assert.strictEqual(decodeHtmlEntities("&#55296;"), "�"); // 0xD800
    assert.strictEqual(decodeHtmlEntities("&#xD800;"), "�");
    assert.strictEqual(decodeHtmlEntities("&#xDFFF;"), "�");
  });

  it("decodes Windows-1252 C1 numeric references per the WHATWG table", () => {
    assert.strictEqual(decodeHtmlEntities("&#8217;"), "’"); // 0x2019 direct
    assert.strictEqual(decodeHtmlEntities("&#x92;"), "’"); // Windows-1252 byte -> U+2019
    assert.strictEqual(decodeHtmlEntities("&#x80;"), "€"); // -> U+20AC EURO SIGN
    assert.strictEqual(decodeHtmlEntities("&#x97;"), "—"); // -> U+2014 EM DASH
  });

  it("leaves unmapped C1 code points (0x81, 0x8D, 0x8F, 0x90, 0x9D) as themselves", () => {
    assert.strictEqual(decodeHtmlEntities("&#x81;"), "\u0081");
    assert.strictEqual(decodeHtmlEntities("&#x8D;"), "\u008d");
    assert.strictEqual(decodeHtmlEntities("&#x8F;"), "\u008f");
    assert.strictEqual(decodeHtmlEntities("&#x90;"), "\u0090");
    assert.strictEqual(decodeHtmlEntities("&#x9D;"), "\u009d");
  });

  it("decodes a single-pass entity without double-decoding", () => {
    assert.strictEqual(decodeHtmlEntities("&amp;lt;"), "&lt;");
    assert.strictEqual(decodeHtmlEntities("&amp;#8217;"), "&#8217;");
  });
});
