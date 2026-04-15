require("../setup-dom.cjs");
const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");

let createElement, bindEventClick, applyEventClasses;
let filterHidden, sortFeatured, sortFeaturedByDate;

before(async () => {
  const mod = await import("../../src/views/helpers.js");
  createElement = mod.createElement;
  bindEventClick = mod.bindEventClick;
  applyEventClasses = mod.applyEventClasses;
  filterHidden = mod.filterHidden;
  sortFeatured = mod.sortFeatured;
  sortFeaturedByDate = mod.sortFeaturedByDate;
});

beforeEach(() => {
  window.location.hash = "";
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

describe("bindEventClick", () => {
  it("navigates to event detail on click", () => {
    const el = document.createElement("div");
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    el.click();
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("calls onEventClick before navigating", () => {
    const el = document.createElement("div");
    let called = false;
    const config = {
      onEventClick: (_event, _view) => {
        called = true;
      },
    };
    bindEventClick(el, { id: "evt-1" }, "grid", config);
    el.click();
    assert.strictEqual(called, true);
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("prevents navigation when onEventClick returns false", () => {
    const el = document.createElement("div");
    const config = { onEventClick: () => false };
    bindEventClick(el, { id: "evt-1" }, "grid", config);
    el.click();
    assert.strictEqual(window.location.hash, "");
  });

  it("sets tabindex and role", () => {
    const el = document.createElement("div");
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    assert.strictEqual(el.getAttribute("tabindex"), "0");
    assert.strictEqual(el.getAttribute("role"), "button");
  });

  it("handles Enter key", () => {
    const el = document.createElement("div");
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    el.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("handles Space key", () => {
    const el = document.createElement("div");
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    el.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("stops propagation when stopPropagation option is true", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    let parentClicked = false;
    parent.addEventListener("click", () => {
      parentClicked = true;
    });
    bindEventClick(
      child,
      { id: "evt-1" },
      "month",
      {},
      { stopPropagation: true },
    );
    child.click();
    assert.strictEqual(parentClicked, false);
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("does not stop propagation by default", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    let parentClicked = false;
    parent.addEventListener("click", () => {
      parentClicked = true;
    });
    bindEventClick(child, { id: "evt-2" }, "grid", {});
    child.click();
    assert.strictEqual(parentClicked, true);
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
});

describe("filterHidden", () => {
  it("removes hidden events", () => {
    const events = [
      { id: "1", hidden: false },
      { id: "2", hidden: true },
      { id: "3", hidden: false },
    ];
    const result = filterHidden(events);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, "1");
    assert.strictEqual(result[1].id, "3");
  });

  it("returns all events when none hidden", () => {
    const events = [
      { id: "1", hidden: false },
      { id: "2", hidden: false },
    ];
    assert.strictEqual(filterHidden(events).length, 2);
  });

  it("returns empty array for all hidden", () => {
    const events = [{ id: "1", hidden: true }];
    assert.strictEqual(filterHidden(events).length, 0);
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
    const result = sortFeaturedByDate(events, "UTC", "en-US");
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
    const result = sortFeaturedByDate(events, "UTC", "en-US");
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
    const result = sortFeaturedByDate(events, "UTC", "en-US");
    // Apr 14 events grouped together: featured first, then non-featured in original order
    assert.strictEqual(result[0].id, "b");
    assert.strictEqual(result[1].id, "a");
    assert.strictEqual(result[2].id, "d");
    // Apr 15 event last
    assert.strictEqual(result[3].id, "c");
  });
});
