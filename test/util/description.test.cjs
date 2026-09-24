require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let sanitizeHtml;
let DEFAULT_ALLOWED_TAGS;
let DEFAULT_ALLOWED_ATTRS;
let DEFAULT_ALLOWED_URL_SCHEMES;
let DEFAULT_RAW_TEXT_ELEMENTS;

before(async () => {
  const mod = await import("../../src/util/description.js");
  sanitizeHtml = mod.sanitizeHtml;
  DEFAULT_ALLOWED_TAGS = mod.DEFAULT_ALLOWED_TAGS;
  DEFAULT_ALLOWED_ATTRS = mod.DEFAULT_ALLOWED_ATTRS;
  DEFAULT_ALLOWED_URL_SCHEMES = mod.DEFAULT_ALLOWED_URL_SCHEMES;
  DEFAULT_RAW_TEXT_ELEMENTS = mod.DEFAULT_RAW_TEXT_ELEMENTS;
});

describe("sanitizeHtml URL-scheme allow-list", () => {
  it("strips javascript: from <a href> but keeps link text", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("strips data:text/html from <a href>", () => {
    const out = sanitizeHtml('<a href="data:text/html,xss">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("allows uppercase HTTPS scheme (case-insensitive)", () => {
    const out = sanitizeHtml('<a href="HTTPS://EXAMPLE.COM">x</a>');
    assert.strictEqual(out, '<a href="HTTPS://EXAMPLE.COM">x</a>');
  });

  it("allows protocol-relative URLs", () => {
    const out = sanitizeHtml('<a href="//example.com">x</a>');
    assert.strictEqual(out, '<a href="//example.com">x</a>');
  });

  it("allows fragment-only URLs", () => {
    const out = sanitizeHtml('<a href="#frag">x</a>');
    assert.strictEqual(out, '<a href="#frag">x</a>');
  });

  it("allows empty href as relative", () => {
    const out = sanitizeHtml('<a href="">x</a>');
    assert.strictEqual(out, '<a href="">x</a>');
  });

  it("blocks javascript: even with leading whitespace", () => {
    const out = sanitizeHtml('<a href=" javascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("strips javascript: from <img src>", () => {
    const out = sanitizeHtml('<img src="javascript:alert(1)">');
    // jsdom serializes void <img> without a slash; either form is fine —
    // assert structurally instead of by string equality.
    const div = document.createElement("div");
    div.innerHTML = out;
    const img = div.querySelector("img");
    assert.ok(img, "img element should survive");
    assert.strictEqual(img.getAttribute("src"), null);
  });

  it("strips data: from <img src> by conservative default", () => {
    const out = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    const div = document.createElement("div");
    div.innerHTML = out;
    const img = div.querySelector("img");
    assert.ok(img);
    assert.strictEqual(img.getAttribute("src"), null);
  });

  it("preserves other attrs when href is stripped, and forces rel='noopener noreferrer' on target='_blank'", () => {
    // `target` is in DEFAULT_ALLOWED_ATTRS for <a>; href gets stripped for
    // javascript: but target should survive. The sanitizer also forces
    // rel="noopener noreferrer" onto any <a target="_blank"> as
    // defense-in-depth against window.opener leaks (#204).
    const out = sanitizeHtml('<a href="javascript:x" target="_blank">x</a>');
    assert.strictEqual(
      out,
      '<a target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it("honors a custom allowedUrlSchemes config (https-only)", () => {
    const config = {
      sanitization: { allowedUrlSchemes: { a: ["https"], img: ["https"] } },
    };
    const out = sanitizeHtml('<a href="http://example.com">x</a>', config);
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks tab-obfuscated javascript: scheme", () => {
    const out = sanitizeHtml('<a href="java\tscript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks newline-obfuscated javascript: scheme", () => {
    const out = sanitizeHtml('<a href="java\nscript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks CR-obfuscated javascript: scheme", () => {
    const out = sanitizeHtml('<a href="java\rscript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks mixed leading-whitespace + embedded-tab obfuscation", () => {
    const out = sanitizeHtml('<a href="\t\njavascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks vbscript: (not on default allow-list)", () => {
    const out = sanitizeHtml('<a href="vbscript:msgbox(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("partial allowedUrlSchemes config narrows <a> but preserves <img> default", () => {
    // Operator tightens <a> to https-only. <img> must fall back to the
    // default (http/https only) — NOT become unrestricted. Also assert the
    // narrowed half: <a href="http://..."> is blocked under https-only.
    const config = { sanitization: { allowedUrlSchemes: { a: ["https"] } } };
    const out = sanitizeHtml('<img src="javascript:alert(1)" alt="x">', config);
    const div = document.createElement("div");
    div.innerHTML = out;
    const img = div.querySelector("img");
    assert.ok(img, "img element should survive");
    assert.strictEqual(img.getAttribute("src"), null);
    assert.strictEqual(img.getAttribute("alt"), "x");
    // narrowed half: http on <a> is blocked because user supplied https-only
    const aOut = sanitizeHtml('<a href="http://example.com">x</a>', config);
    assert.strictEqual(aOut, "<a>x</a>");
  });

  it("accepts Set values in allowedUrlSchemes without crashing", () => {
    const config = {
      sanitization: { allowedUrlSchemes: { a: new Set(["https"]) } },
    };
    const out = sanitizeHtml('<a href="https://example.com">x</a>', config);
    assert.strictEqual(out, '<a href="https://example.com">x</a>');
    const blocked = sanitizeHtml('<a href="http://example.com">x</a>', config);
    assert.strictEqual(blocked, "<a>x</a>");
  });
});

describe("sanitizeHtml raw-text element handling", () => {
  it("drops <script> entirely without leaking body as text", () => {
    const out = sanitizeHtml("<script>alert(1)</script>safe");
    assert.strictEqual(out, "safe");
  });

  it("drops <style> entirely without leaking rules as text", () => {
    const out = sanitizeHtml("<style>body{color:red}</style>safe");
    assert.strictEqual(out, "safe");
  });

  it("drops <noscript> entirely without leaking body as text", () => {
    const out = sanitizeHtml("<noscript>x</noscript>safe");
    assert.strictEqual(out, "safe");
  });
});

describe("sanitizeHtml hoisted-children re-examination", () => {
  it("removes nested-disallowed children after hoisting", () => {
    // <form> and <input> are both disallowed. The naive snapshot strategy
    // would hoist <input> out of <form> and stop, leaving the <input>
    // surviving. The walker must re-examine hoisted children.
    const out = sanitizeHtml("<form><input type='text'></form>safe");
    assert.strictEqual(out, "safe");
  });

  it("strips <svg onload> + namespaced children entirely (XSS bypass class)", () => {
    // <svg> is a famous XSS vector via inline event handlers like onload.
    // Neither <svg> nor <circle> are in DEFAULT_ALLOWED_TAGS, so the walker
    // hoists <svg>'s children, then re-examines <circle> (also disallowed)
    // and removes it. The `onload` attribute is stripped because it's not in
    // the allow-list for any tag. Pin this regression-guard since the live
    // walker re-examination is what makes it safe — a future refactor that
    // reverts to snapshot+iterate would silently break this.
    const out = sanitizeHtml(
      '<svg onload="alert(1)"><circle r="5"/></svg>safe',
    );
    assert.strictEqual(out, "safe");
    assert.ok(!out.includes("onload"), "onload should be stripped");
    assert.ok(!out.includes("<svg"), "svg should be hoisted-and-removed");
    assert.ok(!out.includes("<circle"), "circle should be hoisted-and-removed");
  });

  it("strips <iframe src=javascript:> entirely", () => {
    // <iframe> isn't in DEFAULT_ALLOWED_TAGS, so it's hoisted-then-removed.
    // Its `src` attribute is non-allowed regardless of value (no entry for
    // iframe in DEFAULT_ALLOWED_ATTRS), but pin a test that the iframe
    // element itself doesn't survive even with a fallback-content child.
    const out = sanitizeHtml(
      '<iframe src="javascript:alert(1)">fallback</iframe>safe',
    );
    // Fallback content gets hoisted as text (correct — it's user-visible
    // fallback, unlike <script>/<style> children which are program text).
    assert.strictEqual(out, "fallbacksafe");
    assert.ok(!out.includes("<iframe"));
  });
});

describe("sanitizeHtml leading C0 control bypass", () => {
  // Per WHATWG URL parser, browsers strip leading 0x00-0x20 from URLs before
  // scheme parsing. Without matching that, an attacker could hide the scheme
  // as `\x01javascript:...` and bypass a naive prefix check.
  //
  // NOTE: NUL (0x00) is omitted here because the HTML parser substitutes
  // U+FFFD for U+0000 in attribute values, so by the time our sanitizer (or
  // the browser's URL parser) sees the value, there is no NUL to strip — the
  // resulting `�javascript:` has no valid scheme prefix and is treated
  // as a relative URL by the browser. The threat is from C0 controls that
  // survive HTML parsing, i.e. 0x01-0x1F.
  it("blocks SOH-prefixed javascript: scheme (0x01)", () => {
    const out = sanitizeHtml('<a href="\x01javascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks 0x08-prefixed javascript: scheme", () => {
    const out = sanitizeHtml('<a href="\x08javascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks 0x1F-prefixed javascript: scheme", () => {
    const out = sanitizeHtml('<a href="\x1Fjavascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });

  it("blocks combined leading-C0 + embedded-tab obfuscation", () => {
    const out = sanitizeHtml('<a href="\x01\tjavascript:alert(1)">x</a>');
    assert.strictEqual(out, "<a>x</a>");
  });
});

describe("sanitizeHtml window.opener defense (rel on target=_blank)", () => {
  // #204: Without an explicit rel on <a target="_blank">, older browsers
  // (or nested-iframe contexts where the modern implicit `noopener`
  // default doesn't apply consistently) give the opened tab a reference
  // to `window.opener`, enabling tabnabbing-class attacks. The sanitizer
  // forces `rel="noopener noreferrer"` regardless of what the author wrote.

  it("forces rel='noopener noreferrer' on bare <a target='_blank'>", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it("merges forced tokens into author-supplied rel (preserves external/nofollow)", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="external nofollow">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_blank" rel="external nofollow noopener noreferrer">x</a>',
    );
  });

  it("does not duplicate when author already supplied noopener noreferrer", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it("dedupes case-insensitively (NOOPENER doesn't double-add)", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="NOOPENER">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_blank" rel="NOOPENER noreferrer">x</a>',
    );
  });

  it("does NOT add rel when target is _self (no opener leak risk)", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_self">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_self">x</a>',
    );
  });

  it("does NOT add rel when target attribute is absent", () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>');
    assert.strictEqual(out, '<a href="https://example.com">x</a>');
  });

  it("does NOT add rel when target is a named frame (not _blank)", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="results">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="results">x</a>',
    );
  });

  it("matches target='_blank' case-insensitively (HTML spec)", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_BLANK">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_BLANK" rel="noopener noreferrer">x</a>',
    );
  });

  it("permits author-supplied rel even without target (rel is in allow-list)", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" rel="external">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" rel="external">x</a>',
    );
  });

  it("forces tokens cleanly into an empty rel='' on target=_blank", () => {
    // Templating systems frequently emit `rel=""` placeholders; the merge
    // must produce a clean `noopener noreferrer` (no leading space, no
    // empty token) rather than mangling the output.
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it("preserves author rel='opener' alongside forced noopener (browsers give noopener precedence)", () => {
    // `opener` is a real HTML rel token (it explicitly opts INTO the
    // opener relationship). Per spec, when both `opener` and `noopener`
    // are present, `noopener` wins — so the security guarantee still
    // holds even though we don't strip the author's token.
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="opener">x</a>',
    );
    assert.strictEqual(
      out,
      '<a href="https://example.com" target="_blank" rel="opener noopener noreferrer">x</a>',
    );
  });
});

describe("sanitizeHtml config robustness", () => {
  it("falls back to default for tag when user passes null per-tag value", () => {
    // `Array.from(null)` would throw; the merge must drop the null and keep
    // the default for that tag. Verify by exercising both halves of the
    // default <a> allow-list.
    const config = { sanitization: { allowedUrlSchemes: { a: null } } };
    const httpOut = sanitizeHtml('<a href="http://example.com">x</a>', config);
    assert.strictEqual(
      httpOut,
      '<a href="http://example.com">x</a>',
      "http should survive (default <a> permits http)",
    );
    const jsOut = sanitizeHtml('<a href="javascript:alert(1)">x</a>', config);
    assert.strictEqual(
      jsOut,
      "<a>x</a>",
      "javascript: should still be blocked (default <a> rejects it)",
    );
  });

  it("falls back to default for tag when user passes null in allowedAttrs", () => {
    // Same defensive treatment for allowedAttrs.
    const config = { sanitization: { allowedAttrs: { a: null } } };
    const out = sanitizeHtml(
      '<a href="http://example.com" target="_blank">x</a>',
      config,
    );
    // default <a> allows href + target; both should survive.
    assert.match(out, /href="http:\/\/example\.com"/);
    assert.match(out, /target="_blank"/);
  });

  it("accepts Set value for allowedTags", () => {
    const result = sanitizeHtml("<p>p</p><div>d</div>", {
      sanitization: { allowedTags: new Set(["p"]) },
    });
    // <p> survives, <div> hoisted to text
    assert.match(result, /<p>p<\/p>d/);
  });

  it("accepts Set values per-tag in allowedAttrs (symmetric with allowedUrlSchemes)", () => {
    // Pre-fix: `.includes()` on a Set throws TypeError mid-render. Now both
    // allowedAttrs and allowedUrlSchemes accept arrays AND Sets via the
    // shared normalizePerTagLists helper.
    const result = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="noopener">x</a>',
      { sanitization: { allowedAttrs: { a: new Set(["href"]) } } },
    );
    // href survives (in the Set); target + rel stripped (not in the Set)
    assert.match(result, /href="https:\/\/example\.com"/);
    assert.ok(!result.includes("target="), "target should be stripped");
    assert.ok(!result.includes("rel="), "rel should be stripped");
  });

  it("empty allowedTags array IS respected (not coerced to default)", () => {
    // `||` only falls back on null/undefined/missing — empty array is
    // truthy in JS, so `[] || DEFAULT` returns `[]`, not the default.
    // Passing `[]` correctly means "allow zero tags, hoist everything
    // to text". Pinned as a regression-guard in case a future refactor
    // accidentally switches to `??` (which would behave the same here)
    // OR introduces a `length === 0` fallback.
    const out = sanitizeHtml("<p>kept</p><strong>bold</strong>", {
      sanitization: { allowedTags: [] },
    });
    // Both <p> and <strong> hoisted to text — element-stripped, content kept.
    assert.ok(!out.includes("<p>"), `p should be hoisted, got: ${out}`);
    assert.ok(
      !out.includes("<strong>"),
      `strong should be hoisted, got: ${out}`,
    );
    assert.ok(out.includes("kept"));
    assert.ok(out.includes("bold"));
  });
});

describe("sanitizer default constants are immutable", () => {
  it("DEFAULT_ALLOWED_TAGS is frozen", () => {
    assert.ok(Object.isFrozen(DEFAULT_ALLOWED_TAGS));
  });

  it("DEFAULT_ALLOWED_ATTRS is frozen with frozen inner arrays", () => {
    assert.ok(Object.isFrozen(DEFAULT_ALLOWED_ATTRS));
    for (const v of Object.values(DEFAULT_ALLOWED_ATTRS)) {
      assert.ok(Object.isFrozen(v));
    }
  });

  it("DEFAULT_ALLOWED_URL_SCHEMES is frozen with frozen inner arrays", () => {
    assert.ok(Object.isFrozen(DEFAULT_ALLOWED_URL_SCHEMES));
    for (const v of Object.values(DEFAULT_ALLOWED_URL_SCHEMES)) {
      assert.ok(Object.isFrozen(v));
    }
  });

  it("DEFAULT_RAW_TEXT_ELEMENTS is a frozen array", () => {
    assert.ok(Array.isArray(DEFAULT_RAW_TEXT_ELEMENTS));
    assert.ok(Object.isFrozen(DEFAULT_RAW_TEXT_ELEMENTS));
  });
});

describe("plainTextDescription", () => {
  let plainTextDescription;
  before(async () => {
    ({ plainTextDescription } = await import("../../src/util/description.js"));
  });

  it("returns plain text unchanged apart from whitespace", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "Brisket and  beer.\n\nBring chairs.",
      }),
      "Brisket and beer. Bring chairs.",
    );
  });

  it("drops HTML tags and empty wrappers, and decodes entities", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "<p>Hello <b>world</b> &amp; friends</p><p></p>",
        descriptionFormat: "html",
      }),
      "Hello world & friends",
    );
  });

  it("renders Markdown to text without its syntax", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "## Title\n- **bold** item\n[link](https://example.com)",
        descriptionFormat: "markdown",
      }),
      "Title bold item link",
    );
  });

  it("decodes named entities from HTML pasted from Word (curly apostrophe, em dash)", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "<p>It&#8217;s great &mdash; really!</p>",
        descriptionFormat: "html",
      }),
      "It’s great — really!",
    );
  });

  it("decodes named accented-letter entities from HTML (Google Docs export)", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "Caf&eacute; visit &amp; tour",
        descriptionFormat: "html",
      }),
      "Café visit & tour",
    );
  });

  it("decodes the same entity forms on the Markdown path", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "It&#8217;s Caf&eacute; &mdash; &amp; more",
        descriptionFormat: "markdown",
      }),
      "It’s Café — & more",
    );
  });

  it("returns an empty string for a missing description", () => {
    assert.strictEqual(plainTextDescription({}), "");
  });

  it("returns an empty string for a non-string description instead of throwing", () => {
    assert.strictEqual(plainTextDescription({ description: null }), "");
    assert.strictEqual(plainTextDescription({ description: 42 }), "");
    assert.strictEqual(plainTextDescription({ description: {} }), "");
    assert.strictEqual(plainTextDescription({ description: ["x"] }), "");
  });

  it("keeps text on either side of a <br> separated by a space", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "Doors at 7pm.<br>Music at 8pm.",
        descriptionFormat: "html",
      }),
      "Doors at 7pm. Music at 8pm.",
    );
  });

  it("renders a <ul><li> list as space-separated text", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "<ul><li>Bring chairs</li><li>Bring beer</li></ul>",
        descriptionFormat: "html",
      }),
      "Bring chairs Bring beer",
    );
  });

  it("strips an <a href> with an entity-encoded ampersand, keeping only the link text", () => {
    assert.strictEqual(
      plainTextDescription({
        description: '<a href="https://example.com/?a=1&amp;b=2">Details</a>',
        descriptionFormat: "html",
      }),
      "Details",
    );
  });

  it("does not inject a space around an inline tag (Doors at <b>7pm</b>.)", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "Doors at <b>7pm</b>.",
        descriptionFormat: "html",
      }),
      "Doors at 7pm.",
    );
  });

  it("returns a URL-only description unchanged (no tags to strip)", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "https://example.com/event/123",
      }),
      "https://example.com/event/123",
    );
  });

  it("drops <script> and <style> elements along with their contents", () => {
    assert.strictEqual(
      plainTextDescription({
        description:
          "<style>.x{color:red}</style><p>Visible</p><script>alert(1)</script>",
        descriptionFormat: "html",
      }),
      "Visible",
    );
  });

  it("decodes an uppercase named entity (Google Docs export)", () => {
    assert.strictEqual(
      plainTextDescription({
        description: "Caf&Eacute; visit",
        descriptionFormat: "html",
      }),
      "CafÉ visit",
    );
  });

  it("strips a 100,000-character run of unclosed '<' in well under 200ms (linear-time tag stripping)", () => {
    const description = "<".repeat(100000);
    const start = performance.now();
    plainTextDescription({ description, descriptionFormat: "html" });
    const elapsed = performance.now() - start;
    assert.ok(
      elapsed < 200,
      `expected under 200ms, took ${elapsed.toFixed(1)}ms`,
    );
  });

  // Regression guard for a quadratic script/style-removal regex: a single
  // combined /<(script|style)\b[^<>]*>[\s\S]*?<\/\1\s*>/gi backtracks to
  // the end of the string for every unclosed opener. Repeating an opener
  // with no closer ~100,000 characters' worth previously took hundreds of
  // milliseconds (168ms at 100k characters, 668ms at 200k, scaling
  // roughly with the square of the length); stripScriptStyle's forward-
  // only indexOf scan keeps each of these under 200ms.
  for (const [label, chunk] of [
    ["<style>", "<style>"],
    ["<script>", "<script>"],
    ["<script (no closing '>')", "<script"],
  ]) {
    it(`strips ~100,000 characters of repeated unclosed '${label}' in well under 200ms`, () => {
      const description = chunk.repeat(Math.ceil(100000 / chunk.length));
      const start = performance.now();
      plainTextDescription({ description, descriptionFormat: "html" });
      const elapsed = performance.now() - start;
      assert.ok(
        elapsed < 200,
        `expected under 200ms, took ${elapsed.toFixed(1)}ms`,
      );
    });
  }
});

