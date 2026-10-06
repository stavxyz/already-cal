// Pin the zone before the Date literals below are evaluated at load time.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

require("../setup-dom.cjs");
const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

let renderMonthView, renderWeekView;
let place;
before(async () => {
  ({ renderMonthView } = await import("../../src/views/month.js"));
  ({ renderWeekView } = await import("../../src/views/week.js"));
  const { placeByDay } = await import("../../src/views/placement.js");
  const { eventDayKey } = await import("../../src/util/dates.js");
  place = (events) => placeByDay(events, eventDayKey);
});

let container;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  window.location.hash = "";
});

const APRIL = new Date(2026, 3, 1);

describe("month view: clicking a day cell", () => {
  it("navigates to that day, using the local calendar date", () => {
    renderMonthView(container, place([]), "America/Chicago", APRIL, {});
    const cells = container.querySelectorAll(
      ".already-month-cell:not(.already-month-cell--empty)",
    );
    cells[3].click(); // 4th real day = April 4
    assert.equal(window.location.hash, "#day/2026-04-04");
  });

  it("navigates for a day with no events", () => {
    renderMonthView(container, place([]), "America/Chicago", APRIL, {});
    const cells = container.querySelectorAll(
      ".already-month-cell:not(.already-month-cell--empty)",
    );
    cells[0].click();
    assert.equal(window.location.hash, "#day/2026-04-01");
  });

  it("does NOT navigate from a padding cell", () => {
    renderMonthView(container, place([]), "America/Chicago", APRIL, {});
    const empty = container.querySelector(".already-month-cell--empty");
    assert.ok(
      empty,
      "April 2026 starts on a Wednesday, so padding cells exist",
    );
    empty.click();
    assert.equal(window.location.hash, "");
  });

  it("does not advertise itself to assistive tech as a button", () => {
    // Deliberate: this is a pointer-only affordance, so it must not claim to
    // be keyboard-operable when it is not.
    renderMonthView(container, place([]), "America/Chicago", APRIL, {});
    const cell = container.querySelector(
      ".already-month-cell:not(.already-month-cell--empty)",
    );
    assert.equal(cell.getAttribute("role"), "gridcell");
    assert.equal(cell.getAttribute("tabindex"), null);
  });

  it("clicking an event chip opens the event, not the day", () => {
    const events = [createTestEvent({ start: "2026-04-04T15:00:00Z" })];
    renderMonthView(container, place(events), "America/Chicago", APRIL, {});
    const chip = container.querySelector(".already-month-chip");
    chip.click();
    assert.match(window.location.hash, /^#event\//);
  });
});

describe("week view: clicking a day column", () => {
  it("navigates to that day", () => {
    renderWeekView(
      container,
      place([]),
      "America/Chicago",
      new Date(2026, 3, 8),
      {},
    );
    const col = container.querySelector(".already-week-col");
    col.click();
    assert.match(window.location.hash, /^#day\/2026-04-\d{2}$/);
  });

  it("clicking an event block opens the event, not the day", () => {
    const events = [createTestEvent({ start: "2026-04-08T15:00:00Z" })];
    renderWeekView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 8),
      {},
    );
    const block = container.querySelector(".already-week-event");
    block.click();
    assert.match(window.location.hash, /^#event\//);
  });
});

// M8: renderView's `case "day"` has no guard, so navigating there from a
// calendar configured without it drops the viewer into a view their own
// selector does not list.
describe("day navigation respects config.views", () => {
  it("month does not navigate when day is not an enabled view", () => {
    renderMonthView(container, place([]), "America/Chicago", APRIL, {
      views: ["month", "grid"],
    });
    const cell = container.querySelector(
      ".already-month-cell:not(.already-month-cell--empty)",
    );
    cell.click();
    assert.equal(window.location.hash, "");
  });

  it("week does not navigate when day is not an enabled view", () => {
    renderWeekView(
      container,
      place([]),
      "America/Chicago",
      new Date(2026, 3, 8),
      {
        views: ["week", "list"],
      },
    );
    container.querySelector(".already-week-col").click();
    assert.equal(window.location.hash, "");
  });

  it("navigates when views is unset", () => {
    renderMonthView(container, place([]), "America/Chicago", APRIL, {});
    container
      .querySelector(".already-month-cell:not(.already-month-cell--empty)")
      .click();
    assert.match(window.location.hash, /^#day\//);
  });
});

// H2: clicks on an event must still reach the root, where already-cal.js binds
// the listener that posts the cross-origin engagement signal. stopPropagation
// on the chip killed that; the cell handler now bails by target instead.
describe("event clicks still bubble to the root", () => {
  it("month chip click reaches an ancestor listener without navigating to the day", () => {
    const events = [createTestEvent({ start: "2026-04-04T15:00:00Z" })];
    renderMonthView(container, place(events), "America/Chicago", APRIL, {});
    let reachedRoot = 0;
    container.addEventListener("click", () => reachedRoot++);
    container.querySelector(".already-month-chip").click();
    assert.equal(reachedRoot, 1, "click bubbled past the chip");
    assert.match(window.location.hash, /^#event\//, "went to the event");
  });

  it("week block click reaches an ancestor listener without navigating to the day", () => {
    const events = [createTestEvent({ start: "2026-04-08T15:00:00Z" })];
    renderWeekView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 8),
      {},
    );
    let reachedRoot = 0;
    container.addEventListener("click", () => reachedRoot++);
    container.querySelector(".already-week-event").click();
    assert.equal(reachedRoot, 1, "click bubbled past the block");
    assert.match(window.location.hash, /^#event\//, "went to the event");
  });
});
