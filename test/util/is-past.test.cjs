// Pin the timezone to a negative-offset (US) zone BEFORE anything reads it, so
// the all-day "past" boundary is deterministic regardless of the runner's TZ.
process.env.TZ = "America/Chicago";

const { describe, it, before, mock } = require("node:test");
const assert = require("node:assert");

let isPast;
before(async () => {
  ({ isPast } = await import("../../src/util/dates.js"));
});

// An Aug 19–20 all-day event → Google sends the EXCLUSIVE `end.date` of
// 2026-08-21. The hide-past filter, pagination, and --past styling all pass
// `event.end || event.start`, so isPast sees this exclusive end.
const EXCLUSIVE_END = "2026-08-21";

function at(iso, fn) {
  mock.timers.enable({ apis: ["Date"], now: new Date(iso).getTime() });
  try {
    fn();
  } finally {
    mock.timers.reset();
  }
}

describe("isPast — all-day (date-only) values key off the viewer's local day", () => {
  it("is NOT past on the evening of the last day (8pm Aug 20, Chicago)", () => {
    // 8pm Aug 20 Chicago = Aug 21 01:00 UTC. A UTC-midnight comparison would
    // wrongly flip the event to past here; local-midnight does not.
    at("2026-08-21T01:00:00Z", () => {
      assert.strictEqual(isPast(EXCLUSIVE_END), false);
    });
  });

  it("is NOT past at noon on the last day (Aug 20, Chicago)", () => {
    at("2026-08-20T17:00:00Z", () => {
      assert.strictEqual(isPast(EXCLUSIVE_END), false);
    });
  });

  it("IS past once the viewer's local date reaches the exclusive end (Aug 21, Chicago)", () => {
    at("2026-08-21T12:00:00Z", () => {
      // 7am Aug 21 Chicago — the event's days (Aug 19–20) are over.
      assert.strictEqual(isPast(EXCLUSIVE_END), true);
    });
  });

  it("a single-day all-day event is not past on its day, past the next day", () => {
    // Aug 19 all-day → exclusive end Aug 20.
    at("2026-08-19T20:00:00Z", () => {
      assert.strictEqual(isPast("2026-08-20"), false); // 3pm Aug 19 Chicago
    });
    at("2026-08-20T20:00:00Z", () => {
      assert.strictEqual(isPast("2026-08-20"), true); // 3pm Aug 20 Chicago
    });
  });

  it("crosses the DST spring-forward boundary at local midnight, not UTC", () => {
    // 2026-03-08 is US spring-forward. An all-day event ending exclusive
    // 2026-03-09 is still upcoming late on Mar 8 (local) and past once the
    // viewer's local Mar 9 begins — the local-midnight parse handles the DST day.
    at("2026-03-09T03:00:00Z", () => {
      assert.strictEqual(isPast("2026-03-09"), false); // ~10pm Mar 8, Chicago
    });
    at("2026-03-09T12:00:00Z", () => {
      assert.strictEqual(isPast("2026-03-09"), true); // morning Mar 9, Chicago
    });
  });

  it("timed events still use instant comparison (unchanged)", () => {
    at("2026-08-20T18:00:00Z", () => {
      assert.strictEqual(isPast("2026-08-20T16:00:00Z"), true); // 2h ago
      assert.strictEqual(isPast("2026-08-20T20:00:00Z"), false); // 2h ahead
    });
  });
});
