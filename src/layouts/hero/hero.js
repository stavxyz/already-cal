import { formatDateShort, formatTime } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  let cls = "already-card already-card--hero";
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
    img.onerror = () => { wrapper.style.display = "none"; };
    wrapper.appendChild(img);
    card.appendChild(wrapper);
  }

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
    : ` ${formatTime(event.start, timezone, locale)}`;
  const endTimeStr =
    !event.allDay && event.end
      ? ` \u2013 ${formatTime(event.end, timezone, locale)}`
      : "";
  const meta = createElement("span", "already-card__meta");
  meta.textContent = `${dateStr} \u00b7 ${timeStr}${endTimeStr}`.trim();
  footer.appendChild(meta);

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}
