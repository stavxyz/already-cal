// Tags reach renderers as { key, value } objects from enrichEvent (see
// docs/event-schema.md). A plain string, a null entry, or a non-string value
// is tolerated because pre-set event.tags and an eventTransform hook both
// bypass directive parsing.

/**
 * Whether a tag is a link: a key-value tag whose value is a URL. Links render
 * as buttons, never as pills.
 */
export function isLinkTag(tag) {
  if (tag == null || typeof tag !== "object" || tag.key === "tag") return false;
  return typeof tag.value === "string" && tag.value.startsWith("http");
}

/**
 * Whether a tag is a category worth showing as a pill: a plain string, a
 * scalar tag, or a key-value tag with a non-empty value that is not a link.
 */
export function isCategoryTag(tag) {
  if (typeof tag === "string") return true;
  if (tag == null || typeof tag !== "object") return false;
  if (tag.key === "tag") return true;
  return tag.value != null && tag.value !== "" && !isLinkTag(tag);
}

/** Display text for a tag: a scalar tag's value, or "key: value". */
export function tagLabel(tag) {
  if (typeof tag === "string") return tag;
  if (tag == null) return "";
  const value = String(tag.value ?? "");
  return tag.key === "tag" ? value : `${tag.key}: ${value}`;
}
