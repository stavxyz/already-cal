import { DEFAULT_IMAGE_EXTENSIONS } from "./util/images.js";
import { DEFAULT_PLATFORMS } from "./util/links.js";

/**
 * Defaults for the config keys that change how event content is read. The
 * widget's DEFAULTS and every core consumer share these, so an empty or
 * partial config means the same thing everywhere.
 */
export const CONTENT_DEFAULTS = Object.freeze({
  imageExtensions: DEFAULT_IMAGE_EXTENSIONS,
  knownPlatforms: DEFAULT_PLATFORMS,
});
