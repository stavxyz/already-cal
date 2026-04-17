import { has } from "./registry.js";
// Registers built-in layout types; must precede any has("layout", ...) call
import "./layouts/registry.js";

const VALID_PALETTES = new Set(["light", "dark", "warm", "cool"]);
const VALID_ORIENTATIONS = new Set(["vertical", "horizontal"]);
const VALID_IMAGE_POSITIONS = new Set(["left", "right", "alternating"]);

const THEME_KEYS = new Set([
  "layout",
  "orientation",
  "imagePosition",
  "palette",
]);

export const THEME_DEFAULTS = {
  layout: "clean",
  orientation: "vertical",
  imagePosition: "left",
  palette: "light",
};

/**
 * Resolve a theme config value (string shorthand or object) into
 * normalized layout/palette/orientation settings plus CSS overrides.
 */
export function resolveTheme(theme) {
  if (typeof theme === "string") {
    theme = { layout: theme };
  }
  const input = theme || {};

  const layout = has("layout", input.layout)
    ? input.layout
    : THEME_DEFAULTS.layout;

  const palette = VALID_PALETTES.has(input.palette)
    ? input.palette
    : THEME_DEFAULTS.palette;

  // Compact has no image — force vertical
  const orientation =
    layout === "compact"
      ? "vertical"
      : VALID_ORIENTATIONS.has(input.orientation)
        ? input.orientation
        : THEME_DEFAULTS.orientation;

  // imagePosition only applies when horizontal
  const imagePosition =
    orientation === "horizontal" &&
    VALID_IMAGE_POSITIONS.has(input.imagePosition)
      ? input.imagePosition
      : THEME_DEFAULTS.imagePosition;

  // Everything not a known theme key is a CSS custom property override
  const overrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!THEME_KEYS.has(key)) {
      overrides[key] = value;
    }
  }

  return { layout, orientation, imagePosition, palette, overrides };
}

/**
 * Apply a theme config to a DOM element. Resolves the theme, sets data
 * attributes, clears previous CSS overrides, and applies new ones.
 *
 * @param {HTMLElement} el - The container element
 * @param {string|object} themeInput - Raw theme config (string shorthand or object)
 * @param {string[]} previousOverrideKeys - CSS property names set by a prior applyTheme call
 * @returns {{ layout, palette, orientation, imagePosition, overrides, overrideKeys }}
 */
export function applyTheme(el, themeInput, previousOverrideKeys) {
  const theme = resolveTheme(themeInput);

  el.dataset.layout = theme.layout;
  el.dataset.orientation = theme.orientation;
  el.dataset.imagePosition = theme.imagePosition;
  el.dataset.palette = theme.palette;

  // Clear previous CSS overrides
  for (const prop of previousOverrideKeys) {
    el.style.removeProperty(prop);
  }

  // Apply new CSS overrides
  const overrideKeys = [];
  for (const [key, value] of Object.entries(theme.overrides)) {
    const prop = `--already-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    el.style.setProperty(prop, value);
    overrideKeys.push(prop);
  }

  return { ...theme, overrideKeys };
}
