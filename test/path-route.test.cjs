require("./setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

// A visitor who arrives from a shared event link lands on a page whose path
// is /event/<id>. The widget opens that event, and must then let them leave
// it: Back and the links to other events write the hash, and the path stays.
let init;
const instances = [];
before(async () => {
  ({ init } = await import("../src/already-cal.js"));
  window.history.replaceState({}, "", "/cal/event/e1");
});
after(() => {
  window.history.replaceState({}, "", "/");
});
afterEach(() => {
  for (const inst of instances) {
    inst.instance.destroy();
    inst.container.remove();
  }
  instances.length = 0;
  window.location.hash = "";
});

const settle = () => new Promise((r) => setTimeout(r, 20));

function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    data: {
      events: [
        createTestEvent({ id: "e1", title: "Alpha" }),
        createTestEvent({ id: "e2", title: "Beta" }),
      ],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: "grid",
    views: ["grid", "list"],
  });
  instances.push({ instance, container });
  return container;
}

describe("a page served at /event/<id>", () => {
  it("opens that event, and Back returns to the calendar", async () => {
    const container = mount();
    await settle();
    assert.strictEqual(
      container.querySelector(".already-detail-title").textContent,
      "Alpha",
    );
    container.querySelector(".already-detail-back").click();
    await settle();
    assert.strictEqual(container.querySelector(".already-detail"), null);
    assert.strictEqual(container.querySelectorAll(".already-card").length, 2);
    assert.strictEqual(window.location.pathname, "/cal/event/e1");
  });

  it("opens another event from its link", async () => {
    const container = mount();
    await settle();
    container.querySelector(".already-detail-back").click();
    await settle();
    container.querySelector('a.already-card__link[href="#event/e2"]').click();
    await settle();
    assert.strictEqual(
      container.querySelector(".already-detail-title").textContent,
      "Beta",
    );
  });
});
