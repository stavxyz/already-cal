import { safeRenderCard } from "../layouts/helpers.js";
import { getLayout } from "../layouts/registry.js";
import { THEME_DEFAULTS } from "../theme.js";
import { decorateEventCard } from "./card-decoration.js";
import { createElement, sortFeaturedByDate } from "./helpers.js";

/** Render the list view using layout cards (horizontal by default). */
export function renderListView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const theme = config._theme || THEME_DEFAULTS;

  // List view defaults to horizontal orientation
  const orientation = theme.layout === "compact" ? "vertical" : "horizontal";

  events = sortFeaturedByDate(events);

  const list = createElement("div", "already-list");
  const renderCard = getLayout(theme.layout);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const card = safeRenderCard(renderCard, event, {
      orientation,
      imagePosition: theme.imagePosition,
      index: i,
      timezone,
      locale,
      config,
    });
    decorateEventCard(card, event, "list", config, { timezone });
    list.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(list);
}
