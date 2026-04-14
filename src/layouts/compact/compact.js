import { formatDateShort, formatTime, getDatePartsInTz, MONTH_NAMES_SHORT } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

/**
 * Render a compact layout card.
 * No image. Inline date badge, title, date/time, location, tag pills.
 */
export function render(event, options) {
  const { timezone, locale } = options;

  const card = createElement("div");
  card.className = "already-card already-card--compact";

  const body = createElement("div", "already-card__body");

  // Top row: info left, badge right
  const row = createElement("div", "already-card__compact-row");

  // Info column
  const info = createElement("div", "already-card__compact-info");

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  info.appendChild(title);

  const dateStr = formatDateShort(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const meta = createElement("div", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}`;
  info.appendChild(meta);

  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = `\u{1F4CD} ${event.location}`;
    info.appendChild(loc);
  }

  row.appendChild(info);

  // Date badge (inline, right side)
  const dateParts = getDatePartsInTz(event.start, timezone, locale);
  const badge = createElement("div", "already-card__badge already-card__badge--inline");
  const day = createElement("div", "already-card__badge-day");
  day.textContent = dateParts.day;
  badge.appendChild(day);
  const month = createElement("div", "already-card__badge-month");
  month.textContent = MONTH_NAMES_SHORT[dateParts.month] || "";
  badge.appendChild(month);
  row.appendChild(badge);

  body.appendChild(row);

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

  card.appendChild(body);
  return card;
}
