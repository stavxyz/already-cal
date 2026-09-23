// Tags reach renderers as { key, value } objects from enrichEvent (see
// docs/event-schema.md). A plain string is tolerated because an
// eventTransform hook can hand one back.

/** Display text for a tag: a scalar tag's value, or "key: value". */
export function tagLabel(tag) {
  if (typeof tag === "string") return tag;
  return tag.key === "tag" ? tag.value : `${tag.key}: ${tag.value}`;
}

/**
 * Whether a tag is a category worth showing as a pill. A key-value tag whose
 * value is a URL is a link, not a category.
 */
export function isCategoryTag(tag) {
  if (typeof tag === "string") return true;
  if (tag.key === "tag") return true;
  return Boolean(tag.value) && !tag.value.startsWith("http");
}
