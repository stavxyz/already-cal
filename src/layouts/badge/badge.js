import { formatDate, formatTime } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";
import { buildBadge, buildCardClasses, createCardImage } from "../helpers.js";

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
    const badge = buildBadge(event.start, timezone, locale);
    imageEl.appendChild(badge);
    card.appendChild(imageEl);
  }

  // Body
  const body = createElement("div", "already-card__body");

  // Badge inline if no image
  if (!event.image) {
    const badge = buildBadge(event.start, timezone, locale);
    badge.classList.add("already-card__badge--inline");
    body.appendChild(badge);
  }

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  // Full date + time
  const dateStr = formatDate(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const endTimeStr =
    !event.allDay && event.end
      ? ` \u2013 ${formatTime(event.end, timezone, locale)}`
      : "";
  const meta = createElement("div", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}${endTimeStr}`;
  body.appendChild(meta);

  // Location
  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = `\u{1F4CD} ${event.location}`;
    body.appendChild(loc);
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    const tagsEl = createElement("div", "already-card__tags");
    for (const tag of event.tags) {
      const pill = createElement("span", "already-card__tag");
      pill.textContent = tag;
      tagsEl.appendChild(pill);
    }
    body.appendChild(tagsEl);
  }

  // Description preview
  if (event.description) {
    const desc = createElement("div", "already-card__description");
    desc.textContent = event.description;
    body.appendChild(desc);
  }

  // Action footer
  if (event.htmlLink) {
    const actions = createElement("div", "already-card__footer");
    const rsvp = createElement("a", "already-card__action", {
      href: event.htmlLink,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    rsvp.textContent = "RSVP";
    actions.appendChild(rsvp);
    body.appendChild(actions);
  }

  card.appendChild(body);
  return card;
}
