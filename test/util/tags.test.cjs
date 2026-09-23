const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let tagLabel;
let isCategoryTag;
let isLinkTag;

before(async () => {
  ({ tagLabel, isCategoryTag, isLinkTag } = await import(
    "../../src/util/tags.js"
  ));
});

describe("tagLabel", () => {
  it("shows a scalar tag's value", () => {
    assert.strictEqual(tagLabel({ key: "tag", value: "food" }), "food");
  });

  it("shows a key-value tag as key: value", () => {
    assert.strictEqual(
      tagLabel({ key: "level", value: "beginner" }),
      "level: beginner",
    );
  });

  it("passes a plain string through", () => {
    assert.strictEqual(tagLabel("Outdoor"), "Outdoor");
  });

  it("stringifies a non-string value and tolerates null", () => {
    assert.strictEqual(
      tagLabel({ key: "capacity", value: 50 }),
      "capacity: 50",
    );
    assert.strictEqual(tagLabel(null), "");
  });
});

describe("isCategoryTag", () => {
  it("accepts scalar and text key-value tags", () => {
    assert.strictEqual(isCategoryTag({ key: "tag", value: "food" }), true);
    assert.strictEqual(isCategoryTag({ key: "level", value: "easy" }), true);
    assert.strictEqual(isCategoryTag("Outdoor"), true);
  });

  it("rejects URL-valued key-value tags, which are links", () => {
    assert.strictEqual(
      isCategoryTag({ key: "signup", value: "https://example.com" }),
      false,
    );
  });

  it("rejects tags with nothing to show", () => {
    for (const tag of [
      { key: "level", value: "" },
      { key: "level" },
      { key: "tag" },
      { key: "tag", value: "" },
      { key: "tag", value: "   " },
      "",
      "  ",
    ]) {
      assert.strictEqual(isCategoryTag(tag), false, JSON.stringify(tag));
    }
  });

  it("rejects keyless tags and non-scalar values", () => {
    for (const tag of [
      { value: "plain" },
      { key: 5, value: "x" },
      { key: "x", value: { a: 1 } },
      { key: "x", value: ["a"] },
      { key: "x", value: false },
      { key: "x", value: Number.NaN },
    ]) {
      assert.strictEqual(isCategoryTag(tag), false, JSON.stringify(tag));
    }
  });

  it("accepts a numeric key-value tag and rejects null entries", () => {
    assert.strictEqual(isCategoryTag({ key: "capacity", value: 50 }), true);
    assert.strictEqual(isCategoryTag(null), false);
  });

  it("keeps a scalar tag even if it looks like a URL", () => {
    assert.strictEqual(isCategoryTag({ key: "tag", value: "http-2" }), true);
  });
});

describe("isLinkTag", () => {
  it("accepts only key-value tags with a URL value", () => {
    assert.strictEqual(
      isLinkTag({ key: "rsvp", value: "https://example.com" }),
      true,
    );
    assert.strictEqual(isLinkTag({ key: "tag", value: "https://x" }), false);
    assert.strictEqual(isLinkTag({ key: "capacity", value: 50 }), false);
    assert.strictEqual(isLinkTag("https://x"), false);
    assert.strictEqual(isLinkTag(null), false);
    assert.strictEqual(isLinkTag({ value: "https://x" }), false);
    assert.strictEqual(isLinkTag({ key: 5, value: "https://x" }), false);
  });
});
