import { render as clean } from "./clean/clean.js";
import { createElement } from "../views/helpers.js";

// Placeholder render functions — replaced in Tasks 5-7
function placeholderRender(event, options) {
  const card = createElement("div", "already-card");
  card.textContent = event.title;
  return card;
}

const layouts = {
  clean,
  hero: placeholderRender,
  badge: placeholderRender,
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