describe("plainTextDescription Markdown parse limit", () => {
  let plainTextDescription;
  before(async () => {
    ({ plainTextDescription } = await import("../../src/util/description.js"));
  });

  it("parses the first 500 characters as Markdown and keeps the rest as text", () => {
    const filler = "word ".repeat(300).trim();
    const description = `**Bold** intro\n**Mid** ${filler}\nTail **end** [x](https://a.co)`;
    const out = plainTextDescription({
      description,
      descriptionFormat: "markdown",
    });
    assert.ok(out.startsWith("Bold intro Mid word"), out.slice(0, 40));
    assert.ok(out.endsWith("Tail **end** [x](https://a.co)"), out.slice(-40));
    assert.strictEqual(out.split("word").length - 1, 300);
  });

  it("keeps a '<' that starts no tag in the unparsed rest", () => {
    const filler = "word ".repeat(250).trim();
    const description = `**B** ${filler}\nx a < b and c > d <b>bold</b> y`;
    const out = plainTextDescription({
      description,
      descriptionFormat: "markdown",
    });
    assert.ok(out.endsWith("x a < b and c > d bold y"), out.slice(-40));
  });

  it("parses a long Markdown paragraph that follows a short first line", () => {
    const paragraph = "**w** [l](https://a.co) ".repeat(60).trim();
    const out = plainTextDescription({
      description: `Intro\n${paragraph}`,
      descriptionFormat: "markdown",
    });
    const parsed = out.slice(0, 60);
    assert.ok(out.startsWith("Intro w l w l"), out.slice(0, 40));
    assert.ok(!parsed.includes("**"), parsed);
    assert.ok(!parsed.includes("https://a.co"), parsed);
  });

  it("cuts at a newline in the second half even when a space comes later", () => {
    const first = `**A** ${"w ".repeat(147)}`;
    const description = `${first}\n**X** ${"v ".repeat(200)}`;
    assert.ok(first.length > 250 && first.length < 500, String(first.length));
    const out = plainTextDescription({
      description,
      descriptionFormat: "markdown",
    });
    assert.ok(out.startsWith("A w w"), out.slice(0, 20));
    assert.ok(out.includes("w **X** v"), out.slice(first.length - 20));
  });

  it("cuts at the limit when the only space is early in a long description", () => {
    const out = plainTextDescription({
      description: `Hi **x**${"w".repeat(600)}`,
      descriptionFormat: "markdown",
    });
    assert.ok(out.startsWith("Hi xwww"), out.slice(0, 20));
  });

  it("does not split an emoji when the first 500 characters have no space", () => {
    const description = `**${"a".repeat(497)}😀b`;
    const out = plainTextDescription({
      description,
      descriptionFormat: "markdown",
    });
    // A split pair would come out as "\uD83D \uDE00b", with a space between.
    assert.ok(out.endsWith(" 😀b"), JSON.stringify(out.slice(-6)));
  });
});

