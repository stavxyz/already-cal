// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "UTC";

require("../setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderDayView, placeByDay, eventDayKey;
before(async () => {
  ({ renderDayView } = await import("../../src/views/day.js"));
  ({ placeByDay } = await import("../../src/views/placement.js"));
  ({ eventDayKey } = await import("../../src/util/dates.js"));
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
afterEach(() => {
  document.body.innerHTML = "";
  window.location.hash = "";
});

const day = new Date(2099, 5, 15);
const render = (events, config = {}) => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  renderDayView(c, placeByDay(events, eventDayKey), "UTC", day, config);
  return c;
};
const at = (hour, over = {}) =>
  createTestEvent({
    start: `2099-06-15T${hour}:00:00Z`,
    end: `2099-06-15T${hour}:30:00Z`,
    ...over,
  });

describe("a day row opens through its title link", () => {
  it("puts the link in the title, with no role on the row", () => {
    const c = render([at("10", { id: "d1", title: "Brunch" })]);
    const row = c.querySelector(".already-day-event");
    const link = row.querySelector(
      ".already-day-event-title > a.already-event-link.already-day-event__link",
    );
    assert.ok(link);
    assert.strictEqual(link.getAttribute("href"), "#event/d1");
    assert.strictEqual(link.textContent, "Brunch");
    assert.strictEqual(row.getAttribute("role"), null);
    assert.strictEqual(row.getAttribute("tabindex"), null);
    assert.ok(row.classList.contains("already-link-host"));
  });

  it("navigates on a click of the link, with onEventClick asked first", () => {
    const calls = [];
    const c = render([at("10", { id: "d1" })], {
      onEventClick: (event, view) => calls.push([event.id, view]),
    });
    c.querySelector(".already-day-event__link").click();
    assert.deepStrictEqual(calls, [["d1", "day"]]);
    assert.strictEqual(window.location.hash, "#event/d1");
  });

  it("links a part row under its parent by the part's own id", () => {
    const c = render([
      createComposite(
        {
          id: "night",
          title: "Burger Night",
          start: "2099-06-15T17:00:00Z",
          end: "2099-06-15T21:00:00Z",
        },
        [
          {
            id: "act",
            title: "Act",
            start: "2099-06-15T18:00:00Z",
            end: "2099-06-15T19:00:00Z",
          },
        ],
      ),
    ]);
    const part = c.querySelector(".already-day-event--part");
    assert.strictEqual(
      part.querySelector("a.already-day-event__link").getAttribute("href"),
      "#event/act",
    );
    assert.strictEqual(part.getAttribute("role"), null);
  });

  it("links a part row with no id to its parent", () => {
    const c = render([
      createComposite(
        {
          id: "night",
          title: "Burger Night",
          start: "2099-06-15T17:00:00Z",
          end: "2099-06-15T21:00:00Z",
        },
        [
          {
            id: undefined,
            title: "Act",
            start: "2099-06-15T18:00:00Z",
            end: "2099-06-15T19:00:00Z",
          },
        ],
      ),
    ]);
    assert.strictEqual(
      c
        .querySelector(".already-day-event--part a.already-day-event__link")
        .getAttribute("href"),
      "#event/night",
    );
  });

  it("gives a row with no route no link", () => {
    const orphan = { ...at("10", { title: "No id" }), id: undefined };
    const c = render([orphan]);
    const row = c.querySelector(".already-day-event");
    assert.strictEqual(row.querySelector("a"), null);
    assert.ok(!row.classList.contains("already-link-host"));
    row.click();
    assert.strictEqual(window.location.hash, "");
  });
});
