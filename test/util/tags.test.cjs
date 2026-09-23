const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let tagLabel;
let isCategoryTag;

before(async () => {
  ({ tagLabel, isCategoryTag } = await import("../../src/util/tags.js"));
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

  it("keeps a scalar tag even if it looks like a URL", () => {
    assert.strictEqual(isCategoryTag({ key: "tag", value: "http-2" }), true);
  });
});
