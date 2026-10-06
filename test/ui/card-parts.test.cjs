require("../setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderGridView, renderListView, openEventPopover, closeEventPopover;
let register;

before(async () => {
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderListView } = await import("../../src/views/list.js"));
  ({ openEventPopover, closeEventPopover } = await import(
    "../../src/ui/event-popover.js"
  ));
  ({ register } = await import("../../src/registry.js"));
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
afterEach(() => {
  closeEventPopover();
  document.body.innerHTML = "";
  window.location.hash = "";
});

const NAMES = ["clean", "compact", "badge", "hero"];
const cfg = (layout, over = {}) => ({
  locale: "en-US",
  i18n: {},
  _theme: { layout, orientation: "vertical", imagePosition: "left" },
  ...over,
});
const act = (n, hour, extra = {}) => ({
  title: `Act ${n}`,
  start: `2099-06-15T${hour}:00:00Z`,
  end: `2099-06-15T${hour}:30:00Z`,
  ...extra,
});
const night = (parts, over = {}) =>
  createComposite(
    {
      title: "Burger Night",
      start: "2099-06-15T17:00:00Z",
      end: "2099-06-15T21:00:00Z",
      ...over,
    },
    parts,
  );
const grid = (events, config) => {
  const c = document.createElement("div");
  renderGridView(c, events, "UTC", config);
  return c;
};
const lines = (root) =>
  [...root.querySelectorAll(".already-card__part")].map((el) => el.textContent);
const more = (root) => root.querySelector(".already-card__parts-more");

describe("parts on built-in layouts", () => {
  for (const name of NAMES) {
    it(`${name}: leaves an ordinary event's card alone`, () => {
      const c = grid([createTestEvent({ title: "Solo" })], cfg(name));
      assert.strictEqual(c.querySelector(".already-card__parts"), null);
      assert.strictEqual(c.querySelector(".already-card--composite"), null);
    });

    it(`${name}: lists one part with its start time`, () => {
      const c = grid([night([act(1, 18)])], cfg(name));
      assert.deepStrictEqual(lines(c), ["6:00 PM Act 1"]);
      assert.ok(c.querySelector(".already-card--composite"));
      assert.strictEqual(more(c), null);
    });

    it(`${name}: lists three parts with no overflow line`, () => {
      const c = grid([night([act(1, 18), act(2, 19), act(3, 20)])], cfg(name));
      assert.strictEqual(lines(c).length, 3);
      assert.strictEqual(more(c), null);
    });

    it(`${name}: lists three of four parts and counts the rest`, () => {
      const c = grid(
        [night([act(1, 17), act(2, 18), act(3, 19), act(4, 20)])],
        cfg(name),
      );
      assert.deepStrictEqual(lines(c), [
        "5:00 PM Act 1",
        "6:00 PM Act 2",
        "7:00 PM Act 3",
      ]);
      assert.strictEqual(more(c).textContent, "+1 more");
    });

    it(`${name}: skips a second listing and does not count it`, () => {
      const c = grid(
        [
          night([
            { ...act(0, 17), title: "BURGER NIGHT!" },
            act(1, 17),
            act(2, 18),
            act(3, 19),
          ]),
        ],
        cfg(name),
      );
      assert.deepStrictEqual(lines(c), [
        "5:00 PM Act 1",
        "6:00 PM Act 2",
        "7:00 PM Act 3",
      ]);
      assert.strictEqual(more(c), null);
    });
  }
});

describe("what a line says", () => {
  it("renders no block when every part is a second listing", () => {
    const c = grid(
      [night([{ ...act(0, 17), title: "burger night" }])],
      cfg("clean"),
    );
    assert.strictEqual(c.querySelector(".already-card__parts"), null);
    assert.ok(c.querySelector(".already-card--composite"));
  });

  it("adds the short date to a part on another day", () => {
    const c = grid(
      [
        night(
          [
            {
              title: "Late Set",
              start: "2099-06-16T02:00:00Z",
              end: "2099-06-16T03:00:00Z",
            },
          ],
          { end: "2099-06-16T04:00:00Z" },
        ),
      ],
      cfg("clean"),
    );
    assert.deepStrictEqual(lines(c), ["Jun 16, 2:00 AM Late Set"]);
  });

  // An all-day part exists only under an all-day parent: a festival and the
  // market that runs through its first day.
  const festival = (parts) =>
    night(parts, { start: "2099-06-15", end: "2099-06-18", allDay: true });

  it("labels an all-day part on the parent's first day", () => {
    const c = grid(
      [
        festival([
          {
            title: "Market",
            start: "2099-06-15",
            end: "2099-06-16",
            allDay: true,
          },
        ]),
      ],
      cfg("clean"),
    );
    assert.deepStrictEqual(lines(c), ["All Day Market"]);
  });

  it("gives an all-day part on a later day its date", () => {
    const c = grid(
      [
        festival([
          {
            title: "Parade",
            start: "2099-06-16",
            end: "2099-06-17",
            allDay: true,
          },
        ]),
      ],
      cfg("clean"),
    );
    assert.deepStrictEqual(lines(c), ["Jun 16 Parade"]);
  });

  it("labels a part from a calendar in another zone the way its parent's time is labelled", () => {
    // The viewer is in UTC and the part's own calendar is in New York, so the
    // line carries the source-zone suffix that formatEventWhen adds.
    const c = grid(
      [night([{ ...act(1, 18), _sourceTimeZone: "America/New_York" }])],
      cfg("clean"),
    );
    assert.deepStrictEqual(lines(c), ["6:00 PM · 2:00 PM EDT Act 1"]);
  });

  it("takes the overflow text from i18n.moreParts", () => {
    const c = grid(
      [night([act(1, 17), act(2, 18), act(3, 19), act(4, 20), act(5, 20)])],
      cfg("clean", { i18n: { moreParts: "{count} weitere" } }),
    );
    assert.strictEqual(more(c).textContent, "2 weitere");
  });

  it("does not treat a host's own parts field as a composite", () => {
    const c = grid(
      [createTestEvent({ id: "host", parts: [{ id: "tier", title: "VIP" }] })],
      cfg("clean"),
    );
    assert.strictEqual(c.querySelector(".already-card__parts"), null);
    assert.strictEqual(c.querySelector(".already-card--composite"), null);
  });
});

describe("custom layouts", () => {
  const build = (name, make) => {
    register("layout", name, make);
    return cfg(name);
  };
  const card = (...children) => {
    const el = document.createElement("div");
    el.className = "already-card";
    for (const child of children) el.appendChild(child);
    return el;
  };
  const div = (className, text = "") => {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    return el;
  };

  it("gets the block appended to its body when it has no slot", () => {
    const config = build("cp-noslot", (event) =>
      card(div("already-card__body", event.title)),
    );
    const c = grid([night([act(1, 18)])], config);
    const block = c.querySelector(".already-card__parts");
    assert.strictEqual(block.parentElement.className, "already-card__body");
    assert.strictEqual(block.nextElementSibling, null);
    assert.deepStrictEqual(lines(c), ["6:00 PM Act 1"]);
  });

  it("gets the block in its slot when it has one", () => {
    const config = build("cp-slot", (event) => {
      const slot = div("already-card__parts");
      slot.dataset.mine = "yes";
      return card(slot, div("already-card__body", event.title));
    });
    const c = grid([night([act(1, 18)])], config);
    const block = c.querySelector(".already-card__parts");
    assert.strictEqual(block.dataset.mine, "yes");
    assert.strictEqual(c.querySelectorAll(".already-card__parts").length, 1);
    assert.deepStrictEqual(lines(c), ["6:00 PM Act 1"]);
  });

  it("has what it drew in the slot replaced, so parts are never shown twice", () => {
    const config = build("cp-own", (event) =>
      card(
        div("already-card__parts", `mine: ${(event.parts || []).length}`),
        div("already-card__body", event.title),
      ),
    );
    const c = grid([night([act(1, 18)])], config);
    const block = c.querySelector(".already-card__parts");
    assert.ok(!block.textContent.includes("mine"));
    assert.deepStrictEqual(lines(c), ["6:00 PM Act 1"]);
  });

  it("gets the block appended to the card when it has no body", () => {
    const config = build("cp-nobody", (event) =>
      card(div("my-title", event.title)),
    );
    const c = grid([night([act(1, 18)])], config);
    const block = c.querySelector(".already-card__parts");
    assert.ok(block.parentElement.classList.contains("already-card"));
  });

  it("has an unused slot removed for an ordinary event", () => {
    const config = build("cp-slot-plain", (event) =>
      card(div("already-card__parts"), div("already-card__body", event.title)),
    );
    const c = grid([createTestEvent({ title: "Solo" })], config);
    assert.strictEqual(c.querySelector(".already-card__parts"), null);
  });

  it("is skipped when the layout failed and an error card was drawn", () => {
    const config = {
      ...build("cp-throws", () => {
        throw new Error("boom");
      }),
      onRsvp: async () => ({ partySize: 1 }),
    };
    const original = console.error;
    console.error = () => {};
    let c;
    try {
      c = grid([night([act(1, 18)], { rsvp: true })], config);
    } finally {
      console.error = original;
    }
    // The entry point turns an error card away before any decorator runs,
    // so every decoration is asserted here: no parts, no state or click
    // binding, and no RSVP.
    const card = c.querySelector(".already-card--error");
    assert.ok(card);
    assert.strictEqual(card.querySelector(".already-card__parts"), null);
    assert.ok(!card.classList.contains("already-card--composite"));
    assert.strictEqual(card.dataset.eventId, undefined);
    assert.strictEqual(card.getAttribute("role"), null);
    assert.strictEqual(card.querySelector(".already-card__rsvp"), null);
    assert.strictEqual(card.querySelector(".already-rsvp__open"), null);
  });
});

describe("the three card sites", () => {
  const four = () => night([act(1, 17), act(2, 18), act(3, 19), act(4, 20)]);

  it("list view shows the same lines and count as grid view", () => {
    const g = grid([four()], cfg("clean"));
    const l = document.createElement("div");
    renderListView(l, [four()], "UTC", cfg("clean"));
    assert.deepStrictEqual(lines(l), lines(g));
    assert.strictEqual(more(l).textContent, more(g).textContent);
  });

  it("the popover shows the same lines and count as the list card", () => {
    const root = document.createElement("div");
    root.className = "already";
    document.body.appendChild(root);
    const anchor = document.createElement("div");
    root.appendChild(anchor);
    openEventPopover(anchor, four(), root, cfg("clean"), "month");
    const popover = root.querySelector(".already-event-popover");
    const g = grid([four()], cfg("clean"));
    assert.deepStrictEqual(lines(popover), lines(g));
    assert.strictEqual(more(popover).textContent, "+1 more");
  });

  it("labels part lines against the calendar's zone at all three sites", () => {
    // The viewer is in UTC and the calendar is in Chicago, so a site that
    // dropped the zone would print a UTC suffix where the Chicago one belongs.
    const zone = "America/Chicago";
    const one = () => night([act(1, 18)]);
    const g = document.createElement("div");
    renderGridView(g, [one()], zone, cfg("clean"));
    const l = document.createElement("div");
    renderListView(l, [one()], zone, cfg("clean"));
    const root = document.createElement("div");
    root.className = "already";
    document.body.appendChild(root);
    const anchor = document.createElement("div");
    root.appendChild(anchor);
    openEventPopover(anchor, one(), root, cfg("clean"), "month", zone);
    const popover = root.querySelector(".already-event-popover");
    const expected = ["6:00 PM · 1:00 PM CDT Act 1"];
    assert.deepStrictEqual(lines(g), expected);
    assert.deepStrictEqual(lines(l), expected);
    assert.deepStrictEqual(lines(popover), expected);
  });

  it("puts the RSVP row after the parts on a card", () => {
    const config = cfg("clean", { onRsvp: async () => ({ partySize: 1 }) });
    const c = grid([night([act(1, 18)], { rsvp: true })], config);
    const parts = c.querySelector(".already-card__parts");
    const rsvp = c.querySelector(".already-card__rsvp");
    assert.ok(rsvp);
    assert.ok(
      parts.compareDocumentPosition(rsvp) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
