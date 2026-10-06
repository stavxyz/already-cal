// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "UTC";

require("../setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const axe = require("axe-core");
const { createTestEvent, createComposite } = require("../helpers.cjs");

// axe reads these from the global scope; setup-dom exposes the rest.
globalThis.Element = window.Element;
globalThis.NodeList = window.NodeList;

let renderGridView,
  renderListView,
  renderMonthView,
  renderWeekView,
  renderDayView;
let renderDetailView,
  openEventPopover,
  closeEventPopover,
  placeByDay,
  eventDayKey;
before(async () => {
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderListView } = await import("../../src/views/list.js"));
  ({ renderMonthView } = await import("../../src/views/month.js"));
  ({ renderWeekView } = await import("../../src/views/week.js"));
  ({ renderDayView } = await import("../../src/views/day.js"));
  ({ renderDetailView } = await import("../../src/views/detail.js"));
  ({ openEventPopover, closeEventPopover } = await import(
    "../../src/ui/event-popover.js"
  ));
  ({ placeByDay } = await import("../../src/views/placement.js"));
  ({ eventDayKey } = await import("../../src/util/dates.js"));
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
afterEach(() => {
  closeEventPopover();
  document.body.innerHTML = "";
  window.location.hash = "";
});

// The rules that catch what this suite is for: a control inside a control,
// and controls or links with no name. Layout-dependent rules (region,
// colour contrast) need a rendering engine jsdom does not have.
const RULES = [
  "nested-interactive",
  "button-name",
  "link-name",
  "aria-allowed-attr",
  "aria-roles",
  "aria-valid-attr-value",
  "duplicate-id-active",
];

// `present` is a selector the view must have rendered. axe finds nothing
// wrong with an empty container, so without it a view that rendered nothing
// (a wrong date, a zone slip) would pass.
async function expectClean(container, label, present) {
  assert.ok(
    container.querySelector(present),
    `${label}: nothing matches ${present}, so there is nothing to check`,
  );
  const result = await axe.run(container, {
    runOnly: { type: "rule", values: RULES },
  });
  const report = result.violations
    .map(
      (v) =>
        `${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  ${n.target.join(" ")} ${n.html}`).join("\n"),
    )
    .join("\n");
  assert.strictEqual(result.violations.length, 0, `${label}\n${report}`);
}

const NAMES = ["clean", "compact", "badge", "hero"];
const cfg = (layout, over = {}) => ({
  locale: "en-US",
  i18n: {},
  onRsvp: async () => ({ partySize: 1 }),
  _theme: { layout, orientation: "vertical", imagePosition: "left" },
  ...over,
});
const burgerNight = ({ bothRsvp = false } = {}) =>
  createComposite(
    {
      id: "night",
      title: "Burger Night",
      start: "2099-06-16T17:00:00Z",
      end: "2099-06-16T21:00:00Z",
    },
    [
      {
        id: "act-1",
        title: "First Set",
        start: "2099-06-16T18:00:00Z",
        end: "2099-06-16T19:00:00Z",
        rsvp: true,
      },
      {
        id: "act-2",
        title: "Second Set",
        start: "2099-06-16T19:30:00Z",
        end: "2099-06-16T20:30:00Z",
        rsvp: bothRsvp,
      },
    ],
  );
const events = () => [
  createTestEvent({
    id: "plain",
    title: "Autumn Market",
    start: "2099-06-15T15:00:00Z",
    end: "2099-06-15T17:00:00Z",
    htmlLink: "https://cal.example/plain",
  }),
  createTestEvent({
    id: "with-rsvp",
    title: "Supper Club",
    rsvp: true,
    start: "2099-06-15T19:00:00Z",
    end: "2099-06-15T21:00:00Z",
    htmlLink: "https://cal.example/supper",
  }),
  burgerNight(),
  createTestEvent({
    id: "blank",
    title: "   ",
    start: "2099-06-15T09:00:00Z",
    end: "2099-06-15T10:00:00Z",
  }),
];
const mount = () => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  return c;
};

describe("accessibility of event cards", () => {
  for (const name of NAMES) {
    it(`${name}: grid cards, with the RSVP form closed and open`, async () => {
      const c = mount();
      renderGridView(c, events(), "UTC", cfg(name));
      await expectClean(c, `${name} grid`, "a.already-card__link");
      c.querySelector(".already-rsvp__open").click();
      await expectClean(
        c,
        `${name} grid with the form open`,
        "form.already-rsvp",
      );
    });

    it(`${name}: list cards`, async () => {
      const c = mount();
      renderListView(c, events(), "UTC", cfg(name));
      await expectClean(c, `${name} list`, "a.already-card__link");
    });
  }

  it("the hover popover's card", async () => {
    const root = mount();
    root.className = "already";
    const anchor = document.createElement("div");
    root.appendChild(anchor);
    openEventPopover(anchor, events()[2], root, cfg("badge"), "month", "UTC");
    await expectClean(
      root,
      "popover",
      ".already-event-popover a.already-card__link",
    );
  });
});

describe("accessibility of the calendar views", () => {
  const placed = () => placeByDay(events(), eventDayKey);

  it("month view", async () => {
    const c = mount();
    renderMonthView(c, placed(), "UTC", new Date(2099, 5, 15), cfg("clean"));
    await expectClean(c, "month", "a.already-month-chip");
  });

  it("week view", async () => {
    const c = mount();
    renderWeekView(c, placed(), "UTC", new Date(2099, 5, 15), cfg("clean"));
    await expectClean(c, "week", "a.already-week-event");
  });

  it("day view with a composite's part rows", async () => {
    const c = mount();
    renderDayView(c, placed(), "UTC", new Date(2099, 5, 16), cfg("clean"));
    await expectClean(
      c,
      "day",
      ".already-day-event--part a.already-day-event__link",
    );
  });

  it("the detail view of a composite with RSVP on a part", async () => {
    const c = mount();
    renderDetailView(c, events()[2], "UTC", () => {}, cfg("clean"), {
      focusPartId: "act-1",
    });
    await expectClean(c, "detail", "button.already-rsvp__open");
  });

  it("names two RSVP buttons on one page after their own events", () => {
    // axe cannot see this: the visible text "RSVP" already satisfies
    // button-name, so two buttons that read the same would pass.
    const c = mount();
    renderDetailView(
      c,
      burgerNight({ bothRsvp: true }),
      "UTC",
      () => {},
      cfg("clean"),
      {},
    );
    assert.deepStrictEqual(
      [...c.querySelectorAll("button.already-rsvp__open")].map((b) =>
        b.getAttribute("aria-label"),
      ),
      ["RSVP for First Set", "RSVP for Second Set"],
    );
  });
});
