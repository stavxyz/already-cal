const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let formatDate, formatDateShort, getDatePartsInTz, formatDateRange;
before(async () => {
  ({ formatDate, formatDateShort, getDatePartsInTz, formatDateRange } =
    await import("../../src/util/dates.js"));
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

describe("formatDateRange — smart-collapse event date ranges (Intl.formatRange)", () => {
  const CT = "America/Chicago"; // UTC-5 in July (CDT)

  it("timed same-day collapses to one date with a time range", () => {
    assert.strictEqual(
      formatDateRange("2026-07-03T20:00:00Z", "2026-07-03T22:00:00Z", {
        timeZone: CT,
      }),
      "Jul 3, 3:00 – 5:00 PM",
    );
  });

  it("timed multi-day shows both date+time endpoints", () => {
    assert.strictEqual(
      formatDateRange("2026-07-03T20:00:00Z", "2026-07-05T18:00:00Z", {
        timeZone: CT,
      }),
      "Jul 3, 3:00 PM – Jul 5, 1:00 PM",
    );
  });

  it("all-day single day (exclusive end −1 collapses) renders one date", () => {
    // Google end.date "2026-07-04" is exclusive → last day is Jul 3.
    assert.strictEqual(
      formatDateRange("2026-07-03", "2026-07-04", { allDay: true }),
      "Jul 3",
    );
  });

  it("all-day multi-day uses the inclusive last day (exclusive end −1)", () => {
    // end.date "2026-07-06" exclusive → last day Jul 5.
    assert.strictEqual(
      formatDateRange("2026-07-03", "2026-07-06", { allDay: true }),
      "Jul 3 – 5",
    );
  });

  it("missing end renders the start alone", () => {
    assert.strictEqual(
      formatDateRange("2026-07-03T20:00:00Z", "", { timeZone: CT }),
      "Jul 3, 3:00 PM",
    );
  });

  it("withTime:false forces a date-only range even for timed events", () => {
    assert.strictEqual(
      formatDateRange("2026-07-03T20:00:00Z", "2026-07-05T18:00:00Z", {
        timeZone: CT,
        withTime: false,
      }),
      "Jul 3 – 5",
    );
  });

  it("end before start (malformed) falls back to start-only", () => {
    assert.strictEqual(
      formatDateRange("2026-07-05T20:00:00Z", "2026-07-03T18:00:00Z", {
        timeZone: CT,
      }),
      "Jul 5, 3:00 PM",
    );
  });

  it("dateStyle:'time' renders a time range only (day-view cell)", () => {
    assert.strictEqual(
      formatDateRange("2026-07-03T20:00:00Z", "2026-07-03T22:00:00Z", {
        timeZone: CT,
        dateStyle: "time",
      }),
      "3:00 – 5:00 PM",
    );
  });

  it("dateStyle:'full' includes both endpoints and a range dash", () => {
    // Full style connects with locale-specific punctuation ("at"/comma) that
    // varies by ICU version, so assert structure, not the exact connector.
    const s = formatDateRange("2026-07-03T20:00:00Z", "2026-07-05T18:00:00Z", {
      timeZone: CT,
      dateStyle: "full",
    });
    assert.ok(s.includes("July 3"), s);
    assert.ok(s.includes("July 5"), s);
    assert.ok(s.includes(" – "), s);
  });

  it("all-day dates render in UTC (no negative-offset −1 shift)", () => {
    assert.strictEqual(
      formatDateRange("2026-08-19", "2026-08-20", {
        allDay: true,
        timeZone: "Pacific/Honolulu", // UTC-10; must NOT shift to Aug 18
      }),
      "Aug 19",
    );
  });

  it("returns empty string for an invalid start date (degrades, no throw)", () => {
    assert.strictEqual(formatDateRange("not-a-date", "2026-07-05", {}), "");
  });
});
