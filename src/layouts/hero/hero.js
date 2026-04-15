import { formatDateShort, formatTime } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";
import { buildCardClasses, createCardImage } from "../helpers.js";

export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  card.className = buildCardClasses("hero", orientation, imagePosition, index);

  // Image
  const imageEl = createCardImage(event);
  if (imageEl) card.appendChild(imageEl);

  // Body
  const body = createElement("div", "already-card__body");

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  // Description preview
  if (event.description) {
    const desc = createElement("div", "already-card__description");
    desc.textContent = event.description;
    body.appendChild(desc);
  }

  // Footer with location + date
  const footer = createElement("div", "already-card__footer");

  if (event.location) {
    const loc = createElement("span", "already-card__location");
    loc.textContent = event.location;
    footer.appendChild(loc);
  }

  const dateStr = formatDateShort(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const endTimeStr =
    !event.allDay && event.end
      ? ` \u2013 ${formatTime(event.end, timezone, locale)}`
      : "";
  const meta = createElement("span", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}${endTimeStr}`;
  footer.appendChild(meta);

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}
