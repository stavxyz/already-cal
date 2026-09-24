const { describe, it, before } = require("node:test");
const assert = require("node:assert");

// Server-side consumers run enrichGoogleEvent and plainTextDescription on
// event descriptions that anyone who can edit a calendar controls. Each input
// below once made one of the regexes or marked.parse super-linear. Each test
// times the input at 128,000 and at 512,000 characters, taking runs
// alternately so a burst of machine load hits both lengths, and requires the
// best longer run to take less than 8 times as long as the best shorter run,
// plus a few milliseconds for timer noise on inputs that finish in under a
// millisecond. It takes at least 3 runs of each and, while the ratio is over,
// up to 9, because load from parallel test files can slow every run of one
// length for a while.
// Linear work grows about 4 times over that step and quadratic work about 16
// times, so the ratio separates them without depending on how fast the
// machine is. The absolute ceiling at 512,000 characters catches a cost that
// is large at both lengths, such as a Markdown parse limit raised far enough
// that marked's cubic cost dominates.
const SHORT = 128000;
const LONG = 512000;
const MAX_GROWTH = 8;
const NOISE_MS = 10;
const CEILING_MS = 1000;
const MIN_RUNS = 3;
const MAX_RUNS = 9;

function repeatTo(unit, length) {
  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
}

function sequenceTo(unit, length) {
  let out = "";
  for (let i = 0; out.length < length; i++) out += unit(i);
  return out.slice(0, length);
}

const INPUTS = {
  '"[a](" repeated': (n) => repeatTo("[a](", n),
  '"**a" repeated': (n) => repeatTo("**a", n),
  '"__a" repeated': (n) => repeatTo("__a", n),
  '"# " lines': (n) => repeatTo("# \n", n),
  '"- " lines': (n) => repeatTo("- \n", n),
  '"<a " repeated': (n) => repeatTo("<a ", n),
  'unclosed "<" repeated': (n) => repeatTo("<", n),
  '"&#" and digits': (n) => `&#${"1".repeat(n - 2)}`,
  '"&#1" repeated': (n) => repeatTo("&#1", n),
  '"http://" repeated': (n) => repeatTo("http://", n),
  "one long URL": (n) => `https://example.com/${"a".repeat(n - 20)}`,
  '"#already:" repeated': (n) => repeatTo("#already:", n),
  '"#already:x" lines': (n) => repeatTo("#already:x \n", n),
  '"// " comment lines': (n) => repeatTo("// x\n", n),
  "Markdown with unclosed links": (n) => `**x** ${repeatTo("[a](", n - 6)}`,
  "Markdown with unclosed image links": (n) =>
    `**x** ${repeatTo("![a](", n - 6)}`,
  "one long whitespace run": (n) => `a${" ".repeat(n - 2)}b`,
  "<br> then a long whitespace run": (n) => `x<br>${" ".repeat(n - 6)}y`,
  "URL path of slashes": (n) => `https://x.com${"/".repeat(n - 14)}a`,
  "Eventbrite URL of digits": (n) =>
    `https://eventbrite.com/e/${"1".repeat(n - 26)}a`,
  "distinct PDF URLs": (n) => sequenceTo((i) => `https://a.co/${i}.pdf `, n),
  "distinct image URLs": (n) => sequenceTo((i) => `https://a.co/${i}.png `, n),
  "distinct directives": (n) => sequenceTo((i) => `#already:tag:t${i}\n`, n),
  // With no space or newline to cut at, marked gets the whole parse limit of
  // "[](", the slowest input found for it, so raising the limit shows here.
  "Markdown with unclosed empty links and no spaces": (n) =>
    `**x**${repeatTo("[](", n - 5)}`,
  "Markdown with unclosed empty image links and no spaces": (n) =>
    `**x**${repeatTo("![](", n - 5)}`,
};

function time(enrichGoogleEvent, plainTextDescription, description) {
  const start = performance.now();
  const event = enrichGoogleEvent({ id: "e", description }, {});
  plainTextDescription(event);
  return performance.now() - start;
}

describe("adversarial descriptions", () => {
  let enrichGoogleEvent;
  let plainTextDescription;
  before(async () => {
    ({ enrichGoogleEvent, plainTextDescription } = await import(
      "../../src/core.js"
    ));
    // Warm up so one-time JIT and regex compilation isn't timed below.
    for (const make of Object.values(INPUTS)) {
      plainTextDescription(
        enrichGoogleEvent({ id: "w", description: make(1000) }, {}),
      );
    }
  });

  for (const [label, make] of Object.entries(INPUTS)) {
    it(`${label}: time grows less than ${MAX_GROWTH}x from ${SHORT} to ${LONG} characters`, () => {
      const short = make(SHORT);
      const long = make(LONG);
      assert.strictEqual(short.length, SHORT);
      assert.strictEqual(long.length, LONG);
      let tShort = Number.POSITIVE_INFINITY;
      let tLong = Number.POSITIVE_INFINITY;
      for (let run = 1; run <= MAX_RUNS; run++) {
        tShort = Math.min(
          tShort,
          time(enrichGoogleEvent, plainTextDescription, short),
        );
        tLong = Math.min(
          tLong,
          time(enrichGoogleEvent, plainTextDescription, long),
        );
        if (run >= MIN_RUNS && tLong < MAX_GROWTH * tShort + NOISE_MS) break;
      }
      const times = `${tShort.toFixed(1)} ms at ${SHORT}, ${tLong.toFixed(1)} ms at ${LONG}`;
      assert.ok(tLong < MAX_GROWTH * tShort + NOISE_MS, times);
      assert.ok(tLong < CEILING_MS, times);
    });
  }
});
