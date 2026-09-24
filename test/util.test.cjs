const { describe, it, before } = require("node:test");
const assert = require("node:assert");

describe("description format detection", () => {
  let detectFormat;
  before(async () => {
    ({ detectFormat } = await import("../src/util/description.js"));
  });

  it("detects HTML", () => {
    assert.strictEqual(detectFormat("<p>Hello</p>"), "html");
    assert.strictEqual(detectFormat("<strong>bold</strong>"), "html");
  });

  it("detects markdown", () => {
    assert.strictEqual(detectFormat("## Heading"), "markdown");
    assert.strictEqual(detectFormat("**bold**"), "markdown");
    assert.strictEqual(detectFormat("[link](http://example.com)"), "markdown");
  });

  it("returns plain for plain text", () => {
    assert.strictEqual(
      detectFormat("Just a normal description of an event"),
      "plain",
    );
  });
});
