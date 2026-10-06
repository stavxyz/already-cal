// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "America/Chicago";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let placeByDay, eventDayKey;

before(async () => {
  ({ placeByDay } = await import("../../src/views/placement.js"));
  ({ eventDayKey } = await import("../../src/util/dates.js"));
});

after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const place = (events) => placeByDay(events, eventDayKey);
const ids = (list) => (list || []).map((e) => e.id);

// Chicago days. The 19th is a Friday.
const FRI = "2099-06-19";
const SAT = "2099-06-20";

const at = (id, start) => createTestEvent({ id, start, end: start });

// A two-day parent in Chicago time: Friday 6 PM to Saturday 9 PM.
const twoDay = (parts) =>
  createComposite(
    { start: "2099-06-19T23:00:00Z", end: "2099-06-21T02:00:00Z" },
    parts,
  );
// Its part in several cases below starts on Saturday at 7 PM.
const saturdayPart = () =>
  twoDay([{ start: "2099-06-21T00:00:00Z", end: "2099-06-21T01:00:00Z" }]);

describe("placeByDay", () => {
  it("files ordinary events under their days, as the same objects, with nothing folded", () => {
    const a = at("a", "2099-06-19T15:00:00Z");
    const b = at("b", "2099-06-20T15:00:00Z");
    const { byDay, sameDayParts } = place([a, b]);
    assert.strictEqual(byDay.size, 2);
    assert.strictEqual(byDay.get(FRI)[0], a);
    assert.strictEqual(byDay.get(SAT)[0], b);
    assert.strictEqual(sameDayParts.size, 0);
  });

  it("keeps the events of one day in the order they came in", () => {
    // The widget does not sort what a producer hands it, and neither does this.
    const evening = at("evening", "2099-06-20T01:00:00Z");
    const morning = at("morning", "2099-06-19T15:00:00Z");
    assert.deepStrictEqual(ids(place([evening, morning]).byDay.get(FRI)), [
      "evening",
      "morning",
    ]);
  });

  it("files an event with no usable start under no day", () => {
    const { byDay } = place([at("bad", "not a date"), at("blank", "")]);
    assert.strictEqual(byDay.size, 0);
  });

  it("folds a same-day part into the lookup and files it under no day", () => {
    const parent = twoDay([
      { start: "2099-06-20T00:00:00Z", end: "2099-06-20T01:00:00Z" },
    ]);
    const { byDay, sameDayParts } = place([parent]);
    assert.deepStrictEqual(ids(byDay.get(FRI)), ["parent"]);
    assert.strictEqual(byDay.has(SAT), false);
    assert.deepStrictEqual(ids(sameDayParts.get("parent")), ["part-1"]);
  });

  it("files a part on another day under that day, with parentId", () => {
    const { byDay, sameDayParts } = place([saturdayPart()]);
    assert.deepStrictEqual(ids(byDay.get(FRI)), ["parent"]);
    assert.deepStrictEqual(ids(byDay.get(SAT)), ["part-1"]);
    assert.strictEqual(byDay.get(SAT)[0].parentId, "parent");
    assert.strictEqual(sameDayParts.has("parent"), false);
  });

  it("leaves every part on the parent it files", () => {
    const parent = twoDay([
      { start: "2099-06-20T00:00:00Z", end: "2099-06-20T01:00:00Z" },
      { start: "2099-06-21T00:00:00Z", end: "2099-06-21T01:00:00Z" },
    ]);
    const { byDay } = place([parent]);
    assert.strictEqual(byDay.get(FRI)[0], parent);
    assert.strictEqual(byDay.get(FRI)[0].parts.length, 2);
  });

  it("puts a second listing on the parent's day in neither place", () => {
    const parent = twoDay([
      {
        title: "PARENT!",
        start: "2099-06-20T00:00:00Z",
        end: "2099-06-20T01:00:00Z",
      },
    ]);
    const { byDay, sameDayParts } = place([parent]);
    assert.deepStrictEqual(ids(byDay.get(FRI)), ["parent"]);
    assert.strictEqual(byDay.has(SAT), false);
    assert.strictEqual(sameDayParts.has("parent"), false);
  });

  it("files a second listing on another day under that day", () => {
    const parent = twoDay([
      {
        title: "PARENT!",
        start: "2099-06-21T00:00:00Z",
        end: "2099-06-21T01:00:00Z",
      },
    ]);
    assert.deepStrictEqual(ids(place([parent]).byDay.get(SAT)), ["part-1"]);
  });

  it("files a part by the viewer's day, so one just after local midnight is on the next day", () => {
    // 05:30 UTC on the 20th is 12:30 AM on the 20th in Chicago. The parent
    // starts at 6 PM on the 19th.
    const parent = twoDay([
      { start: "2099-06-20T05:30:00Z", end: "2099-06-20T06:00:00Z" },
    ]);
    const { byDay, sameDayParts } = place([parent]);
    assert.deepStrictEqual(ids(byDay.get(SAT)), ["part-1"]);
    assert.strictEqual(sameDayParts.has("parent"), false);
  });

  it("files a part with no usable start under no day", () => {
    const parent = twoDay([{ start: "bad", end: "bad" }]);
    const { byDay, sameDayParts } = place([parent]);
    assert.strictEqual(byDay.has(""), false);
    for (const items of byDay.values()) {
      assert.ok(!ids(items).includes("part-1"));
    }
    assert.deepStrictEqual(ids(byDay.get(FRI)), ["parent"]);
    assert.strictEqual(sameDayParts.size, 0);
  });

  it("puts a part after the earlier events of its day", () => {
    const afternoon = at("afternoon", "2099-06-20T18:00:00Z");
    assert.deepStrictEqual(
      ids(place([saturdayPart(), afternoon]).byDay.get(SAT)),
      ["afternoon", "part-1"],
    );
  });

  it("puts a part before a later event of its day", () => {
    const night = at("night", "2099-06-21T02:00:00Z");
    assert.deepStrictEqual(ids(place([saturdayPart(), night]).byDay.get(SAT)), [
      "part-1",
      "night",
    ]);
  });

  it("places a part among its day's events whatever order the list is in", () => {
    // A producer's list need not be in time order. The part's place depends
    // only on the events of its own day.
    const nextWeek = at("next-week", "2099-06-30T18:00:00Z");
    const afternoon = at("afternoon", "2099-06-20T18:00:00Z");
    const { byDay } = place([saturdayPart(), nextWeek, afternoon]);
    assert.deepStrictEqual(ids(byDay.get(SAT)), ["afternoon", "part-1"]);
    assert.deepStrictEqual(ids(byDay.get("2099-06-30")), ["next-week"]);
  });

  it("orders two parts of one day by start", () => {
    const parent = twoDay([
      { start: "2099-06-21T01:00:00Z", end: "2099-06-21T02:00:00Z" },
      { start: "2099-06-21T00:00:00Z", end: "2099-06-21T00:30:00Z" },
    ]);
    assert.deepStrictEqual(ids(place([parent]).byDay.get(SAT)), [
      "part-2",
      "part-1",
    ]);
  });
});
