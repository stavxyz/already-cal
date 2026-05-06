require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let sanitizeHtml;

before(async () => {
  const mod = await import("../../src/util/description.js");
  sanitizeHtml = mod.sanitizeHtml;
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

  it("preserves other attrs when href is stripped", () => {
    // `target` is in DEFAULT_ALLOWED_ATTRS for <a>; href gets stripped for
    // javascript: but target should survive.
    const out = sanitizeHtml('<a href="javascript:x" target="_blank">x</a>');
    assert.strictEqual(out, '<a target="_blank">x</a>');
  });

  it("honors a custom allowedUrlSchemes config (https-only)", () => {
    const config = {
      sanitization: { allowedUrlSchemes: { a: ["https"], img: ["https"] } },
    };
    const out = sanitizeHtml('<a href="http://example.com">x</a>', config);
    assert.strictEqual(out, "<a>x</a>");
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
});
