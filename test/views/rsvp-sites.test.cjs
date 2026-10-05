require("../setup-dom.cjs");
const {
  describe,
  it,
  before,
  beforeEach,
  after,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderListView;
let renderGridView;
let renderDetailView;
let openEventPopover;
let closeEventPopover;
before(async () => {
  ({ renderListView } = await import("../../src/views/list.js"));
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderDetailView } = await import("../../src/views/detail.js"));
  ({ openEventPopover, closeEventPopover } = await import(
    "../../src/ui/event-popover.js"
  ));
});

let originalTZ;
before(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  closeEventPopover();
  document.body.innerHTML = "";
});

const badge = (over = {}) => ({
  onRsvp: async () => ({ partySize: 1 }),
  rsvpAllEvents: false,
  i18n: {},
  _theme: { layout: "badge", orientation: "vertical", imagePosition: "left" },
  ...over,
});
const flagged = () =>
  createTestEvent({ rsvp: true, htmlLink: "https://calendar.google.com/x" });

describe("RSVP button sites", () => {
  it("list view puts the button in the Badge footer", () => {
    const c = document.createElement("div");
    renderListView(c, [flagged()], "UTC", badge());
    assert.ok(c.querySelector(".already-card__footer .already-rsvp__open"));
  });

  it("grid view puts the button in the Badge footer", () => {
    const c = document.createElement("div");
    renderGridView(c, [flagged()], "UTC", badge());
    assert.ok(c.querySelector(".already-card__footer .already-rsvp__open"));
  });

  it("a layout without a footer gets no button", () => {
    const c = document.createElement("div");
    renderListView(
      c,
      [flagged()],
      "UTC",
      badge({
        _theme: {
          layout: "clean",
          orientation: "vertical",
          imagePosition: "left",
        },
      }),
    );
    assert.strictEqual(c.querySelector(".already-rsvp__open"), null);
  });

  it("the detail view offers the button in its own row", () => {
    const c = document.createElement("div");
    renderDetailView(c, flagged(), "UTC", () => {}, badge());
    assert.ok(c.querySelector(".already-detail-rsvp .already-rsvp__open"));
  });

  it("the detail view shows nothing without onRsvp", () => {
    const c = document.createElement("div");
    renderDetailView(c, flagged(), "UTC", () => {}, badge({ onRsvp: null }));
    assert.strictEqual(c.querySelector(".already-rsvp__open"), null);
  });

  it("uses the module defaults for labels when no i18n is given", () => {
    const c = document.createElement("div");
    renderListView(c, [flagged()], "UTC", badge({ i18n: undefined }));
    assert.strictEqual(
      c.querySelector("a.already-card__action").textContent,
      "Details",
    );
    assert.strictEqual(
      c.querySelector(".already-rsvp__open").textContent,
      "RSVP",
    );
  });

  it("the hover popover keeps the Details link and shows no RSVP button", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const anchor = document.createElement("div");
    root.appendChild(anchor);
    openEventPopover(anchor, flagged(), root, badge(), "month");
    const card = root.querySelector(".already-event-popover__card");
    assert.ok(card.querySelector(".already-card__action"));
    assert.strictEqual(card.querySelector(".already-rsvp__open"), null);
  });
});
