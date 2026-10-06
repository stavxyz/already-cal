// The decorated card of an event with no parts must be the markup v0.14.0
// produces, byte for byte, in every built-in layout. The strings in the
// fixture were captured from that release's branch with this same event.
// v0.14.0 is where the title became the event link and the card stopped
// being a button, so the v0.12.1 fixture was regenerated on purpose.
process.env.TZ = "UTC";
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");
const expected = require("../fixtures/ordinary-cards-v0.14.0.json");

let renderGridView;
before(async () => {
  ({ renderGridView } = await import("../../src/views/grid.js"));
});

const event = () =>
  createTestEvent({
    id: "ev-1",
    title: "Autumn Market",
    description: "Stalls and music.",
    location: "Town Square",
    start: "2099-06-15T17:00:00Z",
    end: "2099-06-15T21:00:00Z",
    tags: [{ key: "tag", value: "market" }],
    image: "https://x.example/market.jpg",
    links: [],
  });

describe("an ordinary event's card markup", () => {
  for (const layout of Object.keys(expected)) {
    it(`${layout}: matches v0.14.0`, () => {
      const c = document.createElement("div");
      renderGridView(c, [event()], "UTC", {
        locale: "en-US",
        i18n: {},
        _theme: { layout, orientation: "vertical", imagePosition: "left" },
      });
      assert.strictEqual(
        c.querySelector(".already-card").outerHTML,
        expected[layout],
      );
    });
  }
});
