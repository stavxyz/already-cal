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

let renderMonthView, renderWeekView, openEventPopover, closeEventPopover;
let place;
before(async () => {
  ({ renderMonthView } = await import("../../src/views/month.js"));
  ({ renderWeekView } = await import("../../src/views/week.js"));
  ({ openEventPopover, closeEventPopover } = await import(
    "../../src/ui/event-popover.js"
  ));
  const { placeByDay } = await import("../../src/views/placement.js");
  const { eventDayKey } = await import("../../src/util/dates.js");
  place = (events) => placeByDay(events, eventDayKey);
});

let root, container;
const find = () => root.querySelector(".already-event-popover");

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  root.className = "already";
  container = document.createElement("div");
  root.appendChild(container);
  document.body.appendChild(root);
  window.location.hash = "";
  closeEventPopover();
});

// The stuck-popover case mouseleave cannot catch: the chip under the pointer
// is destroyed by a re-render, so no further pointer event ever fires on it.
// The month and week nav buttons re-render DIRECTLY rather than going through
// already-cal.js's renderView, so the guard has to live in the view too.
describe("re-rendering closes an open popover", () => {
  it("month: clicking next month closes an open popover", () => {
    const events = [createTestEvent({ start: "2026-04-04T15:00:00Z" })];
    renderMonthView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 1),
      {},
    );
    const chip = container.querySelector(".already-month-chip");
    openEventPopover(chip, events[0], root, {});
    assert.ok(find(), "popover is open");

    container.querySelector(".already-month-next").click();
    assert.equal(find(), null, "popover closed by the re-render");
  });

  it("month: clicking previous month closes an open popover", () => {
    const events = [createTestEvent({ start: "2026-04-04T15:00:00Z" })];
    renderMonthView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 1),
      {},
    );
    const chip = container.querySelector(".already-month-chip");
    openEventPopover(chip, events[0], root, {});
    container.querySelector(".already-month-prev").click();
    assert.equal(find(), null);
  });

  it("week: navigating closes an open popover", () => {
    const events = [createTestEvent({ start: "2026-04-08T15:00:00Z" })];
    renderWeekView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 8),
      {},
    );
    const block = container.querySelector(".already-week-event");
    openEventPopover(block, events[0], root, {});
    assert.ok(find(), "popover is open");
    container.querySelector(".already-week-next").click();
    assert.equal(find(), null);
  });

  it("re-rendering the same month closes an open popover", () => {
    const events = [createTestEvent({ start: "2026-04-04T15:00:00Z" })];
    renderMonthView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 1),
      {},
    );
    const chip = container.querySelector(".already-month-chip");
    openEventPopover(chip, events[0], root, {});
    renderMonthView(
      container,
      place(events),
      "America/Chicago",
      new Date(2026, 3, 1),
      {},
    );
    assert.equal(find(), null);
  });
});
