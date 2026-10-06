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

  it("list view gives a layout without a footer its own RSVP row", () => {
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
    assert.ok(c.querySelector(".already-card__rsvp .already-rsvp__open"));
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

function gridCard(layout, event, over = {}) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  renderGridView(
    c,
    [event],
    "UTC",
    badge({
      _theme: { layout, orientation: "vertical", imagePosition: "left" },
      ...over,
    }),
  );
  return c.querySelector(".already-card");
}

describe("RSVP card placement per layout", () => {
  it("Badge with a Details link: one footer holds the link and the button", () => {
    const card = gridCard("badge", flagged());
    const footers = card.querySelectorAll(".already-card__footer");
    assert.strictEqual(footers.length, 1);
    const footer = footers[0];
    assert.ok(footer.classList.contains("already-card__footer--rsvp"));
    assert.ok(footer.querySelector("a.already-card__action"));
    assert.ok(footer.querySelector(".already-rsvp__open"));
    assert.strictEqual(card.querySelector(".already-card__rsvp"), null);
  });

  it("Badge without a Details link: a footer row holds only the button", () => {
    const card = gridCard("badge", createTestEvent({ rsvp: true }));
    const row = card.querySelector(".already-card__footer");
    assert.ok(row);
    assert.ok(row.classList.contains("already-card__footer--rsvp"));
    assert.ok(row.querySelector(".already-rsvp__open"));
    assert.strictEqual(row.querySelector("a"), null);
  });

  it("Hero: the button is in its own row after the location and date footer", () => {
    const card = gridCard(
      "hero",
      createTestEvent({ rsvp: true, location: "The Hall" }),
    );
    const info = card
      .querySelector(".already-card__location")
      .closest(".already-card__footer");
    assert.ok(info.querySelector(".already-card__meta"));
    assert.strictEqual(info.querySelector(".already-rsvp__open"), null);
    assert.ok(!info.classList.contains("already-card__footer--rsvp"));
    const row = card.querySelector(".already-card__rsvp");
    assert.ok(row.querySelector(".already-rsvp__open"));
    assert.ok(
      info.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("Clean: the card gets an RSVP row with the button", () => {
    const card = gridCard("clean", createTestEvent({ rsvp: true }));
    const row = card.querySelector(".already-card__body > .already-card__rsvp");
    assert.ok(row);
    assert.ok(row.querySelector(".already-rsvp__open"));
  });

  it("Compact: the card gets an RSVP row with the button", () => {
    const card = gridCard("compact", createTestEvent({ rsvp: true }));
    const row = card.querySelector(".already-card__body > .already-card__rsvp");
    assert.ok(row);
    assert.ok(row.querySelector(".already-rsvp__open"));
  });

  for (const layout of ["badge", "hero", "clean", "compact"]) {
    it(`${layout}: no row and no button when the event does not offer RSVP`, () => {
      const cases = [
        [createTestEvent({ htmlLink: "https://calendar.google.com/x" }), {}],
        [
          createTestEvent({
            rsvp: true,
            htmlLink: "https://calendar.google.com/x",
            start: "2000-01-01T10:00:00Z",
            end: "2000-01-01T11:00:00Z",
          }),
          {},
        ],
        [flagged(), { onRsvp: null }],
      ];
      for (const [event, over] of cases) {
        const card = gridCard(layout, event, over);
        assert.strictEqual(card.querySelector(".already-card__rsvp"), null);
        assert.strictEqual(card.querySelector(".already-rsvp__open"), null);
        assert.strictEqual(
          card.querySelector(".already-card__footer--rsvp"),
          null,
        );
        document.body.innerHTML = "";
      }
    });
  }
});

describe("RSVP form in a decorator-created row", () => {
  const fill = (form) => {
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
  };

  it("opens, cancels and confirms inside that row", async () => {
    const card = gridCard("clean", createTestEvent({ rsvp: true }), {
      onRsvp: async () => ({ partySize: 2 }),
    });
    const row = card.querySelector(".already-card__rsvp");
    row.querySelector(".already-rsvp__open").click();
    assert.ok(row.querySelector("form.already-rsvp"));
    assert.strictEqual(row.querySelector(".already-rsvp__open"), null);
    assert.ok(card.classList.contains("already-card--rsvp-open"));

    row.querySelector(".already-rsvp__cancel").click();
    assert.strictEqual(row.querySelector("form"), null);
    assert.ok(row.querySelector(".already-rsvp__open"));

    row.querySelector(".already-rsvp__open").click();
    const form = row.querySelector("form");
    fill(form);
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(row.querySelector("form"), null);
    assert.ok(row.querySelector(".already-rsvp__done"));
    assert.strictEqual(card.querySelectorAll(".already-rsvp__done").length, 1);
  });
});

describe("a card with an open RSVP form", () => {
  it("ignores the link while the form is open, and navigates again after Cancel", () => {
    const event = createTestEvent({ id: "e-open", rsvp: true });
    const card = gridCard("clean", event);
    card.querySelector(".already-rsvp__open").click();
    card.querySelector(".already-card__link").click();
    assert.strictEqual(window.location.hash, "");
    card.querySelector(".already-rsvp__cancel").click();
    card.querySelector(".already-card__link").click();
    assert.strictEqual(window.location.hash, "#event/e-open");
  });

  it("leaves Badge's Details link working as a link", () => {
    const card = gridCard("badge", flagged());
    card.querySelector(".already-rsvp__open").click();
    const details = card.querySelector("a.already-card__action");
    const click = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    details.dispatchEvent(click);
    assert.strictEqual(click.defaultPrevented, false);
    assert.strictEqual(window.location.hash, "");
  });
});
