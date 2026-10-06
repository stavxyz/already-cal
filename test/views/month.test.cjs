// Month cells are keyed by the VIEWER's day (see eventDayKey), so the
// ambient TZ decides which cell a timed event lands in. Pin it here — and pin
// it BEFORE anything else in this file, because the `new Date(2026, 3, 1)`
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

let renderMonthView;
let place;

before(async () => {
  const mod = await import("../../src/views/month.js");
  renderMonthView = mod.renderMonthView;
  const { placeByDay } = await import("../../src/views/placement.js");
  const { eventDayKey } = await import("../../src/util/dates.js");
  place = (events) => placeByDay(events, eventDayKey);
});

beforeEach(() => {
  window.location.hash = "";
});

describe("renderMonthView", () => {
  const april2026 = new Date(2026, 3, 1);

  it("renders month grid with day headers", () => {
    const container = document.createElement("div");
    renderMonthView(container, place([]), "UTC", april2026, {});
    assert.ok(container.querySelector(".already-month"));
    assert.strictEqual(
      container.querySelectorAll(".already-month-dayname").length,
      7,
    );
  });

  it("renders correct number of day cells for April 2026", () => {
    const container = document.createElement("div");
    renderMonthView(container, place([]), "UTC", april2026, {});
    const cells = container.querySelectorAll(
      ".already-month-cell:not(.already-month-cell--empty)",
    );
    assert.strictEqual(cells.length, 30);
  });

  it("renders navigation with month name", () => {
    const container = document.createElement("div");
    renderMonthView(container, place([]), "UTC", april2026, {});
    const title = container.querySelector(".already-month-title");
    // Asserted as the WHOLE string, not with includes(). The previous
    // substring assertions passed against "April 2026 2026", which shipped
    // for five months: getMonthName already formats the year, and the caller
    // appended it a second time.
    assert.strictEqual(title.textContent, "April 2026");
  });

  it("does not repeat the year in the month title", () => {
    const container = document.createElement("div");
    renderMonthView(container, place([]), "UTC", april2026, {});
    const title = container.querySelector(".already-month-title");
    const years = title.textContent.match(/2026/g) || [];
    assert.strictEqual(
      years.length,
      1,
      `year repeated in "${title.textContent}"`,
    );
  });

  it("renders event chips in correct day cells", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ title: "My Event", start: "2026-04-15T10:00:00Z" }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    const chips = container.querySelectorAll(".already-month-chip");
    assert.strictEqual(chips.length, 1);
    assert.strictEqual(chips[0].textContent, "My Event");
  });

  it("navigates to detail on chip click", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "month-click", start: "2026-04-15T10:00:00Z" }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    container.querySelector(".already-month-chip").click();
    assert.strictEqual(window.location.hash, "#event/month-click");
  });

  it("renders a chip as a link with no role", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "m-link", start: "2026-04-15T10:00:00Z" }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    const chip = container.querySelector(".already-month-chip");
    assert.strictEqual(chip.tagName, "A");
    assert.strictEqual(chip.getAttribute("href"), "#event/m-link");
    assert.strictEqual(chip.getAttribute("role"), null);
    assert.strictEqual(chip.getAttribute("tabindex"), null);
  });

  it("renders an entry with no route as a plain chip", () => {
    const container = document.createElement("div");
    const orphan = {
      ...createTestEvent({ start: "2026-04-15T10:00:00Z" }),
      id: undefined,
    };
    renderMonthView(container, place([orphan]), "UTC", april2026, {});
    const chip = container.querySelector(".already-month-chip");
    assert.strictEqual(chip.tagName, "DIV");
    chip.click();
    assert.strictEqual(window.location.hash, "");
  });

  it("adds --featured class to featured event chips", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ start: "2026-04-15T10:00:00Z", featured: true }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    assert.ok(container.querySelector(".already-month-chip--featured"));
  });

  it("sorts featured events first within a day cell", () => {
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
    renderMonthView(container, place(events), "UTC", april2026, {});
    const chips = [...container.querySelectorAll(".already-month-chip")];
    assert.strictEqual(chips[0].textContent, "Star");
    assert.strictEqual(chips[1].textContent, "Normal");
  });

  // Non-empty cells are appended one per day in order, so cells[d - 1] is day d.
  const dayCells = (container) =>
    container.querySelectorAll(
      ".already-month-cell:not(.already-month-cell--empty)",
    );

  it("places a timed event in the VIEWER's day cell, not the calendar's", () => {
    // 02:00 UTC Apr 16 is 21:00 CDT Apr 15. The merged-calendar zone passed in
    // is UTC, but the chip's sibling surfaces label this event "9:00 PM" in the
    // viewer's zone — so it must file under Apr 15, not Apr 16.
    const container = document.createElement("div");
    const events = [
      createTestEvent({ title: "Late Show", start: "2026-04-16T02:00:00Z" }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    const cells = dayCells(container);
    assert.strictEqual(
      cells[14].querySelector(".already-month-chip")?.textContent,
      "Late Show",
      "expected the chip in the Apr 15 cell (viewer-local day)",
    );
    assert.strictEqual(
      cells[15].querySelector(".already-month-chip"),
      null,
      "Apr 16 cell must be empty",
    );
  });

  it("keeps all-day events on their entered date (absolute placement)", () => {
    // Date-only values route through zoneFor → UTC, so the viewer's zone must
    // NOT drag them back a day in a negative-offset zone.
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        title: "Street Fair",
        start: "2026-04-16",
        end: "2026-04-17",
        allDay: true,
      }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    const cells = dayCells(container);
    assert.strictEqual(
      cells[15].querySelector(".already-month-chip")?.textContent,
      "Street Fair",
      "all-day event must stay on Apr 16",
    );
  });

  it("shows +N more when exceeding maxEventsPerDay", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "1", start: "2026-04-15T08:00:00Z" }),
      createTestEvent({ id: "2", start: "2026-04-15T10:00:00Z" }),
      createTestEvent({ id: "3", start: "2026-04-15T12:00:00Z" }),
      createTestEvent({ id: "4", start: "2026-04-15T14:00:00Z" }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {
      maxEventsPerDay: 3,
    });
    assert.ok(container.querySelector(".already-month-more"));
    assert.ok(
      container.querySelector(".already-month-more").textContent.includes("1"),
    );
  });
});
