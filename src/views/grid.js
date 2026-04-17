import { safeRenderCard } from "../layouts/helpers.js";
import { getLayout } from "../layouts/registry.js";
import { THEME_DEFAULTS } from "../theme.js";
import {
  createElement,
  decorateCard,
  filterHidden,
  sortFeaturedByDate,
} from "./helpers.js";

/** Render the card grid view with thumbnails. */
export function renderGridView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const theme = config._theme || THEME_DEFAULTS;

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const grid = createElement("div", "already-grid");
  const renderCard = getLayout(theme.layout);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const card = safeRenderCard(renderCard, event, {
      orientation: theme.orientation,
      imagePosition: theme.imagePosition,
      index: i,
      timezone,
      locale,
      config,
    });
    decorateCard(card, event, "grid", config);
    grid.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(grid);
}
