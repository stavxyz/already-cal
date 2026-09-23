const { describe, it, before } = require("node:test");
const assert = require("node:assert");
// Cross-repo parity table, extracted to its own fixture because a downstream
// consumer that vendors this widget machine-parses it: see that file's
// header before reshaping it.
const { ZONE_ABBREV_CASES } = require("../fixtures/zone-abbrev-parity.cjs");

let formatDate,
  formatDateShort,
  getDatePartsInTz,
  formatDateRange,
  formatEventWhen,
  viewerTimeZone,
  zoneAbbrev,
  wallClockDiffers,
  resolveTimeZone;
before(async () => {
  ({
    formatDate,
    formatDateShort,
    getDatePartsInTz,
    formatDateRange,
    formatEventWhen,
    viewerTimeZone,
    zoneAbbrev,
    wallClockDiffers,
    resolveTimeZone,
  } = await import("../../src/util/dates.js"));
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

describe("formatDate/formatDateShort — malformed calendar-level timezone guard", () => {
  // Regression: `data.calendar.timezone` (from the worker's googleData.timeZone)
  // reaches these two exported formatters directly — e.g. day.js's nav title
  // and week.js's range labels — with no per-event normalisation in front of
  // it. Intl.DateTimeFormat throws a RangeError on an unknown zone, which used
  // to take the whole view down. Both formatters must run the zone through
  // resolveTimeZone (same helper formatEventWhen already uses) and degrade to
  // UTC instead of throwing.
  it("formatDate does not throw on a malformed zone and falls back to UTC", () => {
    let out;
    assert.doesNotThrow(() => {
      out = formatDate("2026-07-15T15:00:00Z", "Not/AZone");
    });
    assert.strictEqual(out, "Wednesday, July 15, 2026");
  });

  it("formatDateShort does not throw on a malformed zone and falls back to UTC", () => {
    let out;
    assert.doesNotThrow(() => {
      out = formatDateShort("2026-07-15T15:00:00Z", "Not/AZone");
    });
    assert.strictEqual(out, "Jul 15");
  });

  it("all-day (date-only) values stay UTC-anchored even with a malformed zone", () => {
    // zoneFor forces UTC for date-only values regardless of the timezone
    // argument — the malformed-zone guard must not disturb that.
    assert.strictEqual(
      formatDate("2026-08-19", "Not/AZone"),
      "Wednesday, August 19, 2026",
    );
  });

  it("still honors a valid timezone unchanged (no behavior change)", () => {
    assert.strictEqual(
      formatDate("2026-07-15T15:00:00Z", "America/Chicago"),
      "Wednesday, July 15, 2026",
    );
    assert.strictEqual(
      formatDateShort("2026-07-15T15:00:00Z", "America/Chicago"),
      "Jul 15",
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

  it("handles a timed multi-day range that crosses a DST transition", () => {
    // US spring-forward is 2026-03-08 02:00 local. The start is CST (UTC-6) and
    // the end is CDT (UTC-5); formatRange operates on instants, so each endpoint
    // renders in its own correct wall-clock time across the transition.
    assert.strictEqual(
      formatDateRange("2026-03-07T20:00:00Z", "2026-03-09T18:00:00Z", {
        timeZone: "America/Chicago",
      }),
      "Mar 7, 2:00 PM – Mar 9, 1:00 PM",
    );
  });
});

describe("zone helpers", () => {
  it("viewerTimeZone returns a non-empty IANA string", () => {
    const tz = viewerTimeZone();
    assert.ok(typeof tz === "string" && tz.length > 0);
  });
  it("wallClockDiffers is true across different-offset zones, false for same zone", () => {
    assert.strictEqual(
      wallClockDiffers(
        "2026-07-15T15:00:00Z",
        "America/New_York",
        "America/Chicago",
      ),
      true,
    );
    assert.strictEqual(
      wallClockDiffers(
        "2026-07-15T15:00:00Z",
        "America/New_York",
        "America/New_York",
      ),
      false,
    );
  });

  it("zoneAbbrev matches the shared parity table under this runtime's Intl", () => {
    // Tripwire: the loop below asserts nothing at all if the table is emptied
    // (or silently truncated by a bad merge), so it would pass vacuously.
    assert.ok(
      ZONE_ABBREV_CASES.length >= 6,
      `parity table shrank to ${ZONE_ABBREV_CASES.length} rows`,
    );
    for (const c of ZONE_ABBREV_CASES) {
      assert.strictEqual(
        zoneAbbrev(c.instant, c.zone),
        c.abbrev,
        `${c.zone} @ ${c.instant}`,
      );
    }
  });
});

describe("formatEventWhen", () => {
  const nyEvent = {
    start: "2026-07-15T15:00:00-04:00",
    end: "2026-07-15T16:00:00-04:00",
    allDay: false,
    _sourceTimeZone: "America/New_York",
  };

  it("appends the source label + abbrev when source differs from viewer", () => {
    // Pin the viewer zone rather than branching on the live one: a runtime
    // `if (wallClockDiffers(...))` meant this test quietly stopped exercising
    // the suffix branch — the whole point of it — for anyone running in
    // Eastern time, and asserted nothing but the absence of a middot.
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "America/Chicago";
      const out = formatEventWhen(nyEvent, {
        sourceZoneFallback: "UTC", // must LOSE to the event's _sourceTimeZone
        locale: "en-US",
        dateStyle: "short",
      });
      // Viewer is Central (2:00 PM), source is the event's own Eastern zone.
      assert.match(out, / · /, out);
      assert.strictEqual(out, "Jul 15, 2:00 – 3:00 PM · 3:00 PM EDT");
      // The fallback would have produced a UTC suffix; _sourceTimeZone wins.
      assert.doesNotMatch(out, /UTC/, out);
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("omits the source suffix when the viewer already sees the source wall clock", () => {
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const out = formatEventWhen(nyEvent, {
        sourceZoneFallback: "America/Chicago",
        locale: "en-US",
        dateStyle: "short",
      });
      assert.doesNotMatch(out, / · /, out); // viewer is Eastern → no suffix
      assert.strictEqual(
        wallClockDiffers(nyEvent.start, "America/New_York", viewerTimeZone()),
        false,
      );
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("all-day events get no source suffix", () => {
    const out = formatEventWhen(
      {
        start: "2026-08-19",
        end: "2026-08-20",
        allDay: true,
        _sourceTimeZone: "America/New_York",
      },
      { sourceZoneFallback: "America/Chicago", dateStyle: "short" },
    );
    assert.doesNotMatch(out, / · /);
  });

  it("renders the source suffix as a single start time (single-day)", () => {
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const out = formatEventWhen(
        {
          start: "2026-07-15T19:00:00Z",
          end: "2026-07-15T21:00:00Z",
          allDay: false,
          _sourceTimeZone: "America/New_York",
        },
        { dateStyle: "short" },
      );
      // Primary is the viewer-local range (no abbrev); the suffix is ONE
      // source-zone time + abbrev, per the spec form "8:00 PM · 3:00 PM EDT".
      assert.strictEqual(out, "Jul 15, 7:00 – 9:00 PM · 3:00 PM EDT");
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("renders offset-style source abbreviations in the suffix", () => {
    // The parity table pins zoneAbbrev in isolation, but every other render
    // assertion here uses a three-letter abbrev. Offset labels are the reason
    // those rows exist: they are longer, and the sub-hour ones carry a colon,
    // so exercise both through the actual " · {time} {abbrev}" suffix.
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const base = {
        start: "2026-07-15T19:00:00Z",
        end: "2026-07-15T21:00:00Z",
        allDay: false,
      };
      assert.strictEqual(
        formatEventWhen(
          { ...base, _sourceTimeZone: "Pacific/Auckland" },
          { locale: "en-US", dateStyle: "short" },
        ),
        "Jul 15, 7:00 – 9:00 PM · 7:00 AM GMT+12",
      );
      assert.strictEqual(
        formatEventWhen(
          { ...base, _sourceTimeZone: "Asia/Kolkata" },
          { locale: "en-US", dateStyle: "short" },
        ),
        "Jul 15, 7:00 – 9:00 PM · 12:30 AM GMT+5:30",
      );
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("keeps numeric dates out of the source suffix for a multi-day span", () => {
    // Regression: the suffix used to pass the event's full `end` with
    // dateStyle:"time". For a span crossing midnight ICU disambiguates the two
    // endpoints by injecting numeric dates — "7/15/2026, 3:00 PM – 7/16/2026,
    // 11:00 PM" — which violates the widget's house style. The suffix must be
    // the source-zone START time only.
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const out = formatEventWhen(
        {
          start: "2026-07-15T19:00:00Z",
          end: "2026-07-17T03:00:00Z",
          allDay: false,
          _sourceTimeZone: "America/New_York",
        },
        { dateStyle: "short" },
      );
      const suffix = out.split(" · ")[1];
      assert.ok(suffix, `expected a source suffix, got: ${out}`);
      assert.doesNotMatch(
        suffix,
        /\d+\/\d+/,
        `suffix must not contain a numeric date, got: ${suffix}`,
      );
      assert.strictEqual(suffix, "3:00 PM EDT");
      // The primary half still shows the full viewer-local multi-day range.
      assert.strictEqual(
        out.split(" · ")[0],
        "Jul 15, 7:00 PM – Jul 17, 3:00 AM",
      );
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("falls back to sourceZoneFallback when the event has no _sourceTimeZone", () => {
    // Pin the viewer zone to UTC for just this test so the assertion is
    // deterministic across machines, and restore it afterward. Restoring must
    // branch on `undefined`: `process.env.TZ = undefined` writes the literal
    // string "undefined", which leaves every later Intl call in this process
    // resolving to an unset/UTC zone rather than the runner's real zone.
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const out = formatEventWhen(
        {
          start: "2026-07-15T15:00:00Z",
          end: "2026-07-15T16:00:00Z",
          allDay: false,
        },
        { sourceZoneFallback: "America/New_York", dateStyle: "short" },
      );
      // Viewer is UTC, source falls back to America/New_York (EDT in July),
      // so the wall clocks differ and the source suffix must appear —
      // proving sourceZoneFallback actually drove the output.
      assert.match(out, / · /);
      assert.match(out, /EDT/);
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("degrades instead of throwing on a malformed _sourceTimeZone", () => {
    // Regression: Intl.DateTimeFormat throws a RangeError on an unknown zone.
    // The day view, the detail view and setEventMeta all render OUTSIDE
    // safeRenderCard's per-card isolation, so one bad zone in the payload used
    // to take down the entire view. resolveTimeZone normalises it away.
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const event = {
        start: "2026-07-15T15:00:00Z",
        end: "2026-07-15T16:00:00Z",
        allDay: false,
        _sourceTimeZone: "Not/AZone",
      };
      let out;
      assert.doesNotThrow(() => {
        out = formatEventWhen(event, {
          sourceZoneFallback: "America/New_York",
          dateStyle: "short",
        });
      });
      // Falls back to sourceZoneFallback (EDT in July), which differs from the
      // pinned UTC viewer zone — so the suffix still renders, just anchored to
      // the fallback rather than the unusable zone.
      assert.match(out, /Jul 15/);
      assert.match(out, / · /);
      assert.match(out, /EDT/);
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });

  it("falls back all the way to UTC when both zones are malformed", () => {
    const origTZ = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      let out;
      assert.doesNotThrow(() => {
        out = formatEventWhen(
          {
            start: "2026-07-15T15:00:00Z",
            end: "2026-07-15T16:00:00Z",
            allDay: false,
            _sourceTimeZone: "Not/AZone",
          },
          { sourceZoneFallback: "Also/Bogus", dateStyle: "short" },
        );
      });
      // Viewer is Eastern, source degrades to UTC → wall clocks differ → the
      // suffix renders the UTC time rather than blowing up.
      assert.match(out, / · /);
      assert.match(out, /UTC/);
    } finally {
      if (origTZ === undefined) delete process.env.TZ;
      else process.env.TZ = origTZ;
    }
  });
});

describe("resolveTimeZone", () => {
  it("returns a valid zone unchanged", () => {
    assert.strictEqual(
      resolveTimeZone("America/New_York", "UTC"),
      "America/New_York",
    );
  });

  it("falls back when the preferred zone is malformed", () => {
    assert.strictEqual(
      resolveTimeZone("Not/AZone", "America/Chicago"),
      "America/Chicago",
    );
  });

  it("falls back when the preferred zone is missing", () => {
    assert.strictEqual(
      resolveTimeZone(undefined, "Europe/Paris"),
      "Europe/Paris",
    );
  });

  it("ends at UTC when nothing is usable", () => {
    assert.strictEqual(resolveTimeZone("Not/AZone", "Also/Bogus"), "UTC");
    assert.strictEqual(resolveTimeZone(), "UTC");
  });
});
