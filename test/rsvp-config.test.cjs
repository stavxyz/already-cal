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

const { createTestEvent } = require("./helpers.cjs");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function mount(extra) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = Already.init({
    el: container,
    defaultView: "grid",
    data: {
      events: [createTestEvent({ id: "e1", rsvp: true })],
      calendar: { name: "Cal", description: "", timezone: "UTC" },
    },
    onRsvp: async () => {},
    ...extra,
  });
  return {
    container,
    destroy: () => {
      instance?.destroy?.();
      container.remove();
    },
  };
}

describe("rsvp i18n through init", () => {
  it("a host's i18n.rsvpClosed reaches the form over the default", async () => {
    const { container, destroy } = mount({
      i18n: { rsvpClosed: "Host text" },
      onRsvp: async () => {
        throw Object.assign(new Error("rsvp: rsvp_unavailable"), {
          code: "rsvp_unavailable",
        });
      },
    });
    try {
      await tick(10);
      container.querySelector(".already-rsvp__open").click();
      const form = container.querySelector("form.already-rsvp");
      form.querySelector('input[name="name"]').value = "Larry";
      form.querySelector('input[name="email"]').value = "larry@example.com";
      form.dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
      assert.strictEqual(
        form.querySelector(".already-rsvp__error").textContent,
        "Host text",
      );
    } finally {
      destroy();
    }
  });

  it("init merges the rsvpClosed default into the config a layout receives", async () => {
    // A registered layout is handed the merged config, the one public place
    // the i18n defaults are observable.
    let seen;
    Already.registerLayout("rsvp-config-probe", (event, options) => {
      seen = options.config.i18n.rsvpClosed;
      const card = document.createElement("div");
      card.className = "already-card";
      card.textContent = event.title;
      return card;
    });
    const { destroy } = mount({ theme: { layout: "rsvp-config-probe" } });
    try {
      await tick(10);
      assert.strictEqual(seen, "This event is not taking RSVPs.");
    } finally {
      destroy();
    }
  });
});
