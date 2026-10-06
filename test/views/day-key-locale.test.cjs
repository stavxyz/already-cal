// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

require("../setup-dom.cjs");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderMonthView, renderWeekView, renderDayView, renderGridView;

before(async () => {
  ({ renderMonthView } = await import("../../src/views/month.js"));
  ({ renderWeekView } = await import("../../src/views/week.js"));
  ({ renderDayView } = await import("../../src/views/day.js"));
  ({ renderGridView } = await import("../../src/views/grid.js"));
});

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

// Locales whose formatted date parts are not the Gregorian numbers a Date
// reports. Arabic writes its digits in another script, and Thai counts years
// in the Buddhist calendar. Which day an event is on must not depend on how
// the display locale writes it.
const LOCALES = ["ar-EG", "th-TH"];

// Wednesday April 15 2026, 2 PM in Chicago.
const market = () =>
  createTestEvent({
    id: "market",
    title: "Market",
    start: "2026-04-15T19:00:00Z",
    end: "2026-04-15T20:00:00Z",
  });
const april = new Date(2026, 3, 1);
const april15 = new Date(2026, 3, 15);

for (const locale of LOCALES) {
  describe(`event days under ${locale}`, () => {
    const config = { locale, i18n: {} };

    it("month view files the event in its day's cell", () => {
      const c = document.createElement("div");
      renderMonthView(c, [market()], "America/Chicago", april, config);
      const chips = c.querySelectorAll(".already-month-chip");
      assert.strictEqual(chips.length, 1);
      assert.strictEqual(
        chips[0]
          .closest(".already-month-cell")
          .querySelector(".already-month-day").textContent,
        "15",
      );
    });

    it("week view files the event in its day's column", () => {
      const c = document.createElement("div");
      renderWeekView(c, [market()], "America/Chicago", april15, config);
      const blocks = c.querySelectorAll(".already-week-event");
      assert.strictEqual(blocks.length, 1);
      assert.strictEqual(
        blocks[0]
          .closest(".already-week-col")
          .querySelector(".already-week-daynum").textContent,
        "15",
      );
    });

    it("day view shows the event on its day", () => {
      const c = document.createElement("div");
      renderDayView(c, [market()], "America/Chicago", april15, config);
      assert.strictEqual(c.querySelectorAll(".already-day-event").length, 1);
    });

    it("grid view sorts a featured event first within its own day only", () => {
      const c = document.createElement("div");
      const featuredNextDay = createTestEvent({
        id: "gala",
        title: "Gala",
        featured: true,
        start: "2026-04-16T19:00:00Z",
        end: "2026-04-16T20:00:00Z",
      });
      renderGridView(c, [market(), featuredNextDay], "America/Chicago", config);
      assert.deepStrictEqual(
        [...c.querySelectorAll(".already-card__title")].map(
          (el) => el.textContent,
        ),
        ["Market", "Gala"],
      );
    });

    it("the badge layout prints the event's day number", () => {
      const c = document.createElement("div");
      renderGridView(c, [market()], "America/Chicago", {
        ...config,
        _theme: {
          layout: "badge",
          orientation: "vertical",
          imagePosition: "left",
        },
      });
      assert.strictEqual(
        c.querySelector(".already-card__badge-day").textContent,
        "15",
      );
    });
  });
}
