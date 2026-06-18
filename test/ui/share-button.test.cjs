require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let createShareButton;
before(async () => {
  ({ createShareButton } = await import("../../src/ui/share-button.js"));
});

function setShare(fn) {
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });
}
function setClipboard(obj) {
  Object.defineProperty(navigator, "clipboard", {
    value: obj,
    configurable: true,
  });
}
afterEach(() => {
  delete navigator.share;
  delete navigator.clipboard;
});

const opts = (over = {}) => ({
  className: "already-detail-share",
  label: "Share",
  copiedLabel: "Copied!",
  getUrl: () => "https://x/cal/event/e1",
  getTitle: () => "My Event",
  ...over,
});

describe("createShareButton", () => {
  it("renders an icon + label button", () => {
    const btn = createShareButton(opts());
    assert.strictEqual(btn.tagName, "BUTTON");
    assert.strictEqual(btn.getAttribute("type"), "button");
    assert.strictEqual(btn.getAttribute("aria-label"), "Share");
    assert.ok(btn.querySelector("svg"), "has share icon");
    const lbl = btn.querySelector(".already-share-label");
    assert.strictEqual(lbl.textContent, "Share");
    assert.strictEqual(lbl.getAttribute("aria-live"), "polite");
  });

  it("calls share with click-time url + title; label unchanged on share", async () => {
    let got = null;
    setShare(async (d) => {
      got = d;
    });
    const btn = createShareButton(opts());
    btn.click();
    const outcome = await btn._shareResult;
    assert.strictEqual(outcome, "shared");
    assert.deepStrictEqual(got, {
      title: "My Event",
      url: "https://x/cal/event/e1",
    });
    assert.strictEqual(
      btn.querySelector(".already-share-label").textContent,
      "Share",
    );
  });

  it("shows Copied! when the clipboard fallback runs", async () => {
    let wrote = null;
    setClipboard({
      writeText: async (u) => {
        wrote = u;
      },
    });
    const btn = createShareButton(opts());
    btn.click();
    const outcome = await btn._shareResult;
    assert.strictEqual(outcome, "copied");
    assert.strictEqual(wrote, "https://x/cal/event/e1");
    assert.strictEqual(
      btn.querySelector(".already-share-label").textContent,
      "Copied!",
    );
  });

  it("reverts the label after copiedDuration", async () => {
    setClipboard({ writeText: async () => {} });
    const btn = createShareButton(opts({ copiedDuration: 5 }));
    btn.click();
    await btn._shareResult;
    assert.strictEqual(
      btn.querySelector(".already-share-label").textContent,
      "Copied!",
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(
      btn.querySelector(".already-share-label").textContent,
      "Share",
    );
  });
});
