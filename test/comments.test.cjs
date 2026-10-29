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

    it("keeps an inline pair inside the comment text", () => {
      assert.strictEqual(
        stripComments("a<br>// see <b>this</b><br>c"),
        "a<br>c",
      );
      assert.strictEqual(
        stripComments("// note with <b>bold</b> inside\nnext"),
        "next",
      );
    });

    it("stops at the wider block set", () => {
      assert.strictEqual(stripComments("a<br>// x<tbody>b"), "a<tbody>b");
    });

    it("swallows an unclosed inline tag up to the newline", () => {
      assert.strictEqual(stripComments("// <b>unclosed\nnext"), "next");
    });

    it("scans a long comment with many pairs in linear time", () => {
      const text = `// ${"<b></b>".repeat(10000)}${"x".repeat(40000)}<br>end`;
      const t = Date.now();
      assert.strictEqual(stripComments(text), "end");
      assert.ok(Date.now() - t < 2000);
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
  describe("after a block-level tag", () => {
    it("removes a comment that fills a paragraph, with the paragraph", () => {
      assert.strictEqual(
        stripComments("<p>A</p><p>// note</p><p>B</p>"),
        "<p>A</p><p>B</p>",
      );
      assert.strictEqual(
        stripComments("<div>A</div><div>// note</div><div>B</div>"),
        "<div>A</div><div>B</div>",
      );
      assert.strictEqual(
        stripComments("<ul><li>A</li><li>// note</li></ul>"),
        "<ul><li>A</li></ul>",
      );
      assert.strictEqual(stripComments("<h2>// note</h2>"), "");
      assert.strictEqual(stripComments('<p class="x">// note</p>'), "");
      assert.strictEqual(stripComments("<P>// upper</P>"), "");
    });

    it("keeps the tag when the comment is not the whole element", () => {
      assert.strictEqual(
        stripComments("<p>// note<br>Real</p>"),
        "<p>Real</p>",
      );
      assert.strictEqual(stripComments("<p>// note\nReal</p>"), "<p>Real</p>");
      assert.strictEqual(
        stripComments("<p>A</p>// between<p>B</p>"),
        "<p>A</p><p>B</p>",
      );
      assert.strictEqual(
        stripComments("<div>// a <b>bold</b> c</div><p>B</p>"),
        "<p>B</p>",
      );
    });

    it("still needs the space after //", () => {
      assert.strictEqual(
        stripComments("<p>A</p><p>//nospace</p>"),
        "<p>A</p><p>//nospace</p>",
      );
    });

    it("does not take a block tag that ends a comment at the start of the text", () => {
      assert.strictEqual(stripComments("// note<p>B</p>"), "<p>B</p>");
    });

    it("leaves a comment after a br inside a paragraph as before", () => {
      assert.strictEqual(
        stripComments("<p>a<br>// x</p><p>b</p>"),
        "<p>a</p><p>b</p>",
      );
    });

    it("drops a wrapper the removed element alone filled", () => {
      assert.strictEqual(stripComments("<div><p>// note</p></div>"), "");
      assert.strictEqual(
        stripComments("<ul>\n  <li>// a</li>\n  <li>// b</li>\n</ul>"),
        "",
      );
      assert.strictEqual(
        stripComments("<ul><li>// a</li><li>b</li></ul>"),
        "<ul><li>b</li></ul>",
      );
      assert.strictEqual(
        stripComments("<table><tr><td>// n</td></tr></table>x"),
        "x",
      );
      assert.strictEqual(
        stripComments("<tr><td>A</td><td>// n</td><td>C</td></tr>"),
        "<tr><td>A</td><td>C</td></tr>",
      );
    });

    it("takes a trailing break and still drops the element it fills", () => {
      assert.strictEqual(stripComments("<p>// a\n</p>"), "");
      assert.strictEqual(stripComments("<p>// n<br></p>x"), "x");
      assert.strictEqual(stripComments("<p>// n<br>   </p>x"), "x");
    });

    it("removes text after a closing block tag on the same line", () => {
      assert.strictEqual(
        stripComments("<p>Visit us</p>// open daily"),
        "<p>Visit us</p>",
      );
      assert.strictEqual(
        stripComments("<p>Visit us</p>// open daily<p>x</p>"),
        "<p>Visit us</p><p>x</p>",
      );
    });

    it("leaves odd markup as it finds it", () => {
      assert.strictEqual(stripComments("<p>// note"), "<p>");
      assert.strictEqual(stripComments("</p>// note"), "</p>");
      assert.strictEqual(stripComments("<p>// a<p>b</p>"), "<p><p>b</p>");
      assert.strictEqual(stripComments("<p/>// n</p>"), "<p/></p>");
      assert.strictEqual(stripComments("<p>// a</div>"), "<p></div>");
    });

    it("reads only real block tags as line starts", () => {
      assert.strictEqual(
        stripComments("<para>// x</para>"),
        "<para>// x</para>",
      );
      assert.strictEqual(stripComments("<p-x>// x</p-x>"), "<p-x>// x</p-x>");
      assert.strictEqual(
        stripComments("<hr/>// note<p>x</p>"),
        "<hr/><p>x</p>",
      );
      assert.strictEqual(stripComments('<p  class="x" >// note</p >'), "");
      assert.strictEqual(
        stripComments(`<p a="${"x".repeat(1100)}">// n</p>`),
        `<p a="${"x".repeat(1100)}">// n</p>`,
      );
    });

    it("handles CRLF and newlines around the blocks", () => {
      assert.strictEqual(
        stripComments("<p>// note\r\nReal</p>\r\n<p>// c</p>\r\n"),
        "<p>Real</p>",
      );
      assert.strictEqual(
        stripComments("<p>A</p>\n<p>// n</p>\n<p>B</p>"),
        "<p>A</p>\n\n<p>B</p>",
      );
    });

    it("stays linear on a long run of comment paragraphs", () => {
      const text = "<p>// x</p>".repeat(50000) + "<p>end</p>";
      const started = Date.now();
      assert.strictEqual(stripComments(text), "<p>end</p>");
      assert.ok(Date.now() - started < 2000, "took too long");
    });

    it("agrees with the feed's line breaks on a Google-style description", () => {
      assert.strictEqual(
        stripComments(
          "<p>Friday is Burger Night</p><p>// TODO confirm the venue</p><p>Doors at 6</p>",
        ),
        "<p>Friday is Burger Night</p><p>Doors at 6</p>",
      );
    });
  });
});
