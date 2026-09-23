import { formatEventWhen } from "../../util/dates.js";
import { isCategoryTag, tagLabel } from "../../util/tags.js";
import { createElement } from "../../views/helpers.js";
import { buildBadge } from "../helpers.js";

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

  const meta = createElement("div", "already-card__meta");
  meta.textContent = formatEventWhen(event, {
    sourceZoneFallback: timezone,
    locale,
    dateStyle: "short",
  });
  info.appendChild(meta);

  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = `\u{1F4CD} ${event.location}`;
    info.appendChild(loc);
  }

  row.appendChild(info);

  // Date badge (inline, right side)
  const badge = buildBadge(event.start, locale);
  badge.classList.add("already-card__badge--inline");
  row.appendChild(badge);

  body.appendChild(row);

  // Tags
  const tags = (event.tags || []).filter(isCategoryTag);
  if (tags.length > 0) {
    const tagsEl = createElement("div", "already-card__tags");
    for (const tag of tags) {
      const pill = createElement("span", "already-card__tag");
      pill.textContent = tagLabel(tag);
      tagsEl.appendChild(pill);
    }
    body.appendChild(tagsEl);
  }

  card.appendChild(body);
  return card;
}
