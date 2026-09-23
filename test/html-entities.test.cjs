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
    assert.strictEqual(decodeHtmlEntities("&nbsp;"), " ");
    assert.strictEqual(decodeHtmlEntities("&#39;"), "'");
  });

  it("leaves an unknown named entity untouched", () => {
    assert.strictEqual(decodeHtmlEntities("&foobar;"), "&foobar;");
  });

  it("leaves an out-of-range numeric entity untouched instead of throwing", () => {
    assert.doesNotThrow(() => decodeHtmlEntities("&#99999999;"));
    assert.strictEqual(decodeHtmlEntities("&#99999999;"), "&#99999999;");
  });

  it("passes through text with no entities unchanged", () => {
    assert.strictEqual(decodeHtmlEntities("plain text"), "plain text");
  });

  it("passes through empty string", () => {
    assert.strictEqual(decodeHtmlEntities(""), "");
  });
});
