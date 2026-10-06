require("../setup-dom.cjs");
const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");

let createElement, bindEventClick, applyEventClasses;
let sortFeatured, sortFeaturedByDate;
let eventLinkText;

before(async () => {
  const mod = await import("../../src/views/helpers.js");
  createElement = mod.createElement;
  bindEventClick = mod.bindEventClick;
  eventLinkText = mod.eventLinkText;
  applyEventClasses = mod.applyEventClasses;
  sortFeatured = mod.sortFeatured;
  sortFeaturedByDate = mod.sortFeaturedByDate;
});

beforeEach(() => {
  window.location.hash = "";
  document.body.innerHTML = "";
});

// Card/date grouping is now keyed by the VIEWER's zone (see eventDayKey),
// so the ambient TZ decides which date bucket an event falls in. Pin it to UTC
// — the zone these fixtures are written against — so the assertions below are
// deterministic on every machine and in CI, and restore it afterward so no
// state leaks into other test files.
let originalTZ;

before(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
});

after(() => {
  if (originalTZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTZ;
  }
});

describe("createElement", () => {
  it("creates element with tag and className", () => {
    const el = createElement("div", "my-class");
    assert.strictEqual(el.tagName, "DIV");
    assert.strictEqual(el.className, "my-class");
  });

  it("creates element without className", () => {
    const el = createElement("span");
    assert.strictEqual(el.tagName, "SPAN");
    assert.strictEqual(el.className, "");
  });

  it("applies attributes", () => {
    const el = createElement("button", "btn", {
      "aria-label": "Close",
      role: "button",
    });
    assert.strictEqual(el.getAttribute("aria-label"), "Close");
    assert.strictEqual(el.getAttribute("role"), "button");
  });
});

