import { has } from "./registry.js";
// Side-effect import: initializes the "theme" registry type and registers
// built-in bundles. Also transitively initializes the "layout" registry.
import {
  getTheme,
  VALID_IMAGE_POSITIONS,
  VALID_ORIENTATIONS,
  VALID_PALETTES,
} from "./themes/registry.js";

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
 * Resolve a single dimension (orientation, imagePosition, palette) through
 * the priority chain: constraint > user > bundle default > THEME_DEFAULTS.
 * Throws when a user value conflicts with a bundle constraint.
 */
function resolveDimension(dimension, userValue, bundle, validSet, themeName) {
  const constraint = bundle?.constraints?.[dimension];
  const bundleDefault = bundle?.defaults?.[dimension];

  if (constraint !== undefined) {
    if (userValue !== undefined && userValue !== constraint) {
      throw new Error(
        `already-cal: Theme "${themeName}" constrains ${dimension} to "${constraint}", but "${userValue}" was passed`,
      );
    }
    return constraint;
  }

  if (userValue !== undefined && validSet.has(userValue)) {
    return userValue;
  }

  if (bundleDefault !== undefined) {
    return bundleDefault;
  }

  return THEME_DEFAULTS[dimension];
}

/**
 * Resolve a theme config value (string shorthand or object) into
 * normalized layout/palette/orientation settings plus CSS overrides.
 *
 * Checks the theme bundle registry first. If the layout names a registered
 * bundle, applies its defaults, constraints, and CSS overrides with the
 * priority chain: constraint > user > bundle default > THEME_DEFAULTS.
 *
 * Throws on constraint violations (user value conflicts with bundle constraint).
 */
export function resolveTheme(theme) {
  if (typeof theme === "string") {
    theme = { layout: theme };
  }
  const input = theme || {};

  // Check if the layout names a theme bundle
  const bundle = input.layout ? getTheme(input.layout) : undefined;

  // Resolve layout
  let layout;
  if (bundle) {
    layout = bundle.layout || input.layout;
  } else if (has("layout", input.layout)) {
    layout = input.layout;
  } else {
    if (input.layout != null && input.layout !== THEME_DEFAULTS.layout) {
      console.warn(
        `already-cal: Unknown layout "${input.layout}", falling back to "${THEME_DEFAULTS.layout}"`,
      );
    }
    layout = THEME_DEFAULTS.layout;
  }

  const themeName = input.layout;

  const orientation = resolveDimension(
    "orientation",
    input.orientation,
    bundle,
    VALID_ORIENTATIONS,
    themeName,
  );

  const rawImagePosition = resolveDimension(
    "imagePosition",
    input.imagePosition,
    bundle,
    VALID_IMAGE_POSITIONS,
    themeName,
  );

  const palette = resolveDimension(
    "palette",
    input.palette,
    bundle,
    VALID_PALETTES,
    themeName,
  );

  // imagePosition only applies when horizontal
  const imagePosition =
    orientation === "horizontal"
      ? rawImagePosition
      : THEME_DEFAULTS.imagePosition;

  // CSS overrides: user overrides > bundle overrides (merged)
  const userOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!THEME_KEYS.has(key)) {
      userOverrides[key] = value;
    }
  }
  const overrides = { ...(bundle?.overrides || {}), ...userOverrides };

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
