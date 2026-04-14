import { formatDateShort, formatTime } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  let cls = "already-card already-card--clean";
  cls += ` already-card--${orientation}`;
  if (
    orientation === "horizontal" &&
    (imagePosition === "right" ||
      (imagePosition === "alternating" && index % 2 === 1))
  ) {
    cls += " already-card--image-right";
  }
  card.className = cls;

  // Image
  if (event.image) {
    const wrapper = createElement("div", "already-card__image");
    const img = document.createElement("img");
    img.src = event.image;
    img.alt = event.title;
    img.setAttribute("loading", "lazy");
    img.onerror = () => {
      wrapper.style.display = "none";
    };
    wrapper.appendChild(img);
    card.appendChild(wrapper);
  }

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
