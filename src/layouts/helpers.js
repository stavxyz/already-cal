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
 */
export function createCardImage(event) {
  if (!event.image) return null;
  const wrapper = createElement("div", "already-card__image");
  const img = document.createElement("img");
  img.src = event.image;
  img.alt = event.title;
  img.setAttribute("loading", "lazy");
  img.onerror = () => {
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
