import { parseEventDate } from "../util/dates.js";
import { createElement } from "../views/helpers.js";

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const PARTY_MAX = 20;
// Below this text-column width the form's fields are too narrow to use, so
// a horizontal card hides its image while the form is open.
const CRAMPED_BODY_PX = 320;
// Same rule the server applies: one @ with a dot after it, no whitespace.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether to show the RSVP button for an event. A display mirror of the
 * server's own acceptance rule: the host supplied onRsvp, the event is
 * flagged or the view takes RSVPs on every event, and the event has not
 * started. Start-based on purpose (an RSVP closes when the doors open),
 * unlike the card's past modifier, which keys on the end.
 */
export function offersRsvp(event, config, now = new Date()) {
  if (!config || typeof config.onRsvp !== "function") return false;
  if (!(event.rsvp || config.rsvpAllEvents)) return false;
  if (!event.start) return false;
  const start = parseEventDate(event.start);
  if (Number.isNaN(start.getTime())) return false;
  return start > now;
}

function field(form, name, labelText, attrs) {
  const wrap = createElement("label", "already-rsvp__field");
  const text = createElement("span", "already-rsvp__label");
  text.textContent = labelText;
  const input = createElement("input", "already-rsvp__input", {
    name,
    ...attrs,
  });
  wrap.appendChild(text);
  wrap.appendChild(input);
  form.appendChild(wrap);
  return input;
}

function createRsvpForm(event, config, { onClose, onDone }) {
  const i18n = config.i18n || {};
  const invalidText =
    i18n.rsvpInvalid || "Check your name, email and party size.";
  const startedText = i18n.rsvpStarted || "This event has already started.";
  const failedText = i18n.rsvpFailed || "Could not save your RSVP. Try again.";
  const closedText = i18n.rsvpClosed || "This event is not taking RSVPs.";
  // Rejection codes a retry cannot fix get their own message; any other
  // code, or none, keeps the "try again" text. A Map, so a code such as
  // "toString" from a host's server cannot hit an Object prototype key.
  const rejectionText = new Map([
    ["event_started", startedText],
    ["invalid_field", invalidText],
    ["rsvp_unavailable", closedText],
    ["event_not_found", closedText],
  ]);
  // novalidate: this function is the one validator, so the message a
  // visitor sees is the widget's (translatable) one, not the browser's.
  const form = createElement("form", "already-rsvp", { novalidate: "" });

  const name = field(form, "name", i18n.rsvpName || "Name", {
    type: "text",
    maxlength: String(NAME_MAX),
    autocomplete: "name",
    required: "",
  });
  const email = field(form, "email", i18n.rsvpEmail || "Email", {
    type: "email",
    maxlength: String(EMAIL_MAX),
    autocomplete: "email",
    required: "",
  });
  const size = field(
    form,
    "partySize",
    i18n.rsvpPartySize || "How many are coming?",
    {
      type: "number",
      min: "1",
      max: String(PARTY_MAX),
      value: "1",
      inputmode: "numeric",
    },
  );
  // Honeypot: never shown, never focused, never autofilled by a browser
  // that honors autocomplete=off. The server drops a filled one silently.
  const website = createElement("input", "already-rsvp__hp", {
    type: "text",
    name: "website",
    tabindex: "-1",
    autocomplete: "off",
    "aria-hidden": "true",
  });
  form.appendChild(website);

  const actions = createElement("div", "already-rsvp__actions");
  const submit = createElement("button", "already-rsvp__submit", {
    type: "submit",
  });
  submit.textContent = i18n.rsvpSubmit || "RSVP";
  const cancel = createElement("button", "already-rsvp__cancel", {
    type: "button",
  });
  cancel.textContent = i18n.rsvpCancel || "Cancel";
  actions.appendChild(submit);
  actions.appendChild(cancel);
  form.appendChild(actions);

  const error = createElement("p", "already-rsvp__error", { role: "alert" });
  error.hidden = true;
  form.appendChild(error);

  function showError(text) {
    error.textContent = text;
    error.hidden = false;
  }

  // The card around this form navigates on click, Space and Enter
  // (bindEventClick). Nothing typed or clicked inside the form may reach it.
  let pending = false;
  form.addEventListener("click", (e) => e.stopPropagation());
  form.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key !== "Escape") return;
    // Mirrors the disabled Cancel button: a pending submit can't be aborted.
    if (pending) return;
    onClose();
  });
  cancel.addEventListener("click", onClose);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = {
      name: name.value.trim(),
      email: email.value.trim().toLowerCase(),
      partySize: Number.parseInt(size.value, 10),
      website: website.value,
    };
    if (!fields.name || fields.name.length > NAME_MAX)
      return showError(invalidText);
    if (!EMAIL_RE.test(fields.email) || fields.email.length > EMAIL_MAX)
      return showError(invalidText);
    if (
      !Number.isInteger(fields.partySize) ||
      fields.partySize < 1 ||
      fields.partySize > PARTY_MAX
    )
      return showError(invalidText);
    error.hidden = true;
    submit.disabled = true;
    cancel.disabled = true;
    pending = true;
    try {
      const result = await config.onRsvp(event, fields);
      const count =
        result && Number.isInteger(result.partySize)
          ? result.partySize
          : fields.partySize;
      const done = createElement("p", "already-rsvp__done", { role: "status" });
      done.textContent = (
        i18n.rsvpDone || "You're on the list: {count} going"
      ).replaceAll("{count}", String(count));
      form.replaceWith(done);
      onDone();
    } catch (err) {
      pending = false;
      submit.disabled = false;
      cancel.disabled = false;
      showError(rejectionText.get(err?.code) || failedText);
    }
  });

  return { form, focus: () => name.focus() };
}

