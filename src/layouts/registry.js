import { render as badge } from "./badge/badge.js";
import { render as clean } from "./clean/clean.js";
import { render as compact } from "./compact/compact.js";
import { render as hero } from "./hero/hero.js";

const layouts = { clean, hero, badge, compact };

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}
