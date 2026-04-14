import { render as clean } from "./clean/clean.js";
import { render as hero } from "./hero/hero.js";
import { render as badge } from "./badge/badge.js";
import { createElement } from "../views/helpers.js";

function placeholderRender(event, options) {
  const card = createElement("div", "already-card");
  card.textContent = event.title;
  return card;
}

const layouts = {
  clean,
  hero,
  badge,
  compact: placeholderRender,
};

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}

/**
 * Register a layout render function. Used internally by layout modules
 * and available for custom layouts.
 */
export function registerLayout(name, renderFn) {
  layouts[name] = renderFn;
}
