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

  it("strips comments in CRLF-terminated input", () => {
    const input = "above\r\n// comment\r\nbelow";
    assert.strictEqual(stripComments(input), "above\nbelow");
  });

  it("normalizes CRLF even without comments present", () => {
    assert.strictEqual(stripComments("line 1\r\nline 2"), "line 1\nline 2");
  });

  it("strips a line whose content is additional // markers", () => {
    assert.strictEqual(stripComments("// // still a comment"), "");
  });

  it("preserves protocol-relative URLs at line start", () => {
    assert.strictEqual(
      stripComments("//example.com/path"),
      "//example.com/path",
    );
  });

  it("is a pass-through when no comments or &amp; are present", () => {
    const input = "line one\nline two\nline three";
    assert.strictEqual(stripComments(input), input);
  });

  it("strips a trailing comment that follows a blank line", () => {
    assert.strictEqual(stripComments("content\n\n// trailing"), "content");
  });
  describe("after a <br>", () => {
    it("does not swallow a closing tag after the comment", () => {
      assert.strictEqual(
        stripComments("<b>Hello<br>// note</b><br>World"),
        "<b>Hello</b><br>World",
      );
      assert.strictEqual(
        stripComments("<p>a<br>// x</p><p>b</p>"),
        "<p>a</p><p>b</p>",
      );
    });

    it("stops at an opening block tag", () => {
      assert.strictEqual(
        stripComments("<ul><li>a</li><br>// x</ul>tail"),
        "<ul><li>a</li></ul>tail",
      );
      assert.strictEqual(
        stripComments("a<br>// x<div>b</div>"),
        "a<div>b</div>",
      );
    });

    it("keeps an inline tag inside the comment text up to its closing tag", () => {
      assert.strictEqual(
        stripComments("a<br>// see <b>this</b><br>c"),
        "a</b><br>c",
      );
    });

    it("handles CRLF together with <br>", () => {
      assert.strictEqual(stripComments("a\r\n<br>// x<br>b"), "a\n<br>b");
    });

    it("ends a newline-started comment at a <br>", () => {
      assert.strictEqual(stripComments("a\n// x<br>b"), "a\nb");
    });

    it("keeps spaces before the <br>", () => {
      assert.strictEqual(stripComments("a  <br>// x<br>b"), "a  <br>b");
    });

    it("removes a comment between two <br> lines", () => {
      assert.strictEqual(
        stripComments("Hello<br>// note<br>World"),
        "Hello<br>World",
      );
    });

    it("accepts <br/> and <BR /> spellings", () => {
      assert.strictEqual(
        stripComments("Hello<br/>// note<br/>World"),
        "Hello<br/>World",
      );
      assert.strictEqual(
        stripComments("Hello<BR />// note<BR />World"),
        "Hello<BR />World",
      );
    });

    it("leaves no trailing <br> for a comment after the last <br>", () => {
      assert.strictEqual(stripComments("Hello<br>// note"), "Hello");
    });

    it("removes consecutive comment lines", () => {
      assert.strictEqual(
        stripComments("Hello<br>// a<br>// b<br>World"),
        "Hello<br>World",
      );
    });

    it("removes a comment at the start of the text that ends at a <br>", () => {
      assert.strictEqual(stripComments("// note<br>World"), "World");
      assert.strictEqual(stripComments("// a<br>// b<br>World"), "World");
    });

    it("handles a <br> then a newline: the <br> goes, the newline stays", () => {
      assert.strictEqual(stripComments("line<br>// note\nnext"), "line\nnext");
    });

    it("allows whitespace between the <br> and //", () => {
      assert.strictEqual(
        stripComments("Hello<br>  // note<br>World"),
        "Hello<br>World",
      );
    });

    it("keeps mid-line // after text on the same line", () => {
      assert.strictEqual(
        stripComments("visit us // open daily<br>bye"),
        "visit us // open daily<br>bye",
      );
    });

    it("keeps URLs and //nospace after a <br>", () => {
      assert.strictEqual(
        stripComments("a<br>https://example.com<br>//example.com<br>//nospace"),
        "a<br>https://example.com<br>//example.com<br>//nospace",
      );
    });
  });

  it("keeps mid-line // and removes a leading comment line", () => {
    assert.strictEqual(
      stripComments("visit us // open daily"),
      "visit us // open daily",
    );
    assert.strictEqual(stripComments("// note\nkept"), "kept");
  });
});
