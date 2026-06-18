require("./setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let init;
before(async () => {
  ({ init } = await import("../src/already-cal.js"));
});

const mounted = [];
afterEach(() => {
  for (const { instance, container } of mounted.splice(0)) {
    instance?.destroy?.();
    container.remove();
  }
});

function mount(extra) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    shareUrl: "https://host.example/cal",
    data: {
      events: [createTestEvent({ id: "e1", title: "Gig" })],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    ...extra,
  });
  mounted.push({ instance, container });
  return container;
}

const tick = () => new Promise((r) => setTimeout(r, 10));

describe("header calendar-share visibility by view", () => {
  it("shows the header share button on a calendar view", async () => {
    const container = mount({});
    await tick();
    const headerShare = container.querySelector(".already-header-share");
    assert.ok(headerShare, "header share rendered");
    assert.strictEqual(
      headerShare.hasAttribute("hidden"),
      false,
      "visible on the calendar view",
    );
  });

  it("hides the header share button on the event-detail view", async () => {
    // initialEvent lands the widget directly on the detail view
    const container = mount({ initialEvent: "e1" });
    await tick();
    const headerShare = container.querySelector(".already-header-share");
    assert.ok(headerShare, "header share rendered");
    assert.strictEqual(
      headerShare.hasAttribute("hidden"),
      true,
      "hidden on the event-detail view (the event has its own Share button)",
    );
  });

  it("re-shows the header share button after navigating back from detail", async () => {
    const container = mount({ initialEvent: "e1" });
    await tick();
    const headerShare = container.querySelector(".already-header-share");
    assert.strictEqual(
      headerShare.hasAttribute("hidden"),
      true,
      "hidden on detail",
    );
    // Back button → setView() to a calendar view → renderView re-shows it
    container.querySelector(".already-detail-back").click();
    await tick();
    assert.strictEqual(
      headerShare.hasAttribute("hidden"),
      false,
      "visible again after back-navigation",
    );
  });

  it("header share copy fallback shows the clipboard-emoji label by default", async () => {
    // No navigator.share → copy path; no i18n.copied → the "📋 Copied!" default
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
      configurable: true,
    });
    const container = mount({});
    await tick();
    const headerShare = container.querySelector(".already-header-share");
    headerShare.click();
    await headerShare._shareResult;
    assert.strictEqual(
      headerShare.querySelector(".already-share-label").textContent,
      "📋 Copied!",
    );
    delete navigator.clipboard;
  });
});
