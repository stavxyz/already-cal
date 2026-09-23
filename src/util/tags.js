// Tags reach renderers as { key, value } objects from enrichEvent (see
// docs/event-schema.md). Other shapes are tolerated because pre-set
// event.tags and an eventTransform hook both bypass directive parsing:
// anything that is not a usable tag is dropped rather than rendered oddly.

function hasKey(tag) {
  return (
    tag != null &&
    typeof tag === "object" &&
    typeof tag.key === "string" &&
    tag.key !== ""
  );
}

/**
 * Whether a tag is a link: a key-value tag whose value is a URL. Links render
 * as buttons, never as pills.
 */
export function isLinkTag(tag) {
  return (
    hasKey(tag) &&
    tag.key !== "tag" &&
    typeof tag.value === "string" &&
    tag.value.startsWith("http")
  );
}

/**
 * Whether a tag is a category worth showing as a pill: a non-blank string,
 * or a keyed tag whose value is a non-blank string or a finite number and
 * which is not a link.
 */
export function isCategoryTag(tag) {
  if (typeof tag === "string") return tag.trim() !== "";
  if (!hasKey(tag) || isLinkTag(tag)) return false;
  if (typeof tag.value === "string") return tag.value.trim() !== "";
  return Number.isFinite(tag.value);
}

/** Display text for a tag: a scalar tag's value, or "key: value". */
export function tagLabel(tag) {
  if (typeof tag === "string") return tag;
  if (tag == null) return "";
  const value = String(tag.value ?? "");
  return tag.key === "tag" ? value : `${tag.key}: ${value}`;
}
