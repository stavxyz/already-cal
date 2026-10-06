// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

require("../setup-dom.cjs");
const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderMonthView, renderWeekView, renderDayView, placeByDay, eventDayKey;
let renderGridView, renderDetailView, sortFeaturedByDate, createTagFilter;
let composeEvents;

before(async () => {
  ({ renderMonthView } = await import("../../src/views/month.js"));
  ({ renderWeekView } = await import("../../src/views/week.js"));
  ({ renderDayView } = await import("../../src/views/day.js"));
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderDetailView } = await import("../../src/views/detail.js"));
  ({ sortFeaturedByDate } = await import("../../src/views/helpers.js"));
  ({ placeByDay } = await import("../../src/views/placement.js"));
  ({ eventDayKey } = await import("../../src/util/dates.js"));
  ({ createTagFilter } = await import("../../src/ui/tag-filter.js"));
  ({ composeEvents } = await import("../../src/composite.js"));
});

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

beforeEach(() => {
  window.location.hash = "";
});

const config = { locale: "en-US", i18n: {} };
const place = (events) => placeByDay(events, eventDayKey);
const texts = (root, selector) =>
  [...root.querySelectorAll(selector)].map((el) => el.textContent);

// Chicago time. The class runs Friday June 19 6 PM to Saturday June 20 9 PM.
// One part is on Friday evening, one on Saturday evening.
const cocktailClass = () =>
  createComposite(
    {
      title: "Cocktail Class",
      start: "2026-06-19T23:00:00Z",
      end: "2026-06-21T02:00:00Z",
    },
    [
      {
        title: "Negroni Hour",
        start: "2026-06-20T00:00:00Z",
        end: "2026-06-20T01:00:00Z",
      },
      {
        title: "Pairing Dinner",
        start: "2026-06-21T00:00:00Z",
        end: "2026-06-21T02:00:00Z",
      },
    ],
  );
const friday = new Date(2026, 5, 19);
const saturday = new Date(2026, 5, 20);
const june = new Date(2026, 5, 1);

describe("month view with a composite", () => {
  it("shows the parent's chip, folds its same-day part, and shows the other-day part on its own day", () => {
    const c = document.createElement("div");
    renderMonthView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      june,
      config,
    );
    assert.deepStrictEqual(texts(c, ".already-month-chip"), [
      "Cocktail Class",
      "Pairing Dinner",
    ]);
  });

  it("keeps its chips after moving to the next month and back", () => {
    const c = document.createElement("div");
    renderMonthView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      june,
      config,
    );
    c.querySelector(".already-month-next").click();
    assert.deepStrictEqual(texts(c, ".already-month-chip"), []);
    c.querySelector(".already-month-prev").click();
    assert.deepStrictEqual(texts(c, ".already-month-chip"), [
      "Cocktail Class",
      "Pairing Dinner",
    ]);
  });

  it("opens the composite's detail from an other-day part's chip by the part's id", () => {
    const c = document.createElement("div");
    renderMonthView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      june,
      config,
    );
    c.querySelectorAll(".already-month-chip")[1].click();
    assert.strictEqual(window.location.hash, "#event/part-2");
  });
});

describe("week view with a composite", () => {
  it("shows one block for the parent and one for the other-day part", () => {
    const c = document.createElement("div");
    renderWeekView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      friday,
      config,
    );
    assert.deepStrictEqual(texts(c, ".already-week-event"), [
      "Cocktail Class",
      "Pairing Dinner",
    ]);
  });

  it("keeps its blocks after moving to the next week and back", () => {
    const c = document.createElement("div");
    renderWeekView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      friday,
      config,
    );
    c.querySelector(".already-week-next").click();
    c.querySelector(".already-week-prev").click();
    assert.strictEqual(c.querySelectorAll(".already-week-event").length, 2);
  });
});

