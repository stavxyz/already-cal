const { describe, it, before } = require("node:test");
const assert = require("node:assert");

// Server-side consumers run enrichGoogleEvent and plainTextDescription on
// event descriptions that anyone who can edit a calendar controls. Each input
// below once made one of the regexes or marked.parse super-linear, taking
// from hundreds of milliseconds to minutes at this length. Every one now
// finishes in a few milliseconds; the 200 ms bound is loose so a slow CI
// machine does not fail it, while a quadratic regression still does.
const LENGTH = 64000;
const BOUND_MS = 200;

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
};

describe(`adversarial ${LENGTH}-character descriptions`, () => {
  let enrichGoogleEvent;
  let plainTextDescription;
  before(async () => {
    ({ enrichGoogleEvent, plainTextDescription } = await import(
      "../src/core.js"
    ));
    // Warm up so one-time JIT and regex compilation isn't timed below.
    for (const make of Object.values(INPUTS)) {
      plainTextDescription(
        enrichGoogleEvent({ id: "w", description: make(200) }, {}),
      );
    }
  });

  for (const [label, make] of Object.entries(INPUTS)) {
    it(`${label}: enrichGoogleEvent plus plainTextDescription under ${BOUND_MS} ms`, () => {
      const description = make(LENGTH);
      assert.strictEqual(description.length, LENGTH);
      const start = performance.now();
      const event = enrichGoogleEvent({ id: "e", description }, {});
      plainTextDescription(event);
      const elapsed = performance.now() - start;
      assert.ok(
        elapsed < BOUND_MS,
        `expected under ${BOUND_MS} ms, took ${elapsed.toFixed(1)} ms`,
      );
    });
  }
});
