import { buildSubscribeTargets } from "../util/subscribe-targets.js";
import { createElement } from "../views/helpers.js";

const CAL_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" ' +
  'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 ' +
  '01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

function targetLabel(id, i18n) {
  if (id === "apple") return i18n.subscribeApple || "Apple Calendar";
  if (id === "google") return i18n.subscribeGoogle || "Google Calendar";
  if (id === "outlook") return i18n.subscribeOutlook || "Outlook";
  if (id === "copy") return i18n.subscribeCopy || "Copy iCal link";
  return "";
}

/**
 * Build the subscribe disclosure: a button that toggles an inline list of
 * "add to calendar" targets (Apple / Google / Outlook / Copy iCal link).
 * Returns null when subscribeUrl yields no derivable targets — the caller
 * then renders a single subscribe link instead. Exposes destroy() to drop the
 * document-level close listeners and any pending copied-label timer.
 */
export function createSubscribeMenu({ subscribeUrl, label, i18n = {} }) {
  const targets = buildSubscribeTargets(subscribeUrl);
  if (!targets) return null;

  const LIST_ID = "already-subscribe-list";

  const wrap = createElement("div", "already-subscribe-menu");
  const btn = createElement("button", "already-header-subscribe", {
    type: "button",
    "aria-expanded": "false",
    "aria-controls": LIST_ID,
  });
  btn.innerHTML = CAL_ICON;
  btn.appendChild(document.createTextNode(` ${label || "Subscribe"}`));

  const list = createElement("ul", "already-subscribe-list");
  list.id = LIST_ID;
  list.hidden = true;
  let revertTimer = null;
  const copiedLabel = i18n.copied || "📋 Copied!";

  for (const t of targets) {
    const text = targetLabel(t.id, i18n);
    const li = document.createElement("li");
    if (t.kind === "copy") {
      const item = createElement("button", "already-subscribe-item", {
        type: "button",
      });
      const lbl = createElement("span", "already-subscribe-item-label", {
        "aria-live": "polite",
      });
      lbl.textContent = text;
      item.appendChild(lbl);
      item.addEventListener("click", () => {
        item._copyResult = (async () => {
          if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function"
          ) {
            try {
              await navigator.clipboard.writeText(t.url);
              lbl.textContent = copiedLabel;
              if (revertTimer) clearTimeout(revertTimer);
              revertTimer = setTimeout(() => {
                lbl.textContent = text;
                revertTimer = null;
              }, 2000);
              return "copied";
            } catch {
              return "failed";
            }
          }
          return "failed";
        })();
      });
      li.appendChild(item);
    } else {
      const item = createElement("a", "already-subscribe-item", {
        href: t.url,
      });
      if (t.url.startsWith("https:")) {
        item.setAttribute("target", "_blank");
        item.setAttribute("rel", "noopener noreferrer");
      }
      item.textContent = text;
      li.appendChild(item);
    }
    list.appendChild(li);
  }

  function close() {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
  function open() {
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function cleanup() {
    if (revertTimer) clearTimeout(revertTimer);
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKeydown);
  }
  function onDocClick(e) {
    if (!document.contains(wrap)) return cleanup(); // self-clean if detached
    if (!wrap.contains(e.target)) close();
  }
  function onKeydown(e) {
    if (!document.contains(wrap)) return cleanup();
    if (e.key === "Escape" && !list.hidden) {
      close();
      btn.focus();
    }
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (list.hidden) open();
    else close();
  });
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);

  wrap.appendChild(btn);
  wrap.appendChild(list);
  wrap.destroy = cleanup;
  return wrap;
}
