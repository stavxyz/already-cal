import { formatEventWhen } from "../../util/dates.js";
import { renderDescription } from "../../util/description.js";
import { createElement, createTagPills } from "../../views/helpers.js";
import {
  buildBadge,
  buildCardClasses,
  createCardImage,
  createPartsSlot,
} from "../helpers.js";

/**
 * Render a badge layout card.
 * Fields: date badge overlay on image, title, full date/time,
 * location, description preview, tag pills, action footer.
 */
export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  card.className = buildCardClasses("badge", orientation, imagePosition, index);

  // Image wrapper with badge overlay
  const imageEl = createCardImage(event);
  if (imageEl) {
    imageEl.classList.add("already-card__image--badged");
    const badge = buildBadge(event.start);
    imageEl.appendChild(badge);
    card.appendChild(imageEl);
  }

  // Body
  const body = createElement("div", "already-card__body");

  // Badge inline if no image
  // From what createCardImage returned, not from the event's own field: a
  // composite can lead with a part's image when the parent has none.
  if (!imageEl) {
    const badge = buildBadge(event.start);
    badge.classList.add("already-card__badge--inline");
    body.appendChild(badge);
  }

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  // Full date + time span
  const meta = createElement("div", "already-card__meta");
  meta.textContent = formatEventWhen(event, {
    sourceZoneFallback: timezone,
    locale,
    dateStyle: "full",
  });
  body.appendChild(meta);

  // Location
  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = `\u{1F4CD} ${event.location}`;
    body.appendChild(loc);
  }

  const partsSlot = createPartsSlot(event);
  if (partsSlot) body.appendChild(partsSlot);

  // Tags
  const tagsEl = createTagPills(
    event,
    "already-card__tags",
    "already-card__tag",
  );
  if (tagsEl) body.appendChild(tagsEl);

  // Description: shared sanitization with the detail view via renderDescription.
  // Trim-gate: avoid emitting an empty `.already-card__description` div for
  // whitespace-only descriptions (e.g. `"   "` or `"\n\n"`), which would
  // otherwise produce a visible empty block after the innerHTML+<br> path.
  if (event.description?.trim()) {
    const desc = createElement("div", "already-card__description");
    desc.innerHTML = renderDescription(event.description, options.config);
    body.appendChild(desc);
  }

  // Action footer: the Google event page, under its honest name. The native
  // RSVP button is a decoration the views add (src/ui/rsvp-form.js).
  if (event.htmlLink) {
    const actions = createElement("div", "already-card__footer");
    const details = createElement("a", "already-card__action already-control", {
      href: event.htmlLink,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    details.textContent = options.config?.i18n?.details || "Details";
    actions.appendChild(details);
    body.appendChild(actions);
  }

  card.appendChild(body);
  return card;
}
