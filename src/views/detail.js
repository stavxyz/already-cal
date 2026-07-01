import { createShareButton } from "../ui/share-button.js";
import { formatDateRange } from "../util/dates.js";
import { renderDescription } from "../util/description.js";
import { buildShareUrl } from "../util/share-url.js";
import { createElement } from "./helpers.js";
import { openLightbox } from "./lightbox.js";

function renderGallery(images, altText) {
  const gallery = createElement("div", "already-detail-gallery");

  let loadedImages = [...images];
  let current = 0;
  let counter = null;

  const imgEl = document.createElement("img");
  imgEl.className = "already-detail-gallery-img";
  imgEl.src = images[0];
  imgEl.alt = altText;
  imgEl.setAttribute("loading", "lazy");
  imgEl.onerror = () => {
    loadedImages = loadedImages.filter((u) => u !== imgEl.src);
    if (loadedImages.length === 0) {
      gallery.closest(".already-detail-image")?.remove();
      return;
    }
    current = 0;
    imgEl.src = loadedImages[0];
    if (counter) counter.textContent = `1 / ${loadedImages.length}`;
  };
  gallery.appendChild(imgEl);

  // Visual affordance indicating the image is zoomable (purely decorative)
  const zoomBadge = createElement("div", "already-detail-gallery-zoom", {
    "aria-hidden": "true",
  });
  zoomBadge.textContent = "\u2315";
  gallery.appendChild(zoomBadge);

  // Open lightbox on click — passes loadedImages so broken images are excluded
  imgEl.style.cursor = "zoom-in";
  imgEl.addEventListener("click", () => {
    openLightbox(loadedImages, current, altText);
  });

  if (images.length <= 1) return gallery;

  counter = createElement("div", "already-detail-gallery-counter");
  counter.textContent = `1 / ${images.length}`;
  gallery.appendChild(counter);

  const prevBtn = createElement("button", "already-detail-gallery-prev", {
    "aria-label": "Previous image",
  });
  prevBtn.textContent = "\u2039";
  gallery.appendChild(prevBtn);

  const nextBtn = createElement("button", "already-detail-gallery-next", {
    "aria-label": "Next image",
  });
  nextBtn.textContent = "\u203a";
  gallery.appendChild(nextBtn);

  function goTo(idx) {
    current = (idx + loadedImages.length) % loadedImages.length;
    imgEl.src = loadedImages[current];
    counter.textContent = `${current + 1} / ${loadedImages.length}`;
  }

  prevBtn.addEventListener("click", () => goTo(current - 1));
  nextBtn.addEventListener("click", () => goTo(current + 1));

  gallery.setAttribute("tabindex", "0");
  gallery.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      goTo(current - 1);
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      goTo(current + 1);
      e.preventDefault();
    }
  });

  return gallery;
}

/** Render the two-column event detail view with gallery, metadata, and action buttons. */
export function renderDetailView(container, event, timezone, onBack, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const backLabel = i18n.back || "\u2190 Back";
  const locationTemplate =
    config.locationLinkTemplate || "https://maps.google.com/?q={location}";

  const images =
    event.images && event.images.length > 0
      ? event.images
      : event.image
        ? [event.image]
        : [];
  const hasImages = images.length > 0;

  const detail = createElement("div", "already-detail");

  const actions = createElement("div", "already-detail-actions");

  const backBtn = createElement("button", "already-detail-back");
  backBtn.textContent = backLabel;
  backBtn.addEventListener("click", onBack);
  actions.appendChild(backBtn);

  if (config.shareBase) {
    const shareBtn = createShareButton({
      className: "already-detail-share",
      label: i18n.share || "Share",
      copiedLabel: i18n.copied || "📋 Copied!",
      getTitle: () => event.title,
      getUrl: () =>
        buildShareUrl(config.shareBase, { kind: "event", eventId: event.id }),
    });
    actions.appendChild(shareBtn);
  }

  detail.appendChild(actions);

  // Two-column layout: gallery left, content right
  const body = createElement(
    "div",
    hasImages
      ? "already-detail-body already-detail-body--has-image"
      : "already-detail-body",
  );

  if (hasImages) {
    const galleryCol = createElement("div", "already-detail-image");
    galleryCol.appendChild(renderGallery(images, event.title));
    body.appendChild(galleryCol);
  }

  const content = createElement("div", "already-detail-content");

  const titleEl = createElement("h2", "already-detail-title");
  titleEl.textContent = event.title;
  content.appendChild(titleEl);

  const meta = createElement("div", "already-detail-meta");
  const dateStr = formatDateRange(event.start, event.end, {
    allDay: event.allDay,
    timeZone: timezone,
    locale,
    dateStyle: "full",
  });
  const dateDiv = createElement("div", "already-detail-date");
  dateDiv.textContent = dateStr;
  meta.appendChild(dateDiv);

  if (event.location) {
    const mapsUrl = locationTemplate.replace(
      "{location}",
      encodeURIComponent(event.location),
    );
    const locDiv = createElement("div", "already-detail-location");
    const locLink = createElement("a", null, {
      href: mapsUrl,
      target: "_blank",
      rel: "noopener",
    });
    locLink.textContent = event.location;
    locDiv.appendChild(locLink);
    meta.appendChild(locDiv);
  }
  content.appendChild(meta);

  // Render tags (scalar tags and key-value text tags)
  const scalarAndTextTags = (event.tags || []).filter((t) => {
    if (t.key === "tag") return true; // scalar tag
    if (t.value && !t.value.startsWith("http")) return true; // key-value text
    return false;
  });

  if (scalarAndTextTags.length > 0) {
    const tagsDiv = createElement("div", "already-detail-tags");
    for (const tag of scalarAndTextTags) {
      const span = createElement("span", "already-detail-tag");
      span.textContent =
        tag.key === "tag" ? tag.value : `${tag.key}: ${tag.value}`;
      tagsDiv.appendChild(span);
    }
    content.appendChild(tagsDiv);
  }

  // Trim-gate symmetric with badge.js + hero.js: avoid emitting an empty
  // .already-detail-description div for whitespace-only descriptions
  // (e.g. "   " or "\n\n"), which would otherwise produce a visible empty
  // block after the renderDescription `<br>` substitution path. Keeps
  // the cross-layout description-rendering contract uniform — same
  // class of inconsistency #190 was opened to close.
  if (event.description?.trim()) {
    const desc = createElement("div", "already-detail-description");
    desc.innerHTML = renderDescription(event.description, config);
    content.appendChild(desc);
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
    content.appendChild(attachDiv);
  }

  // Collect key-value URL tags to render alongside links
  const urlTags = (event.tags || []).filter(
    (t) => t.key !== "tag" && t.value && t.value.startsWith("http"),
  );
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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
    content.appendChild(linksDiv);
  }

  body.appendChild(content);
  detail.appendChild(body);

  container.innerHTML = "";
  container.appendChild(detail);

  // Focus the back button for accessibility
  backBtn.focus();
}
