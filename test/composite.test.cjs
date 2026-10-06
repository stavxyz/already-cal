// Membership must not depend on the viewer's zone. Pin a zone far from the
// calendar zone the cases use, so a rule that leaned on it would fail here.
const originalTZ = process.env.TZ;
process.env.TZ = "Pacific/Auckland";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let composeEvents, groupParts, selectVisible, partsOf;

before(async () => {
  ({ composeEvents, groupParts, selectVisible, partsOf } = await import(
    "../src/composite.js"
  ));
});

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const ZONE = { timeZone: "America/Chicago" };

const ev = (id, start, end, extra = {}) =>
  createTestEvent({ id, title: id, start, end, ...extra });
const parent = (id, start, end, extra = {}) =>
  ev(id, start, end, { composite: true, ...extra });
const ids = (list) => list.map((e) => e.id);
const partIds = (event) => partsOf(event).map((p) => p.id);
const compose = (events) => composeEvents(events, ZONE);

describe("with no flag", () => {
  it("returns the visible entries as the same objects in the same order", () => {
    const a = ev("a", "2099-06-15T10:00:00Z", "2099-06-15T11:00:00Z");
    const b = ev("b", "2099-06-15T10:30:00Z", "2099-06-15T10:45:00Z");
    const hidden = ev("h", "2099-06-15T10:10:00Z", "2099-06-15T10:20:00Z", {
      hidden: true,
    });
    const { events } = compose([a, hidden, b]);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0], a);
    assert.strictEqual(events[1], b);
  });

  it("accepts a missing list", () => {
    assert.deepStrictEqual(composeEvents(undefined).events, []);
  });
});

describe("selectVisible", () => {
  it("sets hidden entries aside and keeps the order", () => {
    const list = [
      ev("a", "2099-06-15T10:00:00Z"),
      ev("h", "2099-06-15T10:00:00Z", undefined, { hidden: true }),
      ev("b", "2099-06-15T10:00:00Z"),
    ];
    assert.deepStrictEqual(ids(selectVisible(list)), ["a", "b"]);
  });
});

