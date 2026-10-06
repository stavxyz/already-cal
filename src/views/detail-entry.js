import { appendRsvpControl } from "../ui/rsvp-form.js";
import { renderDescription } from "../util/description.js";
import { isLinkTag } from "../util/tags.js";
import { createElement } from "./helpers.js";

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The part of the detail view that belongs to ONE entry: its description,
 * attachments, links, and RSVP control. The detail view renders it for the
 * event itself and again for each part of a composite, so a change to how
 * links or attachments render is made once.
 *
 * These fields are read raw from the entry, on purpose. Images and category
 * tags are shown for the event as a whole and go through the composite
 * accessors. Links, attachments, and an RSVP belong to one entry.
 */
export function renderEntryBody(container, event, config) {
  // Trim-gate: avoid emitting an empty description div for whitespace-only
  // descriptions, which would otherwise produce a visible empty block after
  // the renderDescription `<br>` substitution path.
  if (event.description?.trim()) {
    const desc = createElement("div", "already-detail-description");
    desc.innerHTML = renderDescription(event.description, config);
    container.appendChild(desc);
  }

  if (event.attachments && event.attachments.length > 0) {
    const attachDiv = createElement("div", "already-detail-attachments");
    for (const att of event.attachments) {
      const a = createElement("a", "already-detail-attachment", {
        href: att.url,
        target: "_blank",
        rel: "noopener",
      });
      a.textContent = att.label;
      attachDiv.appendChild(a);
    }
    container.appendChild(attachDiv);
  }

  // Key-value tags whose value is a URL render as links, beside the links.
  const urlTags = (event.tags || []).filter(isLinkTag);
  const allLinks = [
    ...(event.links || []),
    ...urlTags.map((t) => ({ label: titleCase(t.key), url: t.value })),
  ];

  if (allLinks.length > 0) {
    const linksDiv = createElement("div", "already-detail-links");
    for (const link of allLinks) {
      const a = createElement("a", "already-detail-link", {
        href: link.url,
        target: "_blank",
        rel: "noopener",
      });
      a.textContent = link.label;
      linksDiv.appendChild(a);
    }
    container.appendChild(linksDiv);
  }

  // Same mount path as the cards (decorateRsvp). The row is kept only when a
  // button was mounted. The control posts this entry's own id.
  const rsvpRow = createElement("div", "already-detail-rsvp");
  if (appendRsvpControl(rsvpRow, event, config)) container.appendChild(rsvpRow);
}
