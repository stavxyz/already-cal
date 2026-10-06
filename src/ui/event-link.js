import { createElement } from "../views/helpers.js";

/**
 * The element an event link stretches over. The stylesheet positions it and
 * draws its focus ring, so a host needs no CSS of its own.
 */
const LINK_HOST_CLASS = "already-link-host";

// What counts as a control inside a title: a link inside a link is the
// nesting this module exists to remove, and anything else focusable or
// announced as a control would be nested the same way.
const CONTROL_SELECTOR =
  'a, button, input, select, textarea, [tabindex], [role="button"], [role="link"]';

/** The visually hidden text that names a link with nothing visible to name it. */
function hiddenName(text) {
  const span = createElement("span", "already-sr-only");
  span.textContent = text;
  return span;
}

/**
 * Put an event's link in place inside `host`. The first element matching
 * `titleSelector` gives up its child nodes to a new anchor appended to it,
 * so the title's text is the link's accessible name and is read once. When
 * there is no such element, or it holds no text, or it already is or
 * contains a control (a link, a button, an input, or anything with a
 * `tabindex` or a button or link role: a custom layout's own control, which
 * must not end up inside a link), a link with visually hidden `fallbackText`
 * is prepended to `host` instead. That hidden link also carries
 * `already-event-link--hidden`, which takes it out of the host's flow and
 * sizes it to the host, so its stretched pseudo-element, whose containing
 * block it then is, still covers the host.
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
    (title.matches(CONTROL_SELECTOR) ||
      title.querySelector(CONTROL_SELECTOR) !== null);
  // A title with no text would make a link with no accessible name; the
  // built-in layouts render the title element for a blank title too.
  const holdsText = title !== null && title.textContent.trim() !== "";
  if (holdsText && !holdsControl) {
    while (title.firstChild) link.appendChild(title.firstChild);
    title.appendChild(link);
  } else {
    link.appendChild(hiddenName(fallbackText));
    // Out of the host's flow: an in-flow anchor with no visible content is
    // still a flex or grid item, and a day row's gap would push its time
    // column aside. The anchor covers the host itself, so the focus-ring
    // fallback for browsers without :has() has a box to draw on.
    link.classList.add("already-event-link--hidden");
    // First in the host, so the event's own link comes before the layout's
    // controls in reading and tab order, as a title does.
    host.prepend(link);
  }
  host.classList.add(LINK_HOST_CLASS);
  return link;
}

/**
 * Give an element that is itself the event's link (a chip, a block) its
 * text: the title, or, when the title is blank, a visually hidden span with
 * the fallback text, so the link still has an accessible name and the
 * element still looks as it did. A plain element with no href
 * (eventAnchor's div for an entry with no route) is not a control, so it
 * gets no name to announce.
 */
export function fillEventAnchor(el, title, fallbackText) {
  const text = String(title ?? "");
  el.textContent = text;
  if (text.trim() !== "" || !el.hasAttribute("href")) return;
  el.appendChild(hiddenName(fallbackText));
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
