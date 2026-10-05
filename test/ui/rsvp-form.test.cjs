require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let offersRsvp;
let appendRsvpControl;
let decorateRsvp;
before(async () => {
  ({ offersRsvp, appendRsvpControl, decorateRsvp } = await import(
    "../../src/ui/rsvp-form.js"
  ));
});
afterEach(() => {
  document.body.innerHTML = "";
});

const NOW = new Date("2050-01-01T00:00:00Z");
const i18n = {
  rsvp: "RSVP",
  rsvpName: "Name",
  rsvpEmail: "Email",
  rsvpPartySize: "How many",
  rsvpSubmit: "Send",
  rsvpCancel: "Cancel",
  rsvpDone: "{count} going",
  rsvpInvalid: "Fix it",
  rsvpFailed: "Failed",
};
const cfg = (over = {}) => ({
  onRsvp: async () => ({ partySize: 2 }),
  rsvpAllEvents: false,
  i18n,
  ...over,
});
const flagged = (over = {}) =>
  createTestEvent({ rsvp: true, start: "2099-06-15T10:00:00-05:00", ...over });

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe("offersRsvp", () => {
  it("is false without an onRsvp function", () => {
    assert.strictEqual(
      offersRsvp(flagged(), cfg({ onRsvp: null }), NOW),
      false,
    );
  });
  it("is true for a flagged upcoming event", () => {
    assert.strictEqual(offersRsvp(flagged(), cfg(), NOW), true);
  });
  it("is true for an unflagged event when rsvpAllEvents is on", () => {
    assert.strictEqual(
      offersRsvp(flagged({ rsvp: false }), cfg({ rsvpAllEvents: true }), NOW),
      true,
    );
  });
  it("is false for an unflagged event when the switch is off", () => {
    assert.strictEqual(offersRsvp(flagged({ rsvp: false }), cfg(), NOW), false);
  });
  it("is false once the event has started, even if it has not ended", () => {
    const e = flagged({
      start: "2049-12-31T23:00:00Z",
      end: "2050-01-01T02:00:00Z",
    });
    assert.strictEqual(offersRsvp(e, cfg(), NOW), false);
  });
  it("handles all-day events by date", () => {
    assert.strictEqual(
      offersRsvp(
        flagged({ start: "2050-01-02", end: "2050-01-03", allDay: true }),
        cfg(),
        NOW,
      ),
      true,
    );
    assert.strictEqual(
      offersRsvp(
        flagged({ start: "2049-12-31", end: "2050-01-01", allDay: true }),
        cfg(),
        NOW,
      ),
      false,
    );
  });
  it("is false without a start", () => {
    assert.strictEqual(offersRsvp(flagged({ start: "" }), cfg(), NOW), false);
  });
});