describe("one parent and its parts", () => {
  const P = () => parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z");

  it("attaches a part that starts inside the window", () => {
    const p = P();
    const part = ev("x", "2099-06-15T23:00:00Z", "2099-06-16T01:00:00Z");
    const { events } = compose([p, part]);
    assert.deepStrictEqual(ids(events), ["p"]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
    assert.strictEqual(events[0].parts[0].parentId, "p");
  });

  it("copies the entries and leaves the originals untouched", () => {
    const p = P();
    const part = ev("x", "2099-06-15T23:00:00Z", "2099-06-16T01:00:00Z");
    const { events } = compose([p, part]);
    assert.notStrictEqual(events[0], p);
    assert.notStrictEqual(events[0].parts[0], part);
    assert.ok(!("parts" in p));
    assert.ok(!("parentId" in part));
    assert.strictEqual(events[0].title, p.title);
  });

  it("takes a start equal to the parent's start and refuses one equal to its end", () => {
    const { events } = compose([
      P(),
      ev("at-start", "2099-06-15T22:00:00Z", "2099-06-15T23:00:00Z"),
      ev("at-end", "2099-06-16T02:00:00Z", "2099-06-16T03:00:00Z"),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "at-end"]);
    assert.deepStrictEqual(partIds(events[0]), ["at-start"]);
  });

  it("takes a part that runs past the parent's end", () => {
    const { events } = compose([
      P(),
      ev("late", "2099-06-16T01:30:00Z", "2099-06-16T04:00:00Z"),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["late"]);
  });

  it("refuses an entry that starts before the parent and overlaps it", () => {
    const { events } = compose([
      ev("early", "2099-06-15T21:00:00Z", "2099-06-15T23:00:00Z"),
      P(),
    ]);
    assert.deepStrictEqual(ids(events), ["early", "p"]);
    assert.strictEqual(events[1].composite, true);
    assert.deepStrictEqual(partIds(events[1]), []);
  });

  it("lists parts in start order", () => {
    const { events } = compose([
      P(),
      ev("second", "2099-06-16T00:00:00Z", "2099-06-16T00:30:00Z"),
      ev("first", "2099-06-15T22:30:00Z", "2099-06-15T23:00:00Z"),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["first", "second"]);
  });

  it("keeps a parent on a part on another day", () => {
    const { events } = compose([
      parent("two-day", "2099-06-15T22:00:00Z", "2099-06-17T02:00:00Z"),
      ev("day-two", "2099-06-16T23:00:00Z", "2099-06-17T00:00:00Z"),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["day-two"]);
  });

  it("returns a parent with no parts as the same object", () => {
    const p = P();
    const { events } = compose([p]);
    assert.strictEqual(events[0], p);
    assert.ok(!("parts" in events[0]));
  });
});

describe("several parents", () => {
  const part = () => ev("x", "2099-06-15T23:00:00Z", "2099-06-15T23:30:00Z");

  it("gives the part to the parent with the shortest window", () => {
    const { events } = compose([
      parent("wide", "2099-06-15T20:00:00Z", "2099-06-16T04:00:00Z"),
      parent("tight", "2099-06-15T22:00:00Z", "2099-06-16T00:00:00Z"),
      part(),
    ]);
    assert.deepStrictEqual(ids(events), ["wide", "tight"]);
    assert.deepStrictEqual(partIds(events[0]), []);
    assert.deepStrictEqual(partIds(events[1]), ["x"]);
  });

  it("breaks a tie on length by the latest start", () => {
    const { events } = compose([
      parent("earlier", "2099-06-15T21:00:00Z", "2099-06-15T23:30:00Z"),
      parent("later", "2099-06-15T22:00:00Z", "2099-06-16T00:30:00Z"),
      part(),
    ]);
    assert.deepStrictEqual(partIds(events[0]), []);
    assert.deepStrictEqual(partIds(events[1]), ["x"]);
  });

  it("breaks a full tie by the earliest position", () => {
    const { events } = compose([
      parent("one", "2099-06-15T22:00:00Z", "2099-06-16T00:00:00Z"),
      parent("two", "2099-06-15T22:00:00Z", "2099-06-16T00:00:00Z"),
      part(),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
    assert.deepStrictEqual(partIds(events[1]), []);
  });

  it("never makes a parent a part, even inside another parent", () => {
    const { events } = compose([
      parent("outer", "2099-06-15T20:00:00Z", "2099-06-16T04:00:00Z"),
      parent("inner", "2099-06-15T22:00:00Z", "2099-06-16T00:00:00Z", {
        partOf: true,
      }),
    ]);
    assert.deepStrictEqual(ids(events), ["outer", "inner"]);
    assert.deepStrictEqual(partIds(events[0]), []);
  });
});

describe("opting out and hidden entries", () => {
  it("keeps a standalone entry out", () => {
    const { events } = compose([
      parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z"),
      ev("solo", "2099-06-15T23:00:00Z", "2099-06-16T00:00:00Z", {
        standalone: true,
      }),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "solo"]);
  });

  it("releases the parts of a hidden parent to another enclosing parent", () => {
    const { events } = compose([
      parent("outer", "2099-06-15T20:00:00Z", "2099-06-16T04:00:00Z"),
      parent("gone", "2099-06-15T22:00:00Z", "2099-06-16T00:00:00Z", {
        hidden: true,
      }),
      ev("x", "2099-06-15T23:00:00Z", "2099-06-15T23:30:00Z"),
    ]);
    assert.deepStrictEqual(ids(events), ["outer"]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
  });

  it("lets the parts of a hidden parent stand alone when nothing else contains them", () => {
    const { events } = compose([
      parent("gone", "2099-06-15T22:00:00Z", "2099-06-16T00:00:00Z", {
        hidden: true,
      }),
      ev("x", "2099-06-15T23:00:00Z", "2099-06-15T23:30:00Z"),
    ]);
    assert.deepStrictEqual(ids(events), ["x"]);
  });

  it("leaves a hidden part out of the composite and out of the list", () => {
    const { events, lookup } = compose([
      parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z"),
      ev("h", "2099-06-15T23:00:00Z", "2099-06-16T00:00:00Z", { hidden: true }),
    ]);
    assert.deepStrictEqual(ids(events), ["p"]);
    assert.deepStrictEqual(partIds(events[0]), []);
    assert.strictEqual(lookup("h").event.id, "h");
    assert.strictEqual(lookup("h").part, null);
  });
});

describe("all-day entries", () => {
  // The parent is one all-day date, the 9th, in a Chicago calendar.
  const day = () => parent("day", "2099-07-09", "2099-07-10");

  it("takes a timed part by its date in the calendar's zone, not the viewer's", () => {
    // 04:30 UTC on the 10th is 11:30 PM on the 9th in Chicago, and already
    // the afternoon of the 10th in Auckland, the zone this file pins.
    const { events } = compose([
      day(),
      ev("late", "2099-07-10T04:30:00Z", "2099-07-10T05:00:00Z"),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["late"]);
  });

  it("uses the part's own source zone when it has one", () => {
    // The same instant is 1:30 PM on the 10th in Tokyo.
    const { events } = compose([
      day(),
      ev("tokyo", "2099-07-10T04:30:00Z", "2099-07-10T05:00:00Z", {
        _sourceTimeZone: "Asia/Tokyo",
      }),
    ]);
    assert.deepStrictEqual(ids(events), ["day", "tokyo"]);
  });

  it("takes an all-day part whose date is in the range and refuses the end date", () => {
    const { events } = compose([
      parent("fest", "2099-07-09", "2099-07-12"),
      ev("inside", "2099-07-10", "2099-07-11", { allDay: true }),
      ev("on-end", "2099-07-12", "2099-07-13", { allDay: true }),
    ]);
    assert.deepStrictEqual(ids(events), ["fest", "on-end"]);
    assert.deepStrictEqual(partIds(events[0]), ["inside"]);
  });

  it("never gives an all-day entry to a timed parent", () => {
    const { events } = compose([
      parent("p", "2099-07-09T15:00:00Z", "2099-07-10T03:00:00Z"),
      ev("all-day", "2099-07-09", "2099-07-10", { allDay: true }),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "all-day"]);
  });

  it("lists an all-day part at the start of its day as the viewer sees it", () => {
    // Order is a display matter, so it follows the viewer's days, as the
    // calendar views do. In Auckland, the zone this file pins, 20:00 UTC on
    // the 9th is 8 AM on the 10th, so the all-day 10th comes first. Ordering
    // the all-day part by its UTC midnight would put it second here, and
    // west of UTC it would put it ahead of an evening part of the day before.
    const { events } = compose([
      parent("fest", "2099-07-09", "2099-07-12"),
      ev("morning", "2099-07-09T20:00:00Z", "2099-07-09T21:00:00Z"),
      ev("inside", "2099-07-10", "2099-07-11", { allDay: true }),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["inside", "morning"]);
  });
});

describe("parents with no usable window", () => {
  const part = () => ev("x", "2099-06-15T22:00:00Z", "2099-06-15T23:00:00Z");

  it("takes no parts when the end is missing", () => {
    const p = parent("p", "2099-06-15T22:00:00Z", undefined);
    const { events } = compose([p, part()]);
    assert.deepStrictEqual(ids(events), ["p", "x"]);
    assert.strictEqual(events[0], p);
  });

  it("takes no parts when the end is not after the start", () => {
    const { events } = compose([
      parent("p", "2099-06-15T22:00:00Z", "2099-06-15T22:00:00Z"),
      part(),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "x"]);
  });

  it("takes no parts when an all-day parent has no end date", () => {
    const { events } = compose([
      parent("d", "2099-06-15", undefined, { allDay: true }),
      ev("x", "2099-06-15", "2099-06-16", { allDay: true }),
    ]);
    assert.deepStrictEqual(ids(events), ["d", "x"]);
  });
});

describe("sources", () => {
  const P = (extra = {}) =>
    parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z", extra);
  const X = (extra = {}) =>
    ev("x", "2099-06-15T23:00:00Z", "2099-06-16T00:00:00Z", extra);

  it("refuses an entry from another source that has not opted in", () => {
    const { events } = compose([
      P({ _sourceKey: "0" }),
      X({ _sourceKey: "1" }),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "x"]);
  });

  it("takes an entry from another source that carries part-of", () => {
    const { events } = compose([
      P({ _sourceKey: "0" }),
      X({ _sourceKey: "1", partOf: true }),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
  });

  it("prefers a parent from the part's own source to a tighter one from another", () => {
    const { events } = compose([
      parent("own", "2099-06-15T20:00:00Z", "2099-06-16T04:00:00Z", {
        _sourceKey: "1",
      }),
      parent("other", "2099-06-15T22:30:00Z", "2099-06-15T23:30:00Z", {
        _sourceKey: "0",
      }),
      X({ _sourceKey: "1", partOf: true }),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
    assert.deepStrictEqual(partIds(events[1]), []);
  });

  it("treats entries with no key as one source", () => {
    const { events } = compose([P(), X()]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
  });

  it("treats a keyed entry and an unkeyed entry as different sources", () => {
    const { events } = compose([P({ _sourceKey: "0" }), X()]);
    assert.deepStrictEqual(ids(events), ["p", "x"]);
  });

  it("changes nothing for part-of on an entry no parent contains", () => {
    const lone = ev("lone", "2099-06-20T10:00:00Z", "2099-06-20T11:00:00Z", {
      partOf: true,
    });
    const { events } = compose([P(), lone]);
    assert.strictEqual(events[1], lone);
  });

  it("lets standalone win over part-of", () => {
    const { events } = compose([
      P({ _sourceKey: "0" }),
      X({ _sourceKey: "1", partOf: true, standalone: true }),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "x"]);
  });
});

describe("lookup", () => {
  it("resolves a top-level id, a part id, and an unknown id", () => {
    const { lookup } = compose([
      parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z"),
      ev("x", "2099-06-15T23:00:00Z", "2099-06-16T00:00:00Z"),
      ev("solo", "2099-06-20T10:00:00Z", "2099-06-20T11:00:00Z"),
    ]);
    assert.strictEqual(lookup("solo").event.id, "solo");
    assert.strictEqual(lookup("solo").part, null);
    assert.strictEqual(lookup("p").part, null);
    assert.deepStrictEqual(partIds(lookup("p").event), ["x"]);
    assert.strictEqual(lookup("x").event.id, "p");
    // The part object itself, as it sits in the parent's `parts`.
    assert.strictEqual(lookup("x").part, lookup("p").event.parts[0]);
    assert.strictEqual(lookup("x").part.parentId, "p");
    assert.strictEqual(lookup("nope"), null);
  });
});

describe("inputs the rules do not spell out", () => {
  it("does not throw on two entries with one id, and resolves the first", () => {
    const first = ev("dup", "2099-06-15T10:00:00Z", "2099-06-15T11:00:00Z", {
      title: "first",
    });
    const second = ev("dup", "2099-06-16T10:00:00Z", "2099-06-16T11:00:00Z", {
      title: "second",
    });
    const { events, lookup } = compose([first, second]);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(lookup("dup").event.title, "first");
  });

  it("leaves an entry with a missing or malformed start at the top level", () => {
    const { events } = compose([
      parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z"),
      ev("blank", "", ""),
      ev("bad", "not a date", "also not"),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "blank", "bad"]);
  });

  it("reads a timed value with no UTC offset as a wall clock, the same for every viewer", () => {
    // `new Date` would read "2099-06-15T23:00:00" in the viewer's zone, which
    // this file pins to Auckland: 11:00 UTC, outside the parent's hours.
    const { events } = compose([
      parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z"),
      ev("x", "2099-06-15T23:00:00", "2099-06-15T23:30:00"),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["x"]);
  });

  it("composes entries that are all wall-clock times", () => {
    const { events } = compose([
      parent("p", "2099-06-15T17:00:00", "2099-06-15T21:00:00"),
      ev("in", "2099-06-15T18:00:00", "2099-06-15T19:00:00"),
      ev("out", "2099-06-15T21:00:00", "2099-06-15T22:00:00"),
    ]);
    assert.deepStrictEqual(ids(events), ["p", "out"]);
    assert.deepStrictEqual(partIds(events[0]), ["in"]);
  });

  it("takes a wall-clock part of an all-day parent by the date it names", () => {
    // Read in Auckland and then formatted in Chicago, 2 AM on the 9th would
    // land on the 8th.
    const { events } = compose([
      parent("day", "2099-07-09", "2099-07-10"),
      ev("early", "2099-07-09T02:00:00", "2099-07-09T03:00:00"),
    ]);
    assert.deepStrictEqual(partIds(events[0]), ["early"]);
  });

  it("groups the same way through groupParts alone", () => {
    const out = groupParts(
      [
        parent("p", "2099-06-15T22:00:00Z", "2099-06-16T02:00:00Z"),
        ev("x", "2099-06-15T23:00:00Z", "2099-06-16T00:00:00Z"),
      ],
      ZONE,
    );
    assert.deepStrictEqual(ids(out), ["p"]);
  });
});
