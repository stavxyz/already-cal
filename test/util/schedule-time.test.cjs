// The label's "same day" is the VIEWER's day, so pin the zone before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

let formatScheduleTime;

before(async () => {
  ({ formatScheduleTime } = await import("../../src/util/dates.js"));
});

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const opts = {
  sourceZoneFallback: "America/Chicago",
  locale: "en-US",
  allDayLabel: "All Day",
};

// The dashes in the expected strings are the date formatter's own output.
describe("formatScheduleTime", () => {
  it("shows the given label for an all-day event", () => {
    assert.strictEqual(
      formatScheduleTime(
        { start: "2026-04-15", end: "2026-04-16", allDay: true },
        { ...opts, allDayLabel: "Whole day" },
      ),
      "Whole day",
    );
  });

  it("shows a range for an event that ends on the day it starts", () => {
    // 3 PM to 5 PM in Chicago.
    assert.strictEqual(
      formatScheduleTime(
        { start: "2026-04-15T20:00:00Z", end: "2026-04-15T22:00:00Z" },
        opts,
      ),
      "3:00 – 5:00 PM",
    );
  });

  it("decides the day in the viewer's zone, not in UTC", () => {
    // 6 PM to 8 PM in Chicago, which crosses midnight in UTC.
    assert.strictEqual(
      formatScheduleTime(
        { start: "2026-04-15T23:00:00Z", end: "2026-04-16T01:00:00Z" },
        opts,
      ),
      "6:00 – 8:00 PM",
    );
  });

  it("shows only the start for an event that runs into another day", () => {
    // 6 PM on the 15th to 9 PM on the 16th in Chicago.
    assert.strictEqual(
      formatScheduleTime(
        { start: "2026-04-15T23:00:00Z", end: "2026-04-17T02:00:00Z" },
        opts,
      ),
      "6:00 PM",
    );
  });

  it("shows only the start when the end is missing or malformed", () => {
    assert.strictEqual(
      formatScheduleTime({ start: "2026-04-15T20:00:00Z" }, opts),
      "3:00 PM",
    );
    assert.strictEqual(
      formatScheduleTime({ start: "2026-04-15T20:00:00Z", end: "nope" }, opts),
      "3:00 PM",
    );
  });

  it("keeps the source zone suffix of an event from another zone", () => {
    assert.strictEqual(
      formatScheduleTime(
        {
          start: "2026-08-19T19:00:00Z",
          end: "2026-08-19T20:00:00Z",
          _sourceTimeZone: "America/New_York",
        },
        opts,
      ),
      "2:00 – 3:00 PM · 3:00 PM EDT",
    );
  });

  it("returns an empty label for a missing start", () => {
    assert.strictEqual(formatScheduleTime({ start: "" }, opts), "");
  });
});