/**
 * The one mount path. Appends the RSVP button to `container` when the event
 * offers RSVP, else appends nothing and returns null. Clicking the button
 * swaps it for the form in place; cancel or Escape swaps back. The card
 * decorator and the detail view both call this, so the predicate and the
 * control have one owner. While the form is open the enclosing card, if
 * any, carries already-card--rsvp-open so the stylesheet can give the form
 * the card's width on a phone.
 */
export function appendRsvpControl(container, event, config) {
  if (!offersRsvp(event, config)) return null;
  const i18n = config.i18n || {};
  const button = createElement(
    "button",
    "already-card__action already-rsvp__open",
    { type: "button" },
  );
  button.textContent = i18n.rsvp || "RSVP";
  // The card is looked up per call: decorateRsvp mounts into a row before
  // attaching it to the card. Width is measured on open because the host's
  // column, not the window, decides how much room the card has.
  const setOpen = (open) => {
    const card = container.closest(".already-card");
    if (!card) return;
    const body = card.querySelector(".already-card__body");
    const cramped = open && !!body && body.clientWidth < CRAMPED_BODY_PX;
    card.classList.toggle("already-card--rsvp-open", open);
    card.classList.toggle("already-card--rsvp-cramped", cramped);
  };
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const { form, focus } = createRsvpForm(event, config, {
      onClose: () => {
        form.replaceWith(button);
        setOpen(false);
        button.focus();
      },
      onDone: () => setOpen(false),
    });
    button.replaceWith(form);
    setOpen(true);
    focus();
  });
  button.addEventListener("keydown", (e) => e.stopPropagation());
  container.appendChild(button);
  return button;
}

/**
 * Card decoration, applied by the list and grid views beside decorateCard.
 * Layouts know nothing about RSVP, so the decorator owns the row: if the
 * layout rendered a footer holding an action (Badge's Details link), the
 * button joins it; otherwise the button gets a footer row of its own at the
 * end of the body. A footer without an action is not reused because it
 * holds information (Hero's location and date), not things to click. Every
 * layout that renders cards therefore offers the button, always in a row
 * meant for actions. The fallback card a failed layout renders says the
 * event could not be displayed, so it offers nothing to act on.
 */
export function decorateRsvp(card, event, config) {
  if (card.classList.contains("already-card--error")) return;
  if (!offersRsvp(event, config)) return;
  const actionFooter = [...card.querySelectorAll(".already-card__footer")].find(
    (footer) => footer.querySelector(".already-card__action"),
  );
  if (actionFooter) {
    actionFooter.classList.add("already-card__footer--rsvp");
    appendRsvpControl(actionFooter, event, config);
    return;
  }
  const row = createElement(
    "div",
    "already-card__footer already-card__footer--rsvp already-card__rsvp",
  );
  appendRsvpControl(row, event, config);
  (card.querySelector(".already-card__body") || card).appendChild(row);
}
