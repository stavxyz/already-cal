import { escapeHtml } from "../util/sanitize.js";
import { buildShareUrl } from "../util/share-url.js";
import { googleCalIdToCid } from "../util/subscribe-targets.js";
import { createShareButton } from "./share-button.js";
import { createSubscribeMenu } from "./subscribe-menu.js";

// Accept a header-link URL only if it parses and uses an http(s) scheme.
// Render-side defense-in-depth: the embed host validates at write time, but
// the widget must never emit an <a href> for javascript:/data:/etc.
function safeHttpUrl(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Render the calendar header: name, description, icon, and subscribe button. */
export function renderHeader(container, calendarData, config) {
  if (!config.showHeader) {
    container.querySelector(".already-subscribe-menu")?.destroy?.();
    container.innerHTML = "";
    return;
  }

  // Config overrides calendar data
  const name = config.headerTitle ?? calendarData?.name ?? "";
  const description =
    config.headerDescription ?? calendarData?.description ?? "";
  const i18n = config.i18n || {};
  const subscribeLabel = i18n.subscribe || "Subscribe";

  // Build subscribe URL: explicit config, or auto-generate from Google Calendar ID
  let subscribeUrl = config.subscribeUrl || null;
  if (!subscribeUrl && config.google?.calendarId) {
    subscribeUrl = `https://calendar.google.com/calendar/u/0?cid=${googleCalIdToCid(config.google.calendarId)}`;
  }
  if (!subscribeUrl && calendarData?.calendarId) {
    subscribeUrl = `https://calendar.google.com/calendar/u/0?cid=${googleCalIdToCid(calendarData.calendarId)}`;
  }

  // Calendar-share button (always available when a base is configured).
  const shareButton = config.shareBase
    ? createShareButton({
        className: "already-header-subscribe already-header-share",
        label: i18n.share || "Share",
        copiedLabel: i18n.copied || "📋 Copied!",
        getTitle: () =>
          config.headerTitle ||
          calendarData?.name ||
          document.title ||
          "Calendar",
        getUrl: () =>
          buildShareUrl(config.shareBase, {
            kind: "calendar",
            ...(config.getShareState ? config.getShareState() : {}),
          }),
      })
    : null;

  // Render the header if there's a title, a description, OR an action to show.
  if (!name && !description && !subscribeUrl && !shareButton) {
    container.querySelector(".already-subscribe-menu")?.destroy?.();
    container.innerHTML = "";
    return;
  }

  const header = document.createElement("div");
  header.className = "already-header";

  if (config.headerIcon) {
    const icon = document.createElement("img");
    icon.className = "already-header-icon";
    icon.src = config.headerIcon;
    icon.alt = "";
    icon.loading = "lazy";
    header.appendChild(icon);
  }

  const textCol = document.createElement("div");
  textCol.className = "already-header-text";

  if (name) {
    const h = document.createElement("h2");
    h.className = "already-header-name";
    const linkUrl = safeHttpUrl(config.headerUrl);
    if (linkUrl) {
      const a = document.createElement("a");
      a.className = "already-header-name-link";
      a.href = linkUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = name;
      h.appendChild(a);
    } else {
      h.textContent = name;
    }
    textCol.appendChild(h);
  }

  if (description) {
    const p = document.createElement("p");
    p.className = "already-header-description";
    p.textContent = description;
    textCol.appendChild(p);
  }

  header.appendChild(textCol);

  const actions = document.createElement("div");
  actions.className = "already-header-actions";

  if (subscribeUrl) {
    const menu = createSubscribeMenu({
      subscribeUrl,
      label: subscribeLabel,
      i18n,
    });
    if (menu) {
      actions.appendChild(menu);
    } else {
      // Fallback: an override that isn't an ICS feed — keep the single link
      // unchanged. Intentional, covered by header.test.cjs (not dead code).
      const btn = document.createElement("a");
      btn.className = "already-header-subscribe";
      btn.href = subscribeUrl;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8v4M6 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> ${escapeHtml(subscribeLabel)}`;
      actions.appendChild(btn);
    }
  }

  if (shareButton) actions.appendChild(shareButton);
  if (actions.childNodes.length > 0) header.appendChild(actions);

  container.querySelector(".already-subscribe-menu")?.destroy?.();
  container.innerHTML = "";
  container.appendChild(header);
}
