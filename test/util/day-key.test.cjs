// The viewer's zone decides eventDayKey, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

let dayKeyInZone, eventDayKey, startOrder, toDateKey;

before(async () => {
  ({ dayKeyInZone, eventDayKey, startOrder, toDateKey } = await import(
    "../../src/util/dates.js"
  ));
});

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe("dayKeyInZone", () => {
  it("gives the day in the zone it is asked for", () => {
    // 03:30 UTC on the 16th is the 15th in Chicago and the 16th in Tokyo.
    const instant = "2026-04-16T03:30:00Z";
    assert.strictEqual(dayKeyInZone(instant, "America/Chicago"), "2026-04-15");
    assert.strictEqual(dayKeyInZone(instant, "Asia/Tokyo"), "2026-04-16");
  });

  it("keeps an all-day value on its own date in every zone", () => {
    assert.strictEqual(dayKeyInZone("2026-04-15", "Asia/Tokyo"), "2026-04-15");
    assert.strictEqual(
      dayKeyInZone("2026-04-15", "Pacific/Honolulu"),
      "2026-04-15",
    );
  });

  it("uses the fallback zone, then UTC, for a zone it cannot use", () => {
    const instant = "2026-04-16T03:30:00Z";
    assert.strictEqual(
      dayKeyInZone(instant, "Not/A_Zone", "America/Chicago"),
      "2026-04-15",
    );
    assert.strictEqual(
      dayKeyInZone(instant, undefined, "America/Chicago"),
      "2026-04-15",
    );
    assert.strictEqual(dayKeyInZone(instant, "Not/A_Zone"), "2026-04-16");
  });

  it("returns an empty key for a missing or malformed value", () => {
    assert.strictEqual(dayKeyInZone("", "UTC"), "");
    assert.strictEqual(dayKeyInZone(undefined, "UTC"), "");
    assert.strictEqual(dayKeyInZone("not a date", "UTC"), "");
  });
});

describe("eventDayKey", () => {
  it("files a timed value under the viewer's day", () => {
    // 03:30 UTC on the 16th is 10:30 PM on the 15th in Chicago.
    assert.strictEqual(eventDayKey("2026-04-16T03:30:00Z"), "2026-04-15");
  });

  it("is the key toDateKey gives a local date on the same day", () => {
    assert.strictEqual(
      eventDayKey("2026-04-16T03:30:00Z"),
      toDateKey(new Date(2026, 3, 15)),
    );
    assert.strictEqual(
      eventDayKey("2026-04-15"),
      toDateKey(new Date(2026, 3, 15)),
    );
  });

  it("returns an empty key for a missing or malformed value", () => {
    assert.strictEqual(eventDayKey(""), "");
    assert.strictEqual(eventDayKey("not a date"), "");
  });
});

describe("startOrder", () => {
  it("orders a timed entry at its instant", () => {
    assert.strictEqual(
      startOrder({ start: "2026-04-16T03:30:00Z" }),
      Date.parse("2026-04-16T03:30:00Z"),
    );
  });

  it("orders an all-day entry at the viewer's local midnight of its date", () => {
    // Local midnight, not UTC midnight: in Chicago the two are five hours
    // apart, and an evening event of the day before falls between them.
    assert.strictEqual(
      startOrder({ start: "2026-04-15" }),
      new Date(2026, 3, 15).getTime(),
    );
    assert.ok(
      startOrder({ start: "2026-04-15T03:30:00Z" }) <
        startOrder({ start: "2026-04-15" }),
    );
  });

  it("has no order for a missing or malformed start", () => {
    assert.ok(Number.isNaN(startOrder({ start: "nope" })));
    assert.ok(Number.isNaN(startOrder({})));
  });
});
