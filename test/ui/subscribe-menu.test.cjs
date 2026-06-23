require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let createSubscribeMenu;
before(async () => {
  ({ createSubscribeMenu } = await import("../../src/ui/subscribe-menu.js"));
});
function setClipboard(obj) {
  Object.defineProperty(navigator, "clipboard", { value: obj, configurable: true });
}
afterEach(() => {
  delete navigator.clipboard;
  document.body.innerHTML = "";
});

const GFEED =
  "webcal://calendar.google.com/calendar/ical/" +
  "c_abc%40group.calendar.google.com/public/basic.ics";
const opts = (over = {}) => ({ subscribeUrl: GFEED, label: "Subscribe", i18n: {}, ...over });

describe("createSubscribeMenu", () => {
  it("returns null when the URL yields no targets", () => {
    assert.strictEqual(createSubscribeMenu(opts({ subscribeUrl: "mailto:x" })), null);
  });

  it("renders a closed disclosure button + a hidden list of 4 items", () => {
    const el = createSubscribeMenu(opts());
    const btn = el.querySelector("button.already-header-subscribe");
    assert.ok(btn, "has trigger button");
    assert.strictEqual(btn.getAttribute("aria-expanded"), "false");
    assert.ok(/Subscribe/.test(btn.textContent));
    const list = el.querySelector(".already-subscribe-list");
    assert.strictEqual(list.hidden, true);
    assert.strictEqual(list.querySelectorAll(".already-subscribe-item").length, 4);
  });

  it("links carry the right hrefs; https targets open in a new tab; webcal does not", () => {
    const el = createSubscribeMenu(opts());
    const items = [...el.querySelectorAll("a.already-subscribe-item")];
    const apple = items.find((a) => a.href.startsWith("webcal:"));
    assert.ok(apple, "apple is a webcal link");
    assert.strictEqual(apple.getAttribute("target"), null);
    const google = items.find((a) => a.href.includes("calendar/r?cid="));
    assert.strictEqual(google.getAttribute("target"), "_blank");
    assert.strictEqual(google.getAttribute("rel"), "noopener noreferrer");
  });

  it("toggles open/closed via the button and aria-expanded", () => {
    const el = createSubscribeMenu(opts());
    const btn = el.querySelector("button.already-header-subscribe");
    const list = el.querySelector(".already-subscribe-list");
    btn.click();
    assert.strictEqual(list.hidden, false);
    assert.strictEqual(btn.getAttribute("aria-expanded"), "true");
    btn.click();
    assert.strictEqual(list.hidden, true);
    assert.strictEqual(btn.getAttribute("aria-expanded"), "false");
  });

  it("Esc closes an open menu and returns focus to the button", () => {
    const el = createSubscribeMenu(opts());
    document.body.appendChild(el);
    const btn = el.querySelector("button.already-header-subscribe");
    btn.click();
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.strictEqual(el.querySelector(".already-subscribe-list").hidden, true);
    assert.strictEqual(document.activeElement, btn);
  });

  it("Copy item writes the https feed and flips its label to copied", async () => {
    let wrote = null;
    setClipboard({ writeText: async (u) => { wrote = u; } });
    const el = createSubscribeMenu(opts({ i18n: { copied: "Copied!" } }));
    const copy = el.querySelector("button.already-subscribe-item");
    copy.click();
    await copy._copyResult;
    assert.strictEqual(
      wrote,
      "https://calendar.google.com/calendar/ical/" +
        "c_abc%40group.calendar.google.com/public/basic.ics"
    );
    assert.strictEqual(copy.querySelector(".already-subscribe-item-label").textContent, "Copied!");
  });

  it("destroy() removes the document listeners (Esc no longer closes)", () => {
    const el = createSubscribeMenu(opts());
    document.body.appendChild(el);
    const btn = el.querySelector("button.already-header-subscribe");
    btn.click();
    el.destroy();
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    // listener removed → menu stays as it was at destroy (open)
    assert.strictEqual(el.querySelector(".already-subscribe-list").hidden, false);
  });
});
