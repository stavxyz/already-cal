const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let stableIndex;

before(async () => {
  const mod = await import("../../src/util/hash.js");
  stableIndex = mod.stableIndex;
});

describe("stableIndex", () => {
  it("is deterministic for the same key and length", () => {
    const a = stableIndex("occurrence-42", 5);
    const b = stableIndex("occurrence-42", 5);
    assert.strictEqual(a, b);
  });

  it("stays within [0, length) across many keys", () => {
    for (let i = 0; i < 200; i++) {
      const idx = stableIndex(`key-${i}`, 7);
      assert.ok(idx >= 0 && idx < 7, `index ${idx} out of range for key-${i}`);
    }
  });

  it("returns 0 for length 0", () => {
    assert.strictEqual(stableIndex("anything", 0), 0);
  });

  it("returns 0 for length 1", () => {
    assert.strictEqual(stableIndex("anything", 1), 0);
  });

  it("coerces a non-string key via String()", () => {
    const a = stableIndex(42, 5);
    const b = stableIndex("42", 5);
    assert.strictEqual(a, b);
  });

  it("treats a null or undefined key the same as an empty string", () => {
    assert.strictEqual(stableIndex(null, 5), stableIndex("", 5));
    assert.strictEqual(stableIndex(undefined, 5), stableIndex("", 5));
  });

  it("spreads distinct keys across a length of 3", () => {
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      seen.add(stableIndex(`occurrence-${i}`, 3));
    }
    assert.strictEqual(seen.size, 3, `only hit indices ${[...seen]}`);
  });

  it("matches the standard FNV-1a 32-bit vectors", () => {
    // FNV-1a 32-bit of "a" is 0xe40c292c and of the empty string is the
    // offset basis 0x811c9dc5 (published test vectors).
    assert.strictEqual(stableIndex("a", 1000003), 0xe40c292c % 1000003);
    assert.strictEqual(stableIndex("", 1000003), 0x811c9dc5 % 1000003);
  });

  it("gives a deterministic in-range index for a non-ASCII key", () => {
    const idx = stableIndex("café-2026", 7);
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < 7);
    assert.strictEqual(idx, stableIndex("café-2026", 7));
  });

  it("returns 0 for a NaN or undefined length", () => {
    assert.strictEqual(stableIndex("x", NaN), 0);
    assert.strictEqual(stableIndex("x", undefined), 0);
  });
});
