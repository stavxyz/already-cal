require("../setup-dom.cjs");
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderDayView;
let place;

before(async () => {
  const mod = await import("../../src/views/day.js");
  renderDayView = mod.renderDayView;
  const { placeByDay } = await import("../../src/views/placement.js");
  const { eventDayKey } = await import("../../src/util/dates.js");
  place = (events) => placeByDay(events, eventDayKey);
});

// day.js renders event times via formatEventWhen, which formats in the
// VIEWER's local zone (Intl.DateTimeFormat().resolvedOptions().timeZone,
// driven by process.env.TZ) and appends a " · ... " source-zone suffix when
// the viewer zone differs from the event's source zone. Pin the viewer zone
// to UTC for these tests so the exact-string time assertions below are
// deterministic across machines/CI regardless of the ambient TZ, and restore
// the original value afterward to avoid leaking state into other test files.
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

beforeEach(() => {
  window.location.hash = "";
});

describe("renderDayView", () => {
  const targetDate = new Date(2026, 3, 15); // April 15, 2026

  it("renders events for the target day", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "1", start: "2026-04-15T10:00:00Z" }),
      createTestEvent({ id: "2", start: "2026-04-16T10:00:00Z" }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    assert.strictEqual(
      container.querySelectorAll(".already-day-event").length,
      1,
    );
  });

  it("shows empty state when no events", () => {
    const container = document.createElement("div");
    renderDayView(container, place([]), "UTC", targetDate, {});
    assert.ok(container.querySelector(".already-day-empty"));
  });

  it("displays event title safely", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        title: "Test & <b>Bold</b>",
        start: "2026-04-15T10:00:00Z",
      }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    const title = container.querySelector(".already-day-event-title");
    assert.strictEqual(title.textContent, "Test & <b>Bold</b>");
  });

  it("shows All Day label for all-day events", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ allDay: true, start: "2026-04-15" })];
    renderDayView(container, place(events), "UTC", targetDate, {});
    assert.strictEqual(
      container.querySelector(".already-day-event-time").textContent,
      "All Day",
    );
  });

  it("shows the time range for a same-day timed event", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        start: "2026-04-15T10:00:00Z",
        end: "2026-04-15T12:00:00Z",
      }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    assert.strictEqual(
      container.querySelector(".already-day-event-time").textContent,
      "10:00 AM – 12:00 PM",
    );
  });

  it("shows only the start time for a multi-day timed event (no numeric date)", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        start: "2026-04-15T10:00:00Z",
        end: "2026-04-16T12:00:00Z",
      }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    assert.strictEqual(
      container.querySelector(".already-day-event-time").textContent,
      "10:00 AM",
    );
  });

  it("renders navigation buttons", () => {
    const container = document.createElement("div");
    renderDayView(container, place([]), "UTC", targetDate, {});
    assert.ok(container.querySelector(".already-day-prev"));
    assert.ok(container.querySelector(".already-day-next"));
    assert.ok(container.querySelector(".already-day-title"));
  });

  it("adds --featured class", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ start: "2026-04-15T10:00:00Z", featured: true }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    assert.ok(container.querySelector(".already-day-event--featured"));
  });

  it("sorts featured events first", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        id: "1",
        title: "Normal",
        start: "2026-04-15T10:00:00Z",
      }),
      createTestEvent({
        id: "2",
        title: "Star",
        start: "2026-04-15T14:00:00Z",
        featured: true,
      }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    const titles = [
      ...container.querySelectorAll(".already-day-event-title"),
    ].map((t) => t.textContent);
    assert.strictEqual(titles[0], "Star");
  });

  it("navigates to detail on click", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "day-click", start: "2026-04-15T10:00:00Z" }),
    ];
    renderDayView(container, place(events), "UTC", targetDate, {});
    container.querySelector(".already-day-event__link").click();
    assert.strictEqual(window.location.hash, "#event/day-click");
  });
});
