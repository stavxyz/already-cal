const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let makeThrottle;

before(async () => {
  const mod = await import("../../src/util/throttle.js");
  makeThrottle = mod.makeThrottle;
});

describe("makeThrottle", () => {
  it("admits the first call (the bug-class this exists to prevent)", () => {
    // The throttle's `-Infinity` sentinel exists specifically because
    // the older `let last = 0` initialization treated "never fired" as
    // "fired at t=0" and silently dropped calls during the page-load
    // dead zone (when performance.now() returns small values).
    // Pin the first-call-admits contract here so a future "cleanup"
    // refactor can't re-introduce the regression.
    let t = 0;
    const tryAdmit = makeThrottle({ thresholdMs: 2000, now: () => t });
    t = 500; // simulating performance.now() at 500ms after timeOrigin
    assert.strictEqual(tryAdmit(), true);
  });

  it("admits first call even when now() returns 0", () => {
    // Even more extreme — clock has not advanced at all.
    const tryAdmit = makeThrottle({ thresholdMs: 2000, now: () => 0 });
    assert.strictEqual(tryAdmit(), true);
  });

  it("rejects second call inside the throttle window", () => {
    let t = 0;
    const tryAdmit = makeThrottle({ thresholdMs: 2000, now: () => t });
    t = 500;
    assert.strictEqual(tryAdmit(), true);
    t = 1000; // 500ms later, still inside the 2000ms window
    assert.strictEqual(tryAdmit(), false);
    t = 2499; // ~1999ms after the admitted call
    assert.strictEqual(tryAdmit(), false);
  });

  it("admits call exactly at the window boundary", () => {
    let t = 0;
    const tryAdmit = makeThrottle({ thresholdMs: 2000, now: () => t });
    t = 500;
    assert.strictEqual(tryAdmit(), true);
    t = 2500; // exactly 2000ms later
    assert.strictEqual(tryAdmit(), true);
  });

  it("admits call past the window boundary", () => {
    let t = 0;
    const tryAdmit = makeThrottle({ thresholdMs: 2000, now: () => t });
    t = 500;
    tryAdmit(); // admit at 500
    t = 3000; // 2500ms later
    assert.strictEqual(tryAdmit(), true);
  });

  it("re-throttles after each admitted call", () => {
    let t = 0;
    const tryAdmit = makeThrottle({ thresholdMs: 1000, now: () => t });
    t = 100;
    assert.strictEqual(tryAdmit(), true); // admit at 100
    t = 500;
    assert.strictEqual(tryAdmit(), false); // 400ms later, throttled
    t = 1200;
    assert.strictEqual(tryAdmit(), true); // 1100ms after admit, admit
    t = 1900;
    assert.strictEqual(tryAdmit(), false); // 700ms after 2nd admit, throttled
    t = 2300;
    assert.strictEqual(tryAdmit(), true); // 1100ms after 2nd admit, admit
  });

  it("instances are independent — state lives in the closure", () => {
    let t = 0;
    const a = makeThrottle({ thresholdMs: 1000, now: () => t });
    const b = makeThrottle({ thresholdMs: 1000, now: () => t });
    t = 0;
    assert.strictEqual(a(), true);
    assert.strictEqual(b(), true);
    t = 500;
    assert.strictEqual(a(), false); // throttled
    assert.strictEqual(b(), false); // throttled independently
    t = 1100;
    assert.strictEqual(a(), true);
    assert.strictEqual(b(), true);
  });

  it("handles a clock that doesn't advance — only the first call admits", () => {
    const tryAdmit = makeThrottle({ thresholdMs: 1000, now: () => 100 });
    assert.strictEqual(tryAdmit(), true);
    assert.strictEqual(tryAdmit(), false);
    assert.strictEqual(tryAdmit(), false);
  });
});
