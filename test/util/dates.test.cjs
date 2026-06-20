const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let formatDate, formatDateShort, getDatePartsInTz;
before(async () => {
  ({ formatDate, formatDateShort, getDatePartsInTz } = await import(
    "../../src/util/dates.js"
  ));
});

describe("all-day (date-only) dates render on the entered calendar date regardless of timezone", () => {
  // Regression: a Google all-day event's start/end is a bare `YYYY-MM-DD` with
  // no time component. `new Date("2026-08-19")` is UTC midnight; formatting it
  // in a US timezone (UTC-5/-6) shifted it back a day (Aug 19 → Aug 18). An
  // all-day date is absolute — it must render as the entered date everywhere.
  it("formatDate keeps the date in a US timezone (no -1 day shift)", () => {
    assert.strictEqual(
      formatDate("2026-08-19", "America/Chicago"),
      "Wednesday, August 19, 2026",
    );
  });

  it("formatDate keeps the date in an extreme negative-offset timezone", () => {
    assert.strictEqual(
      formatDate("2026-08-19", "Pacific/Honolulu"), // UTC-10
      "Wednesday, August 19, 2026",
    );
  });

  it("formatDateShort keeps the date in a US timezone", () => {
    assert.strictEqual(
      formatDateShort("2026-08-19", "America/Chicago"),
      "Aug 19",
    );
  });

  it("getDatePartsInTz places the date on the entered day (grid placement)", () => {
    assert.deepStrictEqual(getDatePartsInTz("2026-08-19", "America/Chicago"), {
      year: 2026,
      month: 7, // 0-indexed August
      day: 19,
    });
  });

  it("timed events still convert to the viewer timezone (unchanged)", () => {
    // 16:00 at -05:00 renders as 16:00 in Chicago — date stays April 4.
    assert.strictEqual(
      formatDate("2026-04-04T16:00:00-05:00", "America/Chicago"),
      "Saturday, April 4, 2026",
    );
  });

  it("timed events near midnight still shift by timezone (unchanged)", () => {
    // 00:30 UTC Apr 5 is 19:30 CDT Apr 4 — must remain a timed conversion,
    // NOT be treated as an absolute date.
    assert.strictEqual(
      formatDate("2026-04-05T00:30:00Z", "America/Chicago"),
      "Saturday, April 4, 2026",
    );
  });
});