describe("day view with a composite", () => {
  it("follows the parent's row with an indented row for its same-day part", () => {
    const c = document.createElement("div");
    renderDayView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      friday,
      config,
    );
    assert.deepStrictEqual(texts(c, ".already-day-event-title"), [
      "Cocktail Class",
      "Negroni Hour",
    ]);
    const rows = c.querySelectorAll(".already-day-event");
    assert.ok(!rows[0].classList.contains("already-day-event--part"));
    assert.ok(rows[1].classList.contains("already-day-event--part"));
  });

  it("shows the other-day part as an ordinary row on its own day", () => {
    const c = document.createElement("div");
    renderDayView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      saturday,
      config,
    );
    assert.deepStrictEqual(texts(c, ".already-day-event-title"), [
      "Pairing Dinner",
    ]);
    assert.strictEqual(c.querySelector(".already-day-event--part"), null);
  });

  it("opens the composite's detail from a part's row by the part's id", () => {
    const c = document.createElement("div");
    renderDayView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      friday,
      config,
    );
    c.querySelector(
      ".already-day-event--part .already-day-event__link",
    ).click();
    assert.strictEqual(window.location.hash, "#event/part-1");
  });

  it("keeps the part's row after moving to the next day and back", () => {
    const c = document.createElement("div");
    renderDayView(
      c,
      place([cocktailClass()]),
      "America/Chicago",
      friday,
      config,
    );
    c.querySelector(".already-day-next").click();
    assert.deepStrictEqual(texts(c, ".already-day-event-title"), [
      "Pairing Dinner",
    ]);
    c.querySelector(".already-day-prev").click();
    assert.strictEqual(
      c.querySelectorAll(".already-day-event--part").length,
      1,
    );
  });

  it("shows a part's row once when another calendar has an event with the parent's id", () => {
    const c = document.createElement("div");
    const composed = createComposite(
      {
        title: "Cocktail Class",
        start: "2026-06-19T23:00:00Z",
        end: "2026-06-21T02:00:00Z",
      },
      [
        {
          title: "Negroni Hour",
          start: "2026-06-20T00:00:00Z",
          end: "2026-06-20T01:00:00Z",
        },
      ],
    );
    const copy = createTestEvent({
      id: composed.id,
      title: composed.title,
      start: composed.start,
      end: composed.end,
    });
    renderDayView(
      c,
      place([composed, copy]),
      "America/Chicago",
      friday,
      config,
    );
    assert.deepStrictEqual(texts(c, ".already-day-event-title"), [
      "Cocktail Class",
      "Negroni Hour",
      "Cocktail Class",
    ]);
    assert.strictEqual(
      c.querySelectorAll(".already-day-event--part").length,
      1,
    );
  });

  it("does not throw on an event with a malformed start", () => {
    const c = document.createElement("div");
    const bad = createTestEvent({ id: "bad", title: "Bad", start: "nope" });
    renderDayView(c, place([bad]), "America/Chicago", friday, config);
    assert.strictEqual(c.querySelectorAll(".already-day-event").length, 0);
  });
});

