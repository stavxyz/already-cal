const { describe, it, before } = require("node:test");
const assert = require("node:assert");

// Composition compares each part candidate with each parent, so its worst
// case is a list that is half parents. 2,000 entries is far above what a
// view carries, and this keeps a change that made the comparison expensive,
// or the algorithm worse than quadratic, from landing unnoticed. The ceiling
// is absolute and generous. Run with `npm run test:perf`, not inside the
// parallel `npm test`, whose other test files skew timings.
const ENTRIES = 2000;
const CEILING_MS = 1000;
const RUNS = 3;

let composeEvents;
before(async () => {
  ({ composeEvents } = await import("../../src/composite.js"));
});

function build() {
  const base = Date.parse("2099-01-01T00:00:00Z");
  const hour = 3_600_000;
  const iso = (ms) => new Date(ms).toISOString();
  const events = [];
  for (let i = 0; i < ENTRIES / 2; i++) {
    const start = base + i * hour;
    events.push({
      id: `parent-${i}`,
      title: `Parent ${i}`,
      start: iso(start),
      end: iso(start + 2 * hour),
      composite: true,
    });
    events.push({
      id: `part-${i}`,
      title: `Part ${i}`,
      start: iso(start + hour / 2),
      end: iso(start + hour),
    });
  }
  return events;
}

describe("composition cost", () => {
  it(`composes ${ENTRIES} entries, half of them parents, within ${CEILING_MS} ms`, () => {
    const events = build();
    let best = Number.POSITIVE_INFINITY;
    let result = null;
    for (let run = 0; run < RUNS; run++) {
      const started = performance.now();
      result = composeEvents(events, { timeZone: "America/Chicago" });
      best = Math.min(best, performance.now() - started);
    }
    assert.strictEqual(result.events.length, ENTRIES / 2);
    assert.ok(
      best < CEILING_MS,
      `composeEvents took ${best.toFixed(1)} ms for ${ENTRIES} entries`,
    );
  });
});

// The all-day parent path formats each timed entry's date in its own zone
// through Intl, once per entry, which the timed fixture above never reaches.
// That is the costliest work per entry, so this case gets its own ceiling.
const ALL_DAY_CEILING_MS = 2000;

function buildAllDay() {
  const day = 86_400_000;
  const base = Date.parse("2099-01-01T00:00:00Z");
  const date = (ms) => new Date(ms).toISOString().slice(0, 10);
  const events = [];
  for (let i = 0; i < ENTRIES / 2; i++) {
    const start = base + i * day;
    events.push({
      id: `parent-${i}`,
      title: `Parent ${i}`,
      start: date(start),
      end: date(start + day),
      allDay: true,
      composite: true,
    });
    events.push({
      id: `part-${i}`,
      title: `Part ${i}`,
      start: new Date(start + 12 * 3_600_000).toISOString(),
      end: new Date(start + 13 * 3_600_000).toISOString(),
    });
  }
  return events;
}

describe("composition cost with all-day parents", () => {
  it(`composes ${ENTRIES} entries under all-day parents within ${ALL_DAY_CEILING_MS} ms`, () => {
    const events = buildAllDay();
    let best = Number.POSITIVE_INFINITY;
    let result = null;
    for (let run = 0; run < RUNS; run++) {
      const started = performance.now();
      result = composeEvents(events, { timeZone: "America/Chicago" });
      best = Math.min(best, performance.now() - started);
    }
    assert.strictEqual(result.events.length, ENTRIES / 2);
    assert.ok(
      result.events.every((e) => e.parts?.length === 1),
      "every all-day parent took exactly one part",
    );
    assert.ok(
      best < ALL_DAY_CEILING_MS,
      `composeEvents took ${best.toFixed(1)} ms for ${ENTRIES} entries`,
    );
  });
});
