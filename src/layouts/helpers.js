import { getDatePartsInTz, MONTH_NAMES_SHORT } from "../util/dates.js";
import { createElement } from "../views/helpers.js";

/**
 * Build the className string for a layout card element.
 * Handles orientation and image-position modifiers.
 */
export function buildCardClasses(
  layoutName,
  orientation,
  imagePosition,
  index,
) {
  let cls = `already-card already-card--${layoutName}`;
  cls += ` already-card--${orientation}`;
  if (
    orientation === "horizontal" &&
    (imagePosition === "right" ||
      (imagePosition === "alternating" && index % 2 === 1))
  ) {
    cls += " already-card--image-right";
  }
  return cls;
}

/**
 * Create a card image wrapper with lazy loading and error fallback.
 * Returns null if the event has no image.
 *
 * On `img.onerror` (e.g. the user uploaded a Google Drive image that
 * wasn't shared publicly — see already.events#168, #217), the wrapper
 * is hidden so the card doesn't render a broken-image icon. BEFORE
 * hiding, any `.already-card__badge` element that was appended into
 * the wrapper by the layout (badge layout overlays its date badge on
 * the image) is rescued: moved to the card's body with the
 * `--inline` modifier so it renders as a sibling of the title instead
 * of disappearing with the image wrapper. Without the rescue, every
 * card whose image failed to load lost its date badge as collateral
 * damage — the original symptom of already.events#217.
 */
export function createCardImage(event) {
  if (!event.image) return null;
  const wrapper = createElement("div", "already-card__image");
  const img = document.createElement("img");
  img.src = event.image;
  img.alt = event.title;
  img.setAttribute("loading", "lazy");
  img.onerror = () => {
    const badge = wrapper.querySelector(".already-card__badge");
    if (badge) {
      const card = wrapper.parentElement;
      const body = card?.querySelector(".already-card__body");
      if (body) {
        badge.classList.add("already-card__badge--inline");
        // Insert as the FIRST child of body to match the no-image inline
        // path (badge.js builds body as: badge, title, meta, ...). Keeping
        // the same DOM order means the rescued card is visually
        // indistinguishable from a card that never had an image.
        body.insertBefore(badge, body.firstChild);
      }
    }
    wrapper.style.display = "none";
  };
  wrapper.appendChild(img);
  return wrapper;
}

/**
 * Build a date badge element (day number + short month).
 * Used by badge and compact layouts.
 */
export function buildBadge(isoString, timezone, locale) {
  const dateParts = getDatePartsInTz(isoString, timezone, locale);
  const badge = createElement("div", "already-card__badge");
  const day = createElement("div", "already-card__badge-day");
  day.textContent = dateParts.day;
  badge.appendChild(day);
  const month = createElement("div", "already-card__badge-month");
  month.textContent = MONTH_NAMES_SHORT[dateParts.month] || "";
  badge.appendChild(month);
  return badge;
}

/**
 * Render a minimal error card when a layout render function fails.
 * Shows the event title so the user can identify the affected event.
 */
export function renderErrorCard(event) {
  const card = createElement("div", "already-card already-card--error");
  const body = createElement("div", "already-card__body");
  const title = createElement("div", "already-card__title");
  title.textContent = event.title || "Unknown Event";
  body.appendChild(title);
  const msg = createElement("div", "already-card__meta");
  msg.textContent = "Could not display this event";
  body.appendChild(msg);
  card.appendChild(body);
  return card;
}

/**
 * Safely invoke a layout render function, returning an error card on failure.
 * Validates that the return value is an HTMLElement; logs the error via
 * console.error so custom layout authors get full stack traces.
 */
export function safeRenderCard(renderFn, event, options) {
  try {
    const card = renderFn(event, options);
    if (!(card instanceof HTMLElement)) {
      throw new TypeError(
        `Layout returned ${typeof card} instead of HTMLElement`,
      );
    }
    return card;
  } catch (err) {
    console.error(
      `already-cal: Layout render error for "${event.title}":`,
      err,
    );
    return renderErrorCard(event);
  }
}
