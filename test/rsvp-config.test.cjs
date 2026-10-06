require("./setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let Already;
before(async () => {
  Already = await import("../src/already-cal.js");
});

describe("rsvp config defaults", () => {
  it("declares rsvpAllEvents false and onRsvp null", () => {
    assert.strictEqual(Already.DEFAULTS.rsvpAllEvents, false);
    assert.strictEqual(Already.DEFAULTS.onRsvp, null);
  });
});

describe("rsvp i18n defaults", () => {
  it("init supplies the rsvpClosed text a visitor sees for a closed event", async () => {
    const { createTestEvent } = require("./helpers.cjs");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const instance = Already.init({
      el: container,
      defaultView: "grid",
      data: {
        events: [createTestEvent({ id: "e1", rsvp: true })],
        calendar: { name: "Cal", description: "", timezone: "UTC" },
      },
      onRsvp: async () => {
        throw Object.assign(new Error("rsvp: rsvp_unavailable"), {
          code: "rsvp_unavailable",
        });
      },
    });
    try {
      await new Promise((r) => setTimeout(r, 10));
      container.querySelector(".already-rsvp__open").click();
      const form = container.querySelector("form.already-rsvp");
      form.querySelector('input[name="name"]').value = "Larry";
      form.querySelector('input[name="email"]').value = "larry@example.com";
      form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 0));
      assert.strictEqual(
        form.querySelector(".already-rsvp__error").textContent,
        "This event is not taking RSVPs.",
      );
    } finally {
      instance?.destroy?.();
      container.remove();
    }
  });
});