describe("bindEventClick on a link", () => {
  const link = (href = "#event/evt-1") => {
    const a = document.createElement("a");
    a.setAttribute("href", href);
    a.textContent = "Event";
    document.body.appendChild(a);
    return a;
  };
  const click = (el, init = {}) => {
    const e = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    });
    el.dispatchEvent(e);
    return e;
  };

  it("navigates to the link's href on a plain click", () => {
    const el = link();
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    const e = click(el);
    assert.strictEqual(e.defaultPrevented, true);
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("moves only the fragment of an absolute href into the hash", () => {
    // eventHref returns the page's absolute URL when the document has a
    // base element; the route is still only the fragment.
    const el = link("http://localhost/#event/evt-9");
    bindEventClick(el, { id: "evt-9" }, "grid", {});
    click(el);
    assert.strictEqual(window.location.hash, "#event/evt-9");
  });

  it("calls onEventClick before navigating", () => {
    const el = link();
    const calls = [];
    bindEventClick(el, { id: "evt-1" }, "grid", {
      onEventClick: (event, view) => calls.push([event.id, view]),
    });
    click(el);
    assert.deepStrictEqual(calls, [["evt-1", "grid"]]);
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("prevents navigation when onEventClick returns false", () => {
    const el = link();
    bindEventClick(el, { id: "evt-1" }, "grid", { onEventClick: () => false });
    const e = click(el);
    assert.strictEqual(e.defaultPrevented, true);
    assert.strictEqual(window.location.hash, "");
  });

  it("prevents navigation when canNavigate says no, before asking the host", () => {
    const el = link();
    let asked = false;
    bindEventClick(
      el,
      { id: "evt-1" },
      "grid",
      { onEventClick: () => (asked = true) },
      { canNavigate: () => false },
    );
    const e = click(el);
    assert.strictEqual(e.defaultPrevented, true);
    assert.strictEqual(asked, false);
    assert.strictEqual(window.location.hash, "");
  });

  it("leaves a modifier click to the browser", () => {
    const el = link();
    let asked = false;
    bindEventClick(el, { id: "evt-1" }, "grid", {
      onEventClick: () => (asked = true),
    });
    // An unprevented click queues jsdom's own navigation, which could land
    // during a later test.
    const decisions = [];
    el.addEventListener("click", (e) => {
      decisions.push(e.defaultPrevented);
      e.preventDefault();
    });
    for (const init of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      click(el, init);
    }
    assert.deepStrictEqual(decisions, [false, false, false, false, false]);
    assert.strictEqual(asked, false);
    assert.strictEqual(window.location.hash, "");
  });

  it("sets no role and no tabindex", () => {
    const el = link();
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    assert.strictEqual(el.getAttribute("role"), null);
    assert.strictEqual(el.getAttribute("tabindex"), null);
  });

  it("lets the click bubble", () => {
    const parent = document.createElement("div");
    const el = link();
    parent.appendChild(el);
    document.body.appendChild(parent);
    let parentClicked = false;
    parent.addEventListener("click", () => {
      parentClicked = true;
    });
    bindEventClick(el, { id: "evt-1" }, "month", {});
    click(el);
    assert.strictEqual(parentClicked, true);
  });

  it("is a no-op for an entry with no link", () => {
    assert.doesNotThrow(() =>
      bindEventClick(null, { title: "No id" }, "grid", {}),
    );
    // A chip or block for an entry with no route is a plain div with no
    // href (ui/event-link.js, eventAnchor); binding it must change nothing.
    const plain = document.createElement("div");
    document.body.appendChild(plain);
    bindEventClick(plain, { title: "No id" }, "month", {});
    const e = click(plain);
    assert.strictEqual(e.defaultPrevented, false);
    assert.strictEqual(plain.getAttribute("role"), null);
    assert.strictEqual(window.location.hash, "");
  });
});

describe("eventLinkText", () => {
  it("is the entry's title", () => {
    assert.strictEqual(
      eventLinkText({ title: "Burger Night" }, {}),
      "Burger Night",
    );
  });

  it("falls back to the i18n openEvent text, then to the default", () => {
    assert.strictEqual(
      eventLinkText({ title: "" }, { i18n: { openEvent: "Abrir" } }),
      "Abrir",
    );
    assert.strictEqual(eventLinkText({ title: "" }, {}), "Open event");
    assert.strictEqual(eventLinkText({}, undefined), "Open event");
  });

  it("treats a whitespace-only title as missing", () => {
    // A blank title is truthy, and a hidden link filled with spaces has no
    // accessible name.
    assert.strictEqual(eventLinkText({ title: "   " }, {}), "Open event");
  });
});

describe("applyEventClasses", () => {
  it("sets base class", () => {
    const el = document.createElement("div");
    applyEventClasses(
      el,
      { start: "2099-01-01T00:00:00Z", featured: false },
      "already-card",
    );
    assert.strictEqual(el.className, "already-card");
  });

  it("adds --past for past events", () => {
    const el = document.createElement("div");
    applyEventClasses(
      el,
      { start: "2020-01-01T00:00:00Z", featured: false },
      "already-card",
    );
    assert.ok(el.className.includes("already-card--past"));
  });

  it("adds --featured for featured events", () => {
    const el = document.createElement("div");
    applyEventClasses(
      el,
      { start: "2099-01-01T00:00:00Z", featured: true },
      "already-card",
    );
    assert.ok(el.className.includes("already-card--featured"));
  });

  it("adds both --past and --featured", () => {
    const el = document.createElement("div");
    applyEventClasses(
      el,
      { start: "2020-01-01T00:00:00Z", featured: true },
      "already-card",
    );
    assert.ok(el.className.includes("already-card--past"));
    assert.ok(el.className.includes("already-card--featured"));
  });

  it("does not mark an ongoing event (past start, future end) as past", () => {
    // --past means "the event is over", so it keys off the end, not the start.
    const el = document.createElement("div");
    applyEventClasses(
      el,
      {
        start: "2020-01-01T00:00:00Z",
        end: "2099-01-01T00:00:00Z",
        featured: false,
      },
      "already-card",
    );
    assert.ok(!el.className.includes("already-card--past"));
  });

  it("does not mark an ongoing all-day event as past (uses the exclusive end)", () => {
    // Date-only all-day span: a past start through a future (exclusive) end is
    // still ongoing and must not be greyed out.
    const el = document.createElement("div");
    applyEventClasses(
      el,
      { start: "2020-01-01", end: "2099-01-01", allDay: true, featured: false },
      "already-card",
    );
    assert.ok(!el.className.includes("already-card--past"));
  });
});

describe("sortFeatured", () => {
  it("sorts featured events first", () => {
    const events = [
      { id: "1", featured: false },
      { id: "2", featured: true },
      { id: "3", featured: false },
    ];
    const result = sortFeatured(events);
    assert.strictEqual(result[0].id, "2");
  });

  it("preserves relative order of non-featured events", () => {
    const events = [
      { id: "1", featured: false },
      { id: "2", featured: false },
      { id: "3", featured: true },
    ];
    const result = sortFeatured(events);
    assert.strictEqual(result[0].id, "3");
    assert.strictEqual(result[1].id, "1");
    assert.strictEqual(result[2].id, "2");
  });

  it("does not mutate original array", () => {
    const events = [
      { id: "1", featured: false },
      { id: "2", featured: true },
    ];
    sortFeatured(events);
    assert.strictEqual(events[0].id, "1");
  });
});

describe("sortFeaturedByDate", () => {
  it("sorts featured first within same date only", () => {
    const events = [
      { id: "a", start: "2026-04-14T10:00:00Z", featured: false },
      { id: "b", start: "2026-04-15T10:00:00Z", featured: false },
      { id: "c", start: "2026-04-15T14:00:00Z", featured: true },
      { id: "d", start: "2026-04-16T10:00:00Z", featured: false },
    ];
    const result = sortFeaturedByDate(events);
    assert.strictEqual(result[0].id, "a");
    assert.strictEqual(result[1].id, "c");
    assert.strictEqual(result[2].id, "b");
    assert.strictEqual(result[3].id, "d");
  });

  it("does not move featured events across dates", () => {
    const events = [
      { id: "a", start: "2026-04-14T10:00:00Z", featured: false },
      { id: "b", start: "2026-04-15T10:00:00Z", featured: true },
    ];
    const result = sortFeaturedByDate(events);
    assert.strictEqual(result[0].id, "a");
    assert.strictEqual(result[1].id, "b");
  });

  it("keeps same-date events grouped when interleaved with other dates", () => {
    const events = [
      { id: "a", start: "2026-04-14T10:00:00Z", featured: false },
      { id: "b", start: "2026-04-14T14:00:00Z", featured: true },
      { id: "c", start: "2026-04-15T10:00:00Z", featured: false },
      { id: "d", start: "2026-04-14T16:00:00Z", featured: false },
    ];
    const result = sortFeaturedByDate(events);
    // Apr 14 events grouped together: featured first, then non-featured in original order
    assert.strictEqual(result[0].id, "b");
    assert.strictEqual(result[1].id, "a");
    assert.strictEqual(result[2].id, "d");
    // Apr 15 event last
    assert.strictEqual(result[3].id, "c");
  });
});
