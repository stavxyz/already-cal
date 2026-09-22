const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

require("../setup-dom.cjs");
const {
  describe,
  it,
  before,
  beforeEach,
  afterEach,
  after,
} = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

let openEventPopover, closeEventPopover, bindEventPopover;
before(async () => {
  ({ openEventPopover, closeEventPopover, bindEventPopover } = await import(
    "../../src/ui/event-popover.js"
  ));
});

let root, anchor, event;
const POPOVER = ".already-event-popover";
const find = () => root.querySelector(POPOVER);

function pointerDown(pointerType) {
  const e = new window.Event("pointerdown", {
    bubbles: true,
    cancelable: true,
  });
  e.pointerType = pointerType;
  return e;
}
const touchDown = () => pointerDown("touch");
const mouseDown = () => pointerDown("mouse");

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  root.className = "already";
  document.body.appendChild(root);
  anchor = document.createElement("div");
  anchor.className = "already-month-chip";
  root.appendChild(anchor);
  event = createTestEvent({ title: "Wine Dinner" });
  window.location.hash = "";
});

afterEach(() => closeEventPopover());

describe("event popover", () => {
  it("renders the same card the grid layout produces", () => {
    openEventPopover(anchor, event, root, {});
    const pop = find();
    assert.ok(pop, "popover exists");
    assert.ok(pop.querySelector(".already-card"), "contains a layout card");
    assert.match(pop.textContent, /Wine Dinner/);
  });

  it("is parented to the .already root, not document.body", () => {
    openEventPopover(anchor, event, root, {});
    assert.equal(find().parentElement, root);
    assert.equal(document.body.querySelector(`:scope > ${POPOVER}`), null);
  });

  it("only ever has one open at a time", () => {
    openEventPopover(anchor, event, root, {});
    openEventPopover(anchor, event, root, {});
    assert.equal(root.querySelectorAll(POPOVER).length, 1);
  });

  it("clicking the card opens the event detail view", () => {
    openEventPopover(anchor, event, root, {});
    find().querySelector(".already-card").click();
    assert.match(window.location.hash, /^#event\//);
  });

  // --- every close path: the stuck-popover risk ---

  it("closes on Escape", () => {
    openEventPopover(anchor, event, root, {});
    document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.equal(find(), null);
  });

  it("closes on an outside pointerdown", () => {
    openEventPopover(anchor, event, root, {});
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    assert.equal(find(), null);
  });

  it("does NOT close on a pointerdown inside the card", () => {
    openEventPopover(anchor, event, root, {});
    find().dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    assert.ok(find(), "still open");
  });

  it("closes on scroll", () => {
    openEventPopover(anchor, event, root, {});
    window.dispatchEvent(new window.Event("scroll"));
    assert.equal(find(), null);
  });

  it("closes when the window loses focus", () => {
    openEventPopover(anchor, event, root, {});
    window.dispatchEvent(new window.Event("blur"));
    assert.equal(find(), null);
  });

  it("closes when the tab is hidden", () => {
    openEventPopover(anchor, event, root, {});
    document.dispatchEvent(new window.Event("visibilitychange"));
    assert.equal(find(), null);
  });

  // Anchor removal is not handled inside this module. The views call
  // closeEventPopover() at the top of every render, and
  // test/views/popover-teardown.test.cjs covers that against the real
  // renderers. A test here could only re-assert closeEventPopover itself.

  it("closeEventPopover is safe to call when nothing is open", () => {
    closeEventPopover();
    closeEventPopover();
    assert.equal(find(), null);
  });

  it("leaves no stale listener that could close the NEXT popover", () => {
    // Asserting null after a close cannot fail. The real contract is that a
    // closed popover's handlers are gone, which only shows when a second one
    // is open and an event the first listened for fires.
    openEventPopover(anchor, event, root, {});
    closeEventPopover();

    const second = document.createElement("div");
    root.appendChild(second);
    openEventPopover(second, event, root, {});
    // A surviving outside-pointerdown handler from the first popover would
    // treat this as outside itself and close the second.
    second.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    assert.ok(find(), "second popover survived the first's stale listeners");
  });

  // --- binding behavior ---

  it("a touch tap opens the popover", () => {
    bindEventPopover(anchor, event, root, {});
    anchor.dispatchEvent(touchDown());
    assert.ok(find(), "touch tap opens the popover");
  });

  // Without preventDefault the tap synthesises a click, that click reaches the
  // anchor's own bindEventClick, and the FIRST tap navigates to the detail
  // view. The popover is torn down microseconds after opening and the agreed
  // two-step never happens on touch.
  it("a touch tap calls preventDefault so the synthesised click cannot navigate", () => {
    bindEventPopover(anchor, event, root, {});
    const e = touchDown();
    let prevented = false;
    e.preventDefault = () => {
      prevented = true;
    };
    anchor.dispatchEvent(e);
    assert.ok(find(), "popover opened");
    assert.ok(prevented, "preventDefault was called on the opening tap");
  });

  it("a second tap on the same anchor falls through so it can navigate", () => {
    bindEventPopover(anchor, event, root, {});
    anchor.dispatchEvent(touchDown());
    const second = touchDown();
    let prevented = false;
    second.preventDefault = () => {
      prevented = true;
    };
    anchor.dispatchEvent(second);
    assert.equal(prevented, false, "second tap reaches bindEventClick");
  });

  // The guard used to read e.pointerType inside a mouseenter handler. A
  // MouseEvent carries no pointerType, so it was always undefined, the guard
  // never fired, and iOS's synthesised hover reopened the card.
  it("suppresses the hover path after a touch tap", async () => {
    bindEventPopover(anchor, event, root, {});
    anchor.dispatchEvent(touchDown());
    closeEventPopover();
    anchor.dispatchEvent(new window.MouseEvent("mouseenter"));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(find(), null, "synthesised hover did not reopen it");
  });

  it("opens on hover after the delay, and leaving cancels a pending open", async () => {
    bindEventPopover(anchor, event, root, {});
    anchor.dispatchEvent(mouseDown());
    anchor.dispatchEvent(new window.MouseEvent("mouseenter"));
    assert.equal(find(), null, "not open before the delay elapses");
    await new Promise((r) => setTimeout(r, 250));
    assert.ok(find(), "open after the delay");

    closeEventPopover();
    anchor.dispatchEvent(new window.MouseEvent("mouseenter"));
    anchor.dispatchEvent(new window.MouseEvent("mouseleave"));
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(find(), null, "leaving cancelled the pending open");
  });
});

// M6: the popover claimed to render "the same component" the grid does, but it
// skipped decorateCard, so it lacked the past and featured modifiers and the
// data-event-id hook. Compare the two directly rather than asserting a list.
describe("popover card matches the grid card", () => {
  let renderGridView;
  before(async () => {
    ({ renderGridView } = await import("../../src/views/grid.js"));
  });

  const classesOf = (el) =>
    [...el.classList].filter((c) => c !== "already-event-popover__card").sort();

  it("carries the same classes and data hooks for a past featured event", () => {
    const past = createTestEvent({
      id: "past-1",
      title: "Past Featured",
      start: "2020-01-01T00:00:00Z",
      end: "2020-01-01T01:00:00Z",
      featured: true,
    });

    const gridHost = document.createElement("div");
    renderGridView(gridHost, [past], "UTC", {});
    const gridCard = gridHost.querySelector(".already-card");

    openEventPopover(anchor, past, root, {}, "month");
    const popCard = find().querySelector(".already-card");

    assert.deepEqual(classesOf(popCard), classesOf(gridCard));
    assert.equal(popCard.dataset.eventId, gridCard.dataset.eventId);
    assert.equal(popCard.dataset.eventId, "past-1");
  });
});

// H1: every other activation path honors config.onEventClick and its `false`
// return. The popover called setEventDetail directly and bypassed it.
describe("popover card honors onEventClick", () => {
  it("passes the event and view name, and a false return blocks navigation", () => {
    const calls = [];
    openEventPopover(
      anchor,
      event,
      root,
      {
        onEventClick: (e, view) => {
          calls.push([e.id, view]);
          return false;
        },
      },
      "week",
    );

    find().querySelector(".already-card").click();
    assert.deepEqual(calls, [[event.id, "week"]]);
    assert.equal(window.location.hash, "", "navigation was vetoed");
  });
});

// M9: `active` is module scope so only one card exists across every mounted
// calendar, which is right. What was wrong is that one calendar's re-render
// closed the other's card.
describe("two calendars on one page", () => {
  it("closing by root leaves the other calendar's popover alone", () => {
    const rootB = document.createElement("div");
    rootB.className = "already";
    document.body.appendChild(rootB);

    openEventPopover(anchor, event, root, {});
    assert.ok(root.querySelector(".already-event-popover"), "A is open");

    closeEventPopover(rootB);
    assert.ok(
      root.querySelector(".already-event-popover"),
      "B's render left A open",
    );

    closeEventPopover(root);
    assert.equal(root.querySelector(".already-event-popover"), null);
  });
});

// position() returns early in jsdom because every rect is zero, so nothing
// exercised the clamp or the flip. Stub the three rects it reads.
describe("popover placement", () => {
  let restore;
  function stubRects({ root: r, anchor: a, popover: p }) {
    const proto = window.HTMLElement.prototype;
    const original = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function () {
      const box = this.classList.contains("already-event-popover")
        ? p
        : this === anchor
          ? a
          : this === root
            ? r
            : { top: 0, left: 0, width: 0, height: 0 };
      return {
        ...box,
        right: box.left + box.width,
        bottom: box.top + box.height,
      };
    };
    restore = () => {
      proto.getBoundingClientRect = original;
    };
  }
  afterEach(() => restore?.());

  it("places the card below its anchor when it fits", () => {
    stubRects({
      root: { top: 0, left: 0, width: 800, height: 600 },
      anchor: { top: 100, left: 50, width: 80, height: 20 },
      popover: { top: 0, left: 0, width: 300, height: 200 },
    });
    openEventPopover(anchor, event, root, {});
    assert.equal(find().style.top, "120px");
    assert.equal(find().style.left, "50px");
  });

  it("clamps at the right edge with a gap instead of sitting flush", () => {
    stubRects({
      root: { top: 0, left: 0, width: 600, height: 600 },
      anchor: { top: 100, left: 400, width: 80, height: 20 },
      popover: { top: 0, left: 0, width: 420, height: 200 },
    });
    openEventPopover(anchor, event, root, {});
    // 600 - 420 - 8
    assert.equal(find().style.left, "172px");
  });

  it("centres a card that max-width has capped to the root", () => {
    stubRects({
      root: { top: 0, left: 0, width: 360, height: 600 },
      anchor: { top: 100, left: 200, width: 80, height: 20 },
      popover: { top: 0, left: 0, width: 344, height: 200 },
    });
    openEventPopover(anchor, event, root, {});
    assert.equal(find().style.left, "8px");
  });

  it("flips above the anchor when it would overflow the bottom", () => {
    stubRects({
      root: { top: 0, left: 0, width: 800, height: 300 },
      anchor: { top: 230, left: 50, width: 80, height: 20 },
      popover: { top: 0, left: 0, width: 300, height: 200 },
    });
    openEventPopover(anchor, event, root, {});
    // 230 - 200
    assert.equal(find().style.top, "30px");
  });
});
