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
