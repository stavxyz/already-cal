import { formatEventWhen } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";
import {
  buildCardClasses,
  createCardImage,
  createPartsSlot,
} from "../helpers.js";

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

  const meta = createElement("div", "already-card__meta");
  meta.textContent = formatEventWhen(event, {
    sourceZoneFallback: timezone,
    locale,
    dateStyle: "short",
  });
  body.appendChild(meta);

  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = event.location;
    body.appendChild(loc);
  }

  const partsSlot = createPartsSlot(event);
  if (partsSlot) body.appendChild(partsSlot);

  card.appendChild(body);
  return card;
}
