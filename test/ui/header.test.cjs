require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let renderHeader;
before(async () => {
  ({ renderHeader } = await import("../../src/ui/header.js"));
});

const baseConfig = (over = {}) => ({
  showHeader: true,
  i18n: { share: "Share", subscribe: "Subscribe" },
  shareBase: "https://host.example/cal",
  getShareState: () => ({ view: "month" }),
  ...over,
});

describe("renderHeader share button", () => {
  it("renders a calendar-share button next to the header content", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig());
    const share = c.querySelector(".already-header-share");
    assert.ok(share, "share button present");
    assert.strictEqual(share.getAttribute("aria-label"), "Share");
  });

  it("renders the share button even with no name/description", () => {
    const c = document.createElement("div");
    renderHeader(c, {}, baseConfig());
    assert.ok(
      c.querySelector(".already-header-share"),
      "share button renders when the header would otherwise be empty",
    );
  });

  it("share URL reflects the live view from getShareState", async () => {
    Object.defineProperty(navigator, "share", {
      value: async (d) => {
        navigator._lastShare = d;
      },
      configurable: true,
    });
    const c = document.createElement("div");
    renderHeader(
      c,
      { name: "My Cal" },
      baseConfig({ getShareState: () => ({ view: "week" }) }),
    );
    const share = c.querySelector(".already-header-share");
    share.click();
    await share._shareResult;
    assert.strictEqual(
      navigator._lastShare.url,
      "https://host.example/cal#week",
    );
    delete navigator.share;
    delete navigator._lastShare;
  });

  it("omits the share button when shareBase is absent", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig({ shareBase: undefined }));
    assert.strictEqual(c.querySelector(".already-header-share"), null);
  });

  it("renders nothing when showHeader is false", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig({ showHeader: false }));
    assert.strictEqual(c.innerHTML, "");
  });
});

describe("renderHeader header link", () => {
  it("links the title when headerUrl is a valid https URL", () => {
    const c = document.createElement("div");
    renderHeader(
      c,
      { name: "No Big Bend Wall" },
      baseConfig({
        headerUrl: "https://nobigbendwall.org/",
      }),
    );
    const link = c.querySelector(
      ".already-header-name a.already-header-name-link",
    );
    assert.ok(link, "title is wrapped in an anchor");
    assert.strictEqual(link.getAttribute("href"), "https://nobigbendwall.org/");
    assert.strictEqual(link.getAttribute("target"), "_blank");
    assert.strictEqual(link.getAttribute("rel"), "noopener noreferrer");
    assert.strictEqual(link.textContent, "No Big Bend Wall");
  });

  it("links the title for a valid http URL too", () => {
    const c = document.createElement("div");
    renderHeader(
      c,
      { name: "Plain HTTP" },
      baseConfig({ headerUrl: "http://example.com/" }),
    );
    const link = c.querySelector(
      ".already-header-name a.already-header-name-link",
    );
    assert.ok(link, "title is wrapped in an anchor");
    assert.strictEqual(link.getAttribute("href"), "http://example.com/");
  });

  it("leaves the title as plain text when headerUrl is unset", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "No Big Bend Wall" }, baseConfig());
    const h = c.querySelector(".already-header-name");
    assert.ok(h, "title rendered");
    assert.strictEqual(h.querySelector("a"), null, "no anchor");
    assert.strictEqual(h.textContent, "No Big Bend Wall");
  });

  it("ignores a non-http(s) headerUrl scheme (renders plain text)", () => {
    const c = document.createElement("div");
    renderHeader(
      c,
      { name: "Evil" },
      baseConfig({ headerUrl: "javascript:alert(1)" }),
    );
    const h = c.querySelector(".already-header-name");
    assert.strictEqual(
      h.querySelector("a"),
      null,
      "javascript: scheme rejected",
    );
    assert.strictEqual(h.textContent, "Evil");
  });

  it("ignores an unparseable headerUrl (renders plain text)", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "Cal" }, baseConfig({ headerUrl: "not a url" }));
    const h = c.querySelector(".already-header-name");
    assert.strictEqual(h.querySelector("a"), null);
    assert.strictEqual(h.textContent, "Cal");
  });
});
