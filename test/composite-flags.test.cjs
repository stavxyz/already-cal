const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let extractDirectives, FLAG_FIELDS, enrichEvent, enrichGoogleEvent;

before(async () => {
  ({ extractDirectives, FLAG_FIELDS } = await import(
    "../src/util/directives.js"
  ));
  ({ enrichEvent, enrichGoogleEvent } = await import("../src/data.js"));
});

const base = (description, extra = {}) => ({
  id: "e",
  title: "T",
  start: "2099-01-01T10:00:00Z",
  description,
  ...extra,
});

describe("flag table", () => {
  it("lists every flag directive with the event field it sets", () => {
    assert.deepStrictEqual(
      [...FLAG_FIELDS],
      [
        ["featured", "featured"],
        ["hidden", "hidden"],
        ["image-shuffle", "imageShuffle"],
        ["rsvp", "rsvp"],
        ["composite", "composite"],
        ["standalone", "standalone"],
        ["part-of", "partOf"],
      ],
    );
  });

  it("round-trips every flag through extractDirectives and enrichEvent", () => {
    for (const [keyword, field] of FLAG_FIELDS) {
      const text = `Hello #already:${keyword}`;
      const extracted = extractDirectives(text);
      assert.strictEqual(extracted[field], true, `extract ${keyword}`);
      assert.ok(!extracted.description.includes("#already"));
      assert.ok(extracted.description.includes("Hello"));
      assert.deepStrictEqual(extracted.tokens, []);

      const event = enrichEvent(base(text), {});
      assert.strictEqual(event[field], true, `enrich ${keyword}`);
      assert.ok(!event.description.includes("#already"));
    }
  });

  it("leaves every flag false when the description has none", () => {
    const extracted = extractDirectives("Just text");
    const event = enrichEvent(base("Just text"), {});
    for (const field of FLAG_FIELDS.values()) {
      assert.strictEqual(extracted[field], false);
      assert.strictEqual(event[field], false);
    }
  });

  it("returns every flag false for an empty description", () => {
    const extracted = extractDirectives("");
    for (const field of FLAG_FIELDS.values()) {
      assert.strictEqual(extracted[field], false);
    }
  });

  it("matches the keyword without regard to case", () => {
    const extracted = extractDirectives("#already:COMPOSITE #already:Part-Of");
    assert.strictEqual(extracted.composite, true);
    assert.strictEqual(extracted.partOf, true);
    assert.strictEqual(extracted.standalone, false);
  });

  it("keeps a flag a host set on the event itself", () => {
    const event = enrichEvent(
      base("", { composite: true, standalone: true, partOf: true }),
      {},
    );
    assert.strictEqual(event.composite, true);
    assert.strictEqual(event.standalone, true);
    assert.strictEqual(event.partOf, true);
  });
});

describe("reserved key-value forms", () => {
  it("strips composite:<name> and part-of:<name> without making a tag", () => {
    const r = extractDirectives(
      "A #already:composite:lineup B #already:part-of:lineup C",
    );
    assert.deepStrictEqual(r.tokens, []);
    assert.strictEqual(r.composite, false);
    assert.strictEqual(r.partOf, false);
    assert.strictEqual(r.standalone, false);
    assert.ok(!r.description.includes("#already"));
    assert.ok(!r.description.includes("lineup"));
    const event = enrichEvent(base("x #already:part-of:lineup"), {});
    assert.deepStrictEqual(event.tags, []);
  });

  it("a reserved key with an empty name is removed and sets no flag", () => {
    const r = extractDirectives("A #already:composite: B");
    assert.strictEqual(r.composite, false);
    assert.strictEqual(r.tokens.length, 0);
    assert.strictEqual(r.description, "A  B");
  });

  it("still turns an unknown key-value directive into a tag", () => {
    const r = extractDirectives("#already:cost:$25");
    assert.strictEqual(r.tokens.length, 1);
    assert.strictEqual(r.tokens[0].type, "tag");
  });

  it("still reads rsvp:<url> as a tag and bare rsvp as the flag", () => {
    const keyed = extractDirectives("#already:rsvp:https://x.example/r");
    assert.strictEqual(keyed.rsvp, false);
    assert.strictEqual(keyed.tokens.length, 1);
    assert.strictEqual(keyed.tokens[0].metadata.key, "rsvp");
    assert.strictEqual(extractDirectives("#already:rsvp").rsvp, true);
  });
});

describe("_sourceKey", () => {
  const item = (extra = {}) => ({
    id: "g1",
    summary: "S",
    start: { dateTime: "2099-01-01T10:00:00Z" },
    ...extra,
  });

  it("passes through enrichGoogleEvent from the raw item", () => {
    assert.strictEqual(
      enrichGoogleEvent(item({ _sourceKey: "1" }), {})._sourceKey,
      "1",
    );
  });

  it("is absent, not undefined, when the raw item has none", () => {
    assert.ok(!("_sourceKey" in enrichGoogleEvent(item(), {})));
  });
});