describe("detectFormat Markdown link detection", () => {
  let detectFormat;
  before(async () => {
    ({ detectFormat } = await import("../../src/util/description.js"));
  });

  for (const text of [
    "See [the site](https://example.com) for info",
    '[x](https://a.com "Title here")',
    "[Wiki](https://en.wikipedia.org/wiki/Foo_(bar))",
    "text [a] more [b](c)",
    "line one\n[link text](http://x.y/z?q=1&r=2)",
    "![poster](http://x.png)",
  ]) {
    it(`detects a Markdown link in ${JSON.stringify(text)}`, () => {
      assert.strictEqual(detectFormat(text), "markdown");
    });
  }

  for (const text of [
    "no link here (really) [nope]",
    "[a]\n(b)",
    "[](empty)",
    "[a]()",
    "plain [text] (paren)",
  ]) {
    it(`does not treat ${JSON.stringify(text)} as a Markdown link`, () => {
      assert.strictEqual(detectFormat(text), "plain");
    });
  }
});

describe("plainTextDescription with enrichGoogleEvent", () => {
  let enrichGoogleEvent;
  let plainTextDescription;
  before(async () => {
    ({ enrichGoogleEvent } = await import("../../src/data.js"));
    ({ plainTextDescription } = await import("../../src/util/description.js"));
  });

  it("reads plain text from a description already stripped of directives and image URLs", () => {
    const event = enrichGoogleEvent(
      {
        id: "evt1",
        summary: "BBQ",
        description:
          "**Big** day\nhttps://drive.google.com/file/d/ABC123/view\n#already:tag:food",
      },
      {},
    );
    assert.strictEqual(plainTextDescription(event), "Big day");
  });
});
