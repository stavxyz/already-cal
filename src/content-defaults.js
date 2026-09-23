import { DEFAULT_IMAGE_EXTENSIONS } from "./util/images.js";
import { DEFAULT_PLATFORMS } from "./util/links.js";

/**
 * Defaults for the config keys that change how event content is read. The
 * widget's DEFAULTS and every core consumer share these, so an empty or
 * partial config means the same thing everywhere.
 *
 * Shallow-frozen only: `Object.freeze` here locks the two top-level keys,
 * not the arrays they point to. `imageExtensions` (`DEFAULT_IMAGE_EXTENSIONS`)
 * is itself frozen at its own definition, but `knownPlatforms`
 * (`DEFAULT_PLATFORMS`) is not: do not mutate `CONTENT_DEFAULTS.knownPlatforms`
 * in place (e.g. `.push()`); copy it first.
 */
export const CONTENT_DEFAULTS = Object.freeze({
  imageExtensions: DEFAULT_IMAGE_EXTENSIONS,
  knownPlatforms: DEFAULT_PLATFORMS,
});