describe("one day key everywhere", () => {
  // Friday evening in Chicago, with one part that evening and one at 12:30 AM
  // on Saturday. Every consumer of the day key must put the late part on
  // Saturday, or a part could be folded under a parent that a view files on
  // a different day.
  const lateNight = () =>
    createComposite(
      {
        title: "Cocktail Class",
        start: "2026-06-19T23:00:00Z",
        end: "2026-06-21T02:00:00Z",
      },
      [
        {
          title: "Negroni Hour",
          start: "2026-06-20T00:00:00Z",
          end: "2026-06-20T01:00:00Z",
        },
        {
          title: "Nightcap",
          start: "2026-06-20T05:30:00Z",
          end: "2026-06-20T06:00:00Z",
          featured: true,
        },
      ],
    );

  it("puts a part that starts just after local midnight on the next day", () => {
    const parent = lateNight();
    const placement = place([parent]);

    // Placement: filed under Saturday on its own, not folded under the parent.
    const idsOn = (day) => placement.byDay.get(day).map((e) => e.id);
    assert.deepStrictEqual(idsOn("2026-06-19"), ["parent"]);
    assert.deepStrictEqual(idsOn("2026-06-20"), ["part-2"]);
    assert.deepStrictEqual(
      placement.sameDayParts.get(parent).map((e) => e.id),
      ["part-1"],
    );

    // Month: the chip sits in Saturday's cell.
    const month = document.createElement("div");
    renderMonthView(month, placement, "America/Chicago", june, config);
    const cellOf = (title) =>
      [...month.querySelectorAll(".already-month-chip")]
        .find((el) => el.textContent === title)
        .closest(".already-month-cell")
        .querySelector(".already-month-day").textContent;
    assert.strictEqual(cellOf("Cocktail Class"), "19");
    assert.strictEqual(cellOf("Nightcap"), "20");

    // Week: Saturday's column.
    const week = document.createElement("div");
    renderWeekView(week, placement, "America/Chicago", friday, config);
    const columnOf = (title) =>
      [...week.querySelectorAll(".already-week-event")]
        .find((el) => el.textContent === title)
        .closest(".already-week-col")
        .querySelector(".already-week-daynum").textContent;
    assert.strictEqual(columnOf("Cocktail Class"), "19");
    assert.strictEqual(columnOf("Nightcap"), "20");

    // Day: a row on Saturday, and no folded row for it on Friday.
    const day = document.createElement("div");
    renderDayView(day, placement, "America/Chicago", saturday, config);
    assert.deepStrictEqual(texts(day, ".already-day-event-title"), [
      "Nightcap",
    ]);
    renderDayView(day, placement, "America/Chicago", friday, config);
    assert.deepStrictEqual(texts(day, ".already-day-event-title"), [
      "Cocktail Class",
      "Negroni Hour",
    ]);

    // Date groups: featured sorts first within one day only. The featured
    // part is on another day, so it stays behind the parent.
    assert.deepStrictEqual(
      sortFeaturedByDate([parent, parent.parts[1]]).map((e) => e.id),
      ["parent", "part-2"],
    );

    // Card: the late part's line carries its date.
    const grid = document.createElement("div");
    renderGridView(grid, [parent], "America/Chicago", config);
    assert.deepStrictEqual(texts(grid, ".already-card__part"), [
      "7:00 PM Negroni Hour",
      "Jun 20, 12:30 AM Nightcap",
    ]);

    // Detail: one heading per day.
    const detail = document.createElement("div");
    renderDetailView(detail, parent, "America/Chicago", () => {}, config);
    assert.deepStrictEqual(texts(detail, ".already-detail-parts-day"), [
      "Friday, June 19, 2026",
      "Saturday, June 20, 2026",
    ]);
  });

  it("keeps an all-day part behind an evening part of the day before", () => {
    // A three-day all-day parent in a Chicago calendar. "Late Set" is at
    // 11:30 PM on the 9th in Chicago, and its UTC instant falls after UTC
    // midnight of the 10th. Parts ordered by UTC midnight would list the
    // all-day 10th first and print the day headings backwards.
    const { events } = composeEvents(
      [
        createTestEvent({
          id: "fest",
          title: "Fest",
          composite: true,
          allDay: true,
          start: "2099-07-09",
          end: "2099-07-12",
        }),
        createTestEvent({
          id: "parade",
          title: "Parade",
          allDay: true,
          start: "2099-07-10",
          end: "2099-07-11",
        }),
        createTestEvent({
          id: "late",
          title: "Late Set",
          start: "2099-07-10T04:30:00Z",
          end: "2099-07-10T05:00:00Z",
        }),
      ],
      { timeZone: "America/Chicago" },
    );
    assert.deepStrictEqual(
      events[0].parts.map((p) => p.id),
      ["late", "parade"],
    );

    const detail = document.createElement("div");
    renderDetailView(detail, events[0], "America/Chicago", () => {}, config);
    assert.deepStrictEqual(texts(detail, ".already-detail-parts-day"), [
      "Thursday, July 9, 2099",
      "Friday, July 10, 2099",
    ]);
  });
});

describe("tag filter with a composite", () => {
  const tag = (value) => ({ key: "tag", value });
  const tagged = () =>
    createComposite({ tags: [tag("food")] }, [{ tags: [tag("music")] }]);

  it("offers a pill for a part's tag", () => {
    const filter = createTagFilter(() => {}, config);
    const container = document.createElement("div");
    filter.render(container, [tagged()]);
    assert.deepStrictEqual(texts(container, ".already-tag-pill"), [
      "food",
      "music",
    ]);
  });

  it("counts a tag carried by both the parent and a part once", () => {
    const filter = createTagFilter(() => {}, config);
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "dinner", tags: [tag("food")] }),
      createComposite({ tags: [tag("music")] }, [{ tags: [tag("music")] }]),
    ];
    filter.render(container, events);
    assert.deepStrictEqual(texts(container, ".already-tag-pill"), [
      "food",
      "music",
    ]);
  });

  it("keeps the composite when a part's tag is selected", () => {
    const filter = createTagFilter(() => {}, config);
    const container = document.createElement("div");
    const events = [tagged(), createTestEvent({ id: "other" })];
    filter.render(container, events);
    [...container.querySelectorAll(".already-tag-pill")]
      .find((el) => el.textContent === "music")
      .click();
    assert.deepStrictEqual(
      events.filter(filter.getFilter()).map((e) => e.id),
      ["parent"],
    );
  });
});
