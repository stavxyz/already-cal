/**
 * already-cal core: the DOM-free part of the widget's event pipeline, for
 * server-side consumers. These exports are public API under semver; the rest
 * of src/data.js stays internal.
 */
export { CONTENT_DEFAULTS } from "./content-defaults.js";
export { enrichGoogleEvent } from "./data.js";
export { plainTextDescription } from "./util/description.js";