describe("appendRsvpControl", () => {
  it("appends a button that opens the form in place", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const btn = appendRsvpControl(host, flagged(), cfg());
    assert.strictEqual(btn.textContent, "RSVP");
    assert.ok(btn.classList.contains("already-card__action"));
    btn.click();
    const form = host.querySelector("form.already-rsvp");
    assert.ok(form);
    assert.ok(!host.contains(btn));
    assert.strictEqual(
      form.querySelector('input[name="name"]').getAttribute("maxlength"),
      "80",
    );
    assert.strictEqual(form.querySelector('input[name="email"]').type, "email");
    const size = form.querySelector('input[name="partySize"]');
    assert.strictEqual(size.min, "1");
    assert.strictEqual(size.max, "20");
    assert.strictEqual(size.value, "1");
    const hp = form.querySelector('input[name="website"]');
    assert.strictEqual(hp.getAttribute("autocomplete"), "off");
    assert.strictEqual(hp.getAttribute("tabindex"), "-1");
    assert.strictEqual(hp.getAttribute("aria-hidden"), "true");
  });

  it("cancel and Escape restore the button", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(host, flagged(), cfg()).click();
    host.querySelector(".already-rsvp__cancel").click();
    assert.ok(!host.querySelector("form"));
    assert.ok(host.querySelector(".already-rsvp__open"));
    host.querySelector(".already-rsvp__open").click();
    host
      .querySelector("form")
      .dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    assert.ok(!host.querySelector("form"));
    assert.ok(host.querySelector(".already-rsvp__open"));
  });

  it("stops click and keydown from reaching the card", () => {
    const card = document.createElement("div");
    let reached = 0;
    card.addEventListener("click", () => reached++);
    card.addEventListener("keydown", () => reached++);
    document.body.appendChild(card);
    appendRsvpControl(card, flagged(), cfg()).click();
    const name = card.querySelector('input[name="name"]');
    name.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    name.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(reached, 0);
  });

  it("submits the fields to onRsvp and shows the done line with the returned count", async () => {
    let received = null;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const event = flagged();
    appendRsvpControl(
      host,
      event,
      cfg({
        onRsvp: async (e, fields) => {
          received = { e, fields };
          return { partySize: 3 };
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.querySelector('input[name="partySize"]').value = "3";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    assert.strictEqual(
      form.querySelector(".already-rsvp__submit").disabled,
      true,
    );
    await flush();
    assert.strictEqual(received.e, event);
    assert.deepStrictEqual(received.fields, {
      name: "Larry",
      email: "larry@example.com",
      partySize: 3,
      website: "",
    });
    assert.ok(!host.querySelector("form"));
    assert.strictEqual(
      host.querySelector(".already-rsvp__done").textContent,
      "3 going",
    );
  });

  it("replaces every {count} placeholder in the done line", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        i18n: { ...i18n, rsvpDone: "{count} and {count}" },
        onRsvp: async () => ({ partySize: 3 }),
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.strictEqual(
      host.querySelector(".already-rsvp__done").textContent,
      "3 and 3",
    );
  });

  it("shows the error and keeps the values when onRsvp rejects", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: async () => {
          throw new Error("rsvp: event_started");
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="name"]').value = "Larry";
    form.querySelector('input[name="email"]').value = "larry@example.com";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.ok(host.querySelector("form"));
    assert.strictEqual(form.querySelector('input[name="name"]').value, "Larry");
    const err = form.querySelector(".already-rsvp__error");
    assert.strictEqual(err.hidden, false);
    assert.strictEqual(err.textContent, "Failed");
    assert.strictEqual(
      form.querySelector(".already-rsvp__submit").disabled,
      false,
    );
  });

  it("does not call onRsvp with an empty name or a malformed email, and says what to fix", async () => {
    let calls = 0;
    const host = document.createElement("div");
    document.body.appendChild(host);
    appendRsvpControl(
      host,
      flagged(),
      cfg({
        onRsvp: async () => {
          calls++;
          return { partySize: 1 };
        },
      }),
    ).click();
    const form = host.querySelector("form");
    form.querySelector('input[name="email"]').value = "not-an-email";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.strictEqual(calls, 0);
    const err = form.querySelector(".already-rsvp__error");
    assert.strictEqual(err.hidden, false);
    assert.strictEqual(err.textContent, "Fix it");
  });

  it("appends nothing and returns null when the event does not offer RSVP", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    assert.strictEqual(
      appendRsvpControl(host, flagged({ rsvp: false }), cfg()),
      null,
    );
    assert.strictEqual(host.children.length, 0);
  });
});

describe("decorateRsvp", () => {
  function cardWithFooter() {
    const card = document.createElement("div");
    card.className = "already-card";
    const footer = document.createElement("div");
    footer.className = "already-card__footer";
    card.appendChild(footer);
    return card;
  }
  it("appends the button into an existing footer when offered", () => {
    const card = cardWithFooter();
    decorateRsvp(card, flagged(), cfg());
    assert.ok(card.querySelector(".already-card__footer .already-rsvp__open"));
  });
  it("does nothing without a footer or when not offered", () => {
    const bare = document.createElement("div");
    decorateRsvp(bare, flagged(), cfg());
    assert.strictEqual(bare.querySelector(".already-rsvp__open"), null);
    const off = cardWithFooter();
    decorateRsvp(off, flagged({ rsvp: false }), cfg());
    assert.strictEqual(off.querySelector(".already-rsvp__open"), null);
  });
});
