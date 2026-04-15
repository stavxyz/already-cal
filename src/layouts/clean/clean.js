import { formatDateShort, formatTime } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";
import { buildCardClasses, createCardImage } from "../helpers.js";

export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  card.className = buildCardClasses("clean", orientation, imagePosition, index);

  // Image
  const imageEl = createCardImage(event);
  if (imageEl) card.appendChild(imageEl);

  // Body
  const body = createElement("div", "already-card__body");

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  const dateStr = formatDateShort(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const meta = createElement("div", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}`;
  body.appendChild(meta);

  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = event.location;
    body.appendChild(loc);
  }

  card.appendChild(body);
  return card;
}
