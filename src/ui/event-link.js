import { createElement } from "../views/helpers.js";

/**
 * The element an event link stretches over. The stylesheet positions it and
 * draws its focus ring, so a host needs no CSS of its own.
 */
const LINK_HOST_CLASS = "already-link-host";

/**
 * Put an event's link in place inside `host`. The first element matching
 * `titleSelector` gives up its child nodes to a new anchor appended to it,
 * so the title's text is the link's accessible name and is read once. When
 * there is no such element, or it already is or contains a link or a
 * button (a custom layout's own control, which must not end up inside a
 * link), a link with visually hidden `fallbackText` is appended to `host`
 * instead. That link stays statically positioned and hides only its text:
 * an absolutely positioned link would be the containing block of its own
 * stretched pseudo-element.
 *
 * DOM only: this knows nothing about events or i18n. The caller resolves
 * the href (router.eventHref) and the fallback text. A null `href` means
 * the entry has no route, so nothing is added and null comes back.
 */
export function linkTitle(
  host,
  href,
  { titleSelector, linkClass, fallbackText },
) {
  if (href == null) return null;
  const link = createElement("a", `already-event-link ${linkClass}`, { href });
  const title = host.querySelector(titleSelector);
  const holdsControl =
    title !== null &&
    (title.matches("a, button") || title.querySelector("a, button") !== null);
  if (title !== null && !holdsControl) {
    while (title.firstChild) link.appendChild(title.firstChild);
    title.appendChild(link);
  } else {
    const text = createElement("span", "already-sr-only");
    text.textContent = fallbackText;
    link.appendChild(text);
    host.appendChild(link);
  }
  host.classList.add(LINK_HOST_CLASS);
  return link;
}

/**
 * An element that is itself the event's link: an anchor when the entry has
 * a route, a plain div when it has none. The two cases are decided here so
 * no view repeats the choice.
 */
export function eventAnchor(href, className) {
  if (href == null) return createElement("div", className);
  return createElement("a", className, { href });
}
