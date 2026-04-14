const VALID_LAYOUTS = new Set(["clean", "hero", "badge", "compact"]);
const VALID_PALETTES = new Set(["light", "dark", "warm", "cool"]);
const VALID_ORIENTATIONS = new Set(["vertical", "horizontal"]);
const VALID_IMAGE_POSITIONS = new Set(["left", "right", "alternating"]);

const THEME_KEYS = new Set([
  "layout",
  "orientation",
  "imagePosition",
  "palette",
]);

const THEME_DEFAULTS = {
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

  const layout = VALID_LAYOUTS.has(input.layout)
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
