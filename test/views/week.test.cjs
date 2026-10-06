// Week columns are keyed by the VIEWER's day (see eventDayKey), so the
// ambient TZ decides which column a timed event lands in. Pin it here — and pin
// it BEFORE anything else in this file, because the `new Date(2026, 3, 15)`
// literal in the describe body below is evaluated at load time, so a `before`
// hook would leave it anchored to whatever zone the runner started with.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

require("../setup-dom.cjs");
const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

after(() => {
  if (originalTZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTZ;
  }
});

let renderWeekView;
let place;

before(async () => {
  const mod = await import("../../src/views/week.js");
  renderWeekView = mod.renderWeekView;
  const { placeByDay } = await import("../../src/views/placement.js");
  const { eventDayKey } = await import("../../src/util/dates.js");
  place = (events) => placeByDay(events, eventDayKey);
});

beforeEach(() => {
  window.location.hash = "";
});

describe("renderWeekView", () => {
  const wednesday = new Date(2026, 3, 15); // April 15, 2026 (Wednesday)

  it("renders 7 day columns", () => {
    const container = document.createElement("div");
    renderWeekView(container, place([]), "UTC", wednesday, {});
    assert.strictEqual(
      container.querySelectorAll(".already-week-col").length,
      7,
    );
  });

  it("renders navigation with date range", () => {
    const container = document.createElement("div");
    renderWeekView(container, place([]), "UTC", wednesday, {});
    assert.ok(container.querySelector(".already-week-prev"));
    assert.ok(container.querySelector(".already-week-next"));
    assert.ok(container.querySelector(".already-week-title"));
  });

  it("renders column headers with day name and number", () => {
    const container = document.createElement("div");
    renderWeekView(container, place([]), "UTC", wednesday, {});
    const headers = container.querySelectorAll(".already-week-col-header");
    assert.strictEqual(headers.length, 7);
    assert.ok(headers[0].querySelector(".already-week-dayname"));
    assert.ok(headers[0].querySelector(".already-week-daynum"));
  });

  it("renders event blocks in correct column", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ title: "Wed Event", start: "2026-04-15T10:00:00Z" }),
    ];
    renderWeekView(container, place(events), "UTC", wednesday, {});
    const blocks = container.querySelectorAll(".already-week-event");
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].textContent, "Wed Event");
  });

  it("navigates to detail on event click", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "week-click", start: "2026-04-15T10:00:00Z" }),
    ];
    renderWeekView(container, place(events), "UTC", wednesday, {});
    container.querySelector(".already-week-event").click();
    assert.strictEqual(window.location.hash, "#event/week-click");
  });

  it("adds --featured class to featured events", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ start: "2026-04-15T10:00:00Z", featured: true }),
    ];
    renderWeekView(container, place(events), "UTC", wednesday, {});
    assert.ok(container.querySelector(".already-week-event--featured"));
  });

  // Week starts Sunday Apr 12, 2026 → column 3 is Wed Apr 15, column 4 Thu Apr 16.
  it("places a timed event in the VIEWER's column, not the calendar's", () => {
    // 02:00 UTC Apr 16 is 21:00 CDT Apr 15; the merged-calendar zone is UTC.
    const container = document.createElement("div");
    const events = [
      createTestEvent({ title: "Late Show", start: "2026-04-16T02:00:00Z" }),
    ];
    renderWeekView(container, place(events), "UTC", wednesday, {});
    const cols = container.querySelectorAll(".already-week-col");
    assert.strictEqual(
      cols[3].querySelector(".already-week-event")?.textContent,
      "Late Show",
      "expected the block in the Wed Apr 15 column (viewer-local day)",
    );
    assert.strictEqual(
      cols[4].querySelector(".already-week-event"),
      null,
      "Thu Apr 16 column must be empty",
    );
  });

  it("keeps all-day events on their entered date (absolute placement)", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        title: "Street Fair",
        start: "2026-04-16",
        end: "2026-04-17",
        allDay: true,
      }),
    ];
    renderWeekView(container, place(events), "UTC", wednesday, {});
    const cols = container.querySelectorAll(".already-week-col");
    assert.strictEqual(
      cols[4].querySelector(".already-week-event")?.textContent,
      "Street Fair",
      "all-day event must stay in the Apr 16 column",
    );
  });

  it("sorts featured first within a day column", () => {
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
    renderWeekView(container, place(events), "UTC", wednesday, {});
    const blocks = [...container.querySelectorAll(".already-week-event")];
    assert.strictEqual(blocks[0].textContent, "Star");
    assert.strictEqual(blocks[1].textContent, "Normal");
  });
});
