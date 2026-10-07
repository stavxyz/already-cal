require("./setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

// A visitor who arrives from a shared event link lands on a page whose path
// is /event/<id>. The widget opens that event, and must then let them leave
// it: Back and the links to other events write the hash, and the path stays.
const PAGE = "/cal/event/e1";
let init;
const instances = [];
before(async () => {
  ({ init } = await import("../src/already-cal.js"));
  window.history.replaceState({}, "", PAGE);
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
  delete navigator.share;
  delete navigator._lastShare;
  // replaceState, not `location.hash = ""`: the latter leaves a trailing `#`
  // and queues a hashchange that would reach the next test.
  window.history.replaceState({}, "", PAGE);
});

// Rendering after `init` is asynchronous (the data load awaits), and a hash
// change reaches the widget on a later task, so wait for the DOM to show
// what the step should produce instead of for a fixed time.
async function until(check, what) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail(`timed out waiting for ${what}`);
}
const detailTitle = (c) =>
  c.querySelector(".already-detail-title")?.textContent ?? null;

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
    const c = mount();
    await until(() => detailTitle(c) === "Alpha", "the path's event");
    c.querySelector(".already-detail-back").click();
    await until(() => c.querySelector(".already-detail") === null, "Back");
    assert.strictEqual(c.querySelectorAll(".already-card").length, 2);
    assert.strictEqual(window.location.pathname, PAGE);
    assert.strictEqual(window.location.hash, "#grid");
  });

  it("opens another event from its link", async () => {
    const c = mount();
    await until(() => detailTitle(c) === "Alpha", "the path's event");
    c.querySelector(".already-detail-back").click();
    await until(() => c.querySelector(".already-detail") === null, "Back");
    const link = c.querySelector('a.already-card__link[href="#event/e2"]');
    assert.ok(link, "Back shows the cards, with their links");
    link.click();
    await until(() => detailTitle(c) === "Beta", "the other event");
  });

  it("shows the view the hash names on a reload after Back", async () => {
    window.location.hash = "#grid";
    const c = mount();
    await until(() => c.querySelectorAll(".already-card").length === 2, "grid");
    assert.strictEqual(c.querySelector(".already-detail"), null);
  });

  it("reopens the path's event when the browser's Back clears the hash", async () => {
    const c = mount();
    await until(() => detailTitle(c) === "Alpha", "the path's event");
    c.querySelector(".already-detail-back").click();
    await until(() => c.querySelector(".already-detail") === null, "Back");
    // The browser's own Back lands on the entry before `#grid`: the
    // arrival URL, with no fragment at all.
    window.history.back();
    await until(() => detailTitle(c) === "Alpha", "the path's event again");
    assert.strictEqual(window.location.href, `http://localhost${PAGE}`);
  });

  it("stays on the calendar when a host link to # is clicked", async () => {
    // <a href="#"> leaves a bare `#`, which reads as an empty hash too, and
    // it is not the arrival entry.
    const c = mount();
    await until(() => detailTitle(c) === "Alpha", "the path's event");
    c.querySelector(".already-detail-back").click();
    await until(() => c.querySelector(".already-detail") === null, "Back");
    const top = document.createElement("a");
    top.href = "#";
    document.body.appendChild(top);
    const changed = new Promise((r) =>
      window.addEventListener("hashchange", r, { once: true }),
    );
    top.click();
    await changed;
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(window.location.href, `http://localhost${PAGE}#`);
    assert.strictEqual(c.querySelector(".already-detail"), null);
    assert.strictEqual(c.querySelectorAll(".already-card").length, 2);
    top.remove();
  });

  it("stays on the calendar when a host sets a hash the widget does not know", async () => {
    const c = mount();
    await until(() => detailTitle(c) === "Alpha", "the path's event");
    c.querySelector(".already-detail-back").click();
    await until(() => c.querySelector(".already-detail") === null, "Back");
    // Wait for the hashchange itself, then one more task so the widget's
    // listener, registered earlier, has run before the view is read.
    const changed = new Promise((r) =>
      window.addEventListener("hashchange", r, { once: true }),
    );
    window.location.hash = "#main";
    await changed;
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(c.querySelector(".already-detail"), null);
    assert.strictEqual(c.querySelectorAll(".already-card").length, 2);
  });

  it("shares the path's event as one /event/<id> path", async () => {
    Object.defineProperty(navigator, "share", {
      value: async (d) => {
        navigator._lastShare = d;
      },
      configurable: true,
    });
    const c = mount();
    await until(() => detailTitle(c) === "Alpha", "the path's event");
    const share = c.querySelector(".already-detail-share");
    share.click();
    await share._shareResult;
    assert.strictEqual(
      navigator._lastShare.url,
      "http://localhost/cal/event/e1",
    );
  });
});
