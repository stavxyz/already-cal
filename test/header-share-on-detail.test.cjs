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
});
