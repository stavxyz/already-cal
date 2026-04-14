require("../setup-dom.cjs");
const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderListView;

before(async () => {
  const mod = await import("../../src/views/list.js");
  renderListView = mod.renderListView;
});

beforeEach(() => {
  window.location.hash = "";
});

describe("renderListView", () => {
  it("renders a card for each event", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ id: "1" }), createTestEvent({ id: "2" })];
    renderListView(container, events, "UTC", {});
    assert.strictEqual(
      container.querySelectorAll(".already-card").length,
      2,
    );
  });

  it("displays event title safely via textContent", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ title: "<img src=x onerror=alert(1)>" })];
    renderListView(container, events, "UTC", {});
    const title = container.querySelector(".already-card__title");
    assert.strictEqual(title.textContent, "<img src=x onerror=alert(1)>");
    assert.ok(!title.innerHTML.includes("<img"));
  });

  it("displays date/time meta", () => {
    const container = document.createElement("div");
    const events = [createTestEvent()];
    renderListView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card__meta"));
  });

  it("displays location when present", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ location: "The Venue" })];
    renderListView(container, events, "UTC", {});
    assert.ok(
      container.querySelector(".already-card__location").textContent.includes("The Venue"),
    );
  });

  it("navigates to detail on click", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ id: "nav-test" })];
    renderListView(container, events, "UTC", {});
    container.querySelector(".already-card").click();
    assert.strictEqual(window.location.hash, "#event/nav-test");
  });

  it("does not render hidden events", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "1", hidden: false }),
      createTestEvent({ id: "2", hidden: true }),
    ];
    renderListView(container, events, "UTC", {});
    assert.strictEqual(
      container.querySelectorAll(".already-card").length,
      1,
    );
  });

  it("adds --featured class", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ featured: true })];
    renderListView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card--featured"));
  });

  it("sets data-event-id on each card", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "list-1" }),
      createTestEvent({ id: "list-2" }),
    ];
    renderListView(container, events, "UTC", {});
    const cards = container.querySelectorAll(".already-card");
    assert.strictEqual(cards[0].dataset.eventId, "list-1");
    assert.strictEqual(cards[1].dataset.eventId, "list-2");
  });

  it("sorts featured first within same date", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        id: "1",
        title: "Normal",
        start: "2026-04-15T10:00:00Z",
      }),
      createTestEvent({
        id: "2",
        title: "Featured",
        start: "2026-04-15T14:00:00Z",
        featured: true,
      }),
    ];
    renderListView(container, events, "UTC", {});
    const titles = [...container.querySelectorAll(".already-card__title")].map(
      (t) => t.textContent,
    );
    assert.strictEqual(titles[0], "Featured");
  });

  it("renders cards with horizontal orientation by default", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ image: "https://example.com/img.jpg" })];
    renderListView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card--horizontal"));
  });
});
