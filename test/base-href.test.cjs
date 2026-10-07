require("./setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, until } = require("./helpers.cjs");

// On a page with a <base href>, an event link's href is the page's absolute
// URL plus the fragment, fixed when the view rendered (router.eventHref). A
// host that changes its own URL with pushState while the widget stays
// mounted must not leave a middle click, "Open in new tab", or "Copy link
// address" on the URL the page had then (#105).
let init;
let keepEventHrefsCurrent;
const instances = [];
let base = null;
before(async () => {
  ({ init } = await import("../src/already-cal.js"));
  ({ keepEventHrefsCurrent } = await import("../src/ui/event-link.js"));
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
  base?.remove();
  base = null;
  window.history.replaceState({}, "", "/cal/");
});

function addBase() {
  base = document.createElement("base");
  base.setAttribute("href", "/elsewhere/");
  document.head.appendChild(base);
}

// The 15th of the current month at noon, local time: inside the month the
// month view shows, whatever the zone, so the chip test has a chip to find.
function thisMonthAt(hour) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 15, hour).toISOString();
}

function mount(view) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    data: {
      events: [
        createTestEvent({
          id: "e1",
          title: "Alpha",
          start: thisMonthAt(10),
          end: thisMonthAt(11),
        }),
      ],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: view,
    views: [view],
  });
  instances.push({ instance, container });
  return container;
}

// jsdom's Event, not Node's: dispatchEvent accepts only its own realm's.
const bubbling = (type) => new window.Event(type, { bubbles: true });

describe("an event link on a page with a base element", () => {
  for (const [gesture, type] of [
    ["the pointer arriving", "pointerover"],
    ["a pointer going down", "pointerdown"],
    ["focus arriving", "focusin"],
    ["the context menu opening", "contextmenu"],
  ]) {
    it(`is refreshed from the current URL when ${gesture}`, async () => {
      window.history.replaceState({}, "", "/cal/");
      addBase();
      const c = mount("grid");
      await until(() => c.querySelector("a.already-card__link"), "the card");
      const link = c.querySelector("a.already-card__link");
      assert.strictEqual(
        link.getAttribute("href"),
        "http://localhost/cal/#event/e1",
      );
      window.history.pushState({}, "", "/cal/page2?tab=events");
      link.dispatchEvent(bubbling(type));
      assert.strictEqual(
        link.getAttribute("href"),
        "http://localhost/cal/page2?tab=events#event/e1",
      );
    });
  }

  it("is refreshed when the gesture lands on a child of the link", async () => {
    window.history.replaceState({}, "", "/cal/");
    addBase();
    const c = mount("month");
    await until(() => c.querySelector("a.already-month-chip"), "the chip");
    const chip = c.querySelector("a.already-month-chip");
    const inner = document.createElement("span");
    chip.appendChild(inner);
    window.history.pushState({}, "", "/cal/other");
    inner.dispatchEvent(bubbling("pointerdown"));
    assert.strictEqual(
      chip.getAttribute("href"),
      "http://localhost/cal/other#event/e1",
    );
  });

  it("leaves a link that is not an event's alone", async () => {
    window.history.replaceState({}, "", "/cal/");
    addBase();
    const c = mount("grid");
    await until(() => c.querySelector("a.already-card__link"), "the card");
    const other = document.createElement("a");
    other.setAttribute("href", "http://localhost/cal/#grid");
    c.appendChild(other);
    window.history.pushState({}, "", "/cal/page2");
    other.dispatchEvent(bubbling("pointerdown"));
    assert.strictEqual(
      other.getAttribute("href"),
      "http://localhost/cal/#grid",
    );
  });

  it("rewrites a host's own #event/ link inside the widget, which the base misdirects too", async () => {
    // A description can carry such a link. Relative, it resolves against
    // the base and opens the wrong page; rewritten, it opens this one.
    window.history.replaceState({}, "", "/cal/");
    addBase();
    const c = mount("grid");
    await until(() => c.querySelector("a.already-card__link"), "the card");
    const own = document.createElement("a");
    own.setAttribute("href", "#event/e1");
    c.appendChild(own);
    assert.strictEqual(own.href, "http://localhost/elsewhere/#event/e1");
    window.history.pushState({}, "", "/cal/page2");
    own.dispatchEvent(bubbling("pointerdown"));
    assert.strictEqual(
      own.getAttribute("href"),
      "http://localhost/cal/page2#event/e1",
    );
  });

  it("ignores a link whose href the URL parser rejects, without an error", async () => {
    // The description sanitizer checks a link's scheme, not its shape, so a
    // malformed href can reach the DOM; a gesture on it must not throw.
    window.history.replaceState({}, "", "/cal/");
    addBase();
    const c = mount("grid");
    await until(() => c.querySelector("a.already-card__link"), "the card");
    const bad = document.createElement("a");
    bad.setAttribute("href", "http://[bad");
    c.appendChild(bad);
    const errors = [];
    const onError = (e) => errors.push(e.message);
    window.addEventListener("error", onError);
    try {
      window.history.pushState({}, "", "/cal/page2");
      bad.dispatchEvent(bubbling("pointerdown"));
    } finally {
      window.removeEventListener("error", onError);
    }
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(bad.getAttribute("href"), "http://[bad");
  });
});

describe("an event link on a page without a base element", () => {
  it("stays the relative fragment, which cannot go stale", async () => {
    window.history.replaceState({}, "", "/cal/");
    const c = mount("grid");
    await until(() => c.querySelector("a.already-card__link"), "the card");
    const link = c.querySelector("a.already-card__link");
    window.history.pushState({}, "", "/cal/page2");
    link.dispatchEvent(bubbling("pointerdown"));
    assert.strictEqual(link.getAttribute("href"), "#event/e1");
  });
});

describe("keepEventHrefsCurrent", () => {
  it("stops refreshing once unbound", () => {
    addBase();
    const root = document.createElement("div");
    const link = document.createElement("a");
    link.setAttribute("href", "http://localhost/cal/#event/x");
    root.appendChild(link);
    document.body.appendChild(root);
    try {
      const unbind = keepEventHrefsCurrent(root);
      window.history.pushState({}, "", "/cal/one");
      link.dispatchEvent(bubbling("pointerdown"));
      assert.strictEqual(
        link.getAttribute("href"),
        "http://localhost/cal/one#event/x",
      );
      unbind();
      window.history.pushState({}, "", "/cal/two");
      link.dispatchEvent(bubbling("pointerdown"));
      assert.strictEqual(
        link.getAttribute("href"),
        "http://localhost/cal/one#event/x",
      );
    } finally {
      root.remove();
    }
  });
});
