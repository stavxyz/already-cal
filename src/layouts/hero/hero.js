import { formatDateRange } from "../../util/dates.js";
import { renderDescription } from "../../util/description.js";
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

  // Description: shared sanitization with the detail view via renderDescription.
  // Trim-gate: avoid emitting an empty `.already-card__description` div for
  // whitespace-only descriptions (e.g. `"   "` or `"\n\n"`), which would
  // otherwise produce a visible empty block after the innerHTML+<br> path.
  if (event.description?.trim()) {
    const desc = createElement("div", "already-card__description");
    desc.innerHTML = renderDescription(event.description, options.config);
    body.appendChild(desc);
  }

  // Footer with location + date
  const footer = createElement("div", "already-card__footer");

  if (event.location) {
    const loc = createElement("span", "already-card__location");
    loc.textContent = event.location;
    footer.appendChild(loc);
  }

  const meta = createElement("span", "already-card__meta");
  meta.textContent = formatDateRange(event.start, event.end, {
    allDay: event.allDay,
    timeZone: timezone,
    locale,
    dateStyle: "short",
  });
  footer.appendChild(meta);

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}
