const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let stripComments;

before(async () => {
  const mod = await import("../src/util/comments.js");
  stripComments = mod.stripComments;
});

describe("stripComments", () => {
  it("strips a basic comment line", () => {
    assert.strictEqual(stripComments("// hello"), "");
  });

  it("strips a comment with leading whitespace", () => {
    assert.strictEqual(stripComments("  // indented comment"), "");
  });

  it("strips a tab-indented comment", () => {
    assert.strictEqual(stripComments("\t// tab comment"), "");
  });

  it("preserves text without comment prefix", () => {
    assert.strictEqual(stripComments("hello world"), "hello world");
  });

  it("does NOT strip // without a trailing space", () => {
    assert.strictEqual(stripComments("//nospace"), "//nospace");
  });

  it("does NOT strip mid-line //", () => {
    const input = "visit us // open daily";
    assert.strictEqual(stripComments(input), input);
  });

  it("preserves URLs with ://", () => {
    const input = "https://example.com/path";
    assert.strictEqual(stripComments(input), input);
  });

  it("strips multiple consecutive comment lines", () => {
    const input = "// line 1\n// line 2\n// line 3";
    assert.strictEqual(stripComments(input), "");
  });

  it("strips comments mixed with content without leaving blank lines", () => {
    const input = "line one\n// comment\nline two";
    assert.strictEqual(stripComments(input), "line one\nline two");
  });

  it("strips an empty comment (just // and a space)", () => {
    assert.strictEqual(stripComments("// "), "");
  });

  it("decodes &amp; before matching", () => {
    assert.strictEqual(
      stripComments("&amp;// not a comment"),
      "&// not a comment",
    );
  });

  it("strips comment after &amp; decoding when line-leading", () => {
    assert.strictEqual(stripComments("// has &amp; entity"), "");
  });

  it("handles empty string", () => {
    assert.strictEqual(stripComments(""), "");
  });

  it("handles null/undefined gracefully", () => {
    assert.strictEqual(stripComments(null), "");
    assert.strictEqual(stripComments(undefined), "");
  });

  it("does not leave trailing newline after stripping last line", () => {
    const input = "content\n// comment";
    assert.strictEqual(stripComments(input), "content");
  });

  it("does not leave leading newline after stripping first line", () => {
    const input = "// comment\ncontent";
    assert.strictEqual(stripComments(input), "content");
  });

  it("collapses multiple blank lines left by comment removal", () => {
    const input = "above\n\n// comment\n\nbelow";
    const result = stripComments(input);
    assert.ok(
      !result.includes("\n\n\n"),
      "should not have 3+ consecutive newlines",
    );
    assert.strictEqual(result, "above\n\nbelow");
  });
});
