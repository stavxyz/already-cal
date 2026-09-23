// src/ui/tag-filter.js

import { isCategoryTag, tagLabel } from "../util/tags.js";

/** Create a tag filter controller with render, getFilter, and getSelectedTags methods. */
export function createTagFilter(onFilterChange, config) {
  const selectedTags = new Set();
  const clearLabel = config?.i18n?.clearFilter || "Clear";

  function render(container, events) {
    // Collect unique tags from visible events, count frequency
    const tagCounts = new Map();
    for (const event of events) {
      for (const tag of event.tags || []) {
        if (!isCategoryTag(tag)) continue;
        const label = tagLabel(tag);
        tagCounts.set(label, (tagCounts.get(label) || 0) + 1);
      }
    }

    if (tagCounts.size === 0) {
      container.innerHTML = "";
      return;
    }

    // Sort by frequency (most common first)
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

    const bar = document.createElement("div");
    bar.className = "already-tag-filter";

    for (const [label] of sortedTags) {
      const pill = document.createElement("button");
      pill.className =
        "already-tag-pill" +
        (selectedTags.has(label) ? " already-tag-pill--active" : "");
      pill.textContent = label;
      pill.addEventListener("click", () => {
        if (selectedTags.has(label)) {
          selectedTags.delete(label);
        } else {
          selectedTags.add(label);
        }
        render(container, events);
        onFilterChange();
      });
      bar.appendChild(pill);
    }

    if (selectedTags.size > 0) {
      const clear = document.createElement("button");
      clear.className = "already-tag-clear";
      clear.textContent = clearLabel;
      clear.addEventListener("click", () => {
        selectedTags.clear();
        render(container, events);
        onFilterChange();
      });
      bar.appendChild(clear);
    }

    container.innerHTML = "";
    container.appendChild(bar);
  }

  function getFilter() {
    if (selectedTags.size === 0) return null;
    return (event) => {
      for (const tag of event.tags || []) {
        const label = tagLabel(tag);
        if (selectedTags.has(label)) return true;
      }
      return false;
    };
  }

  function getSelectedTags() {
    return new Set(selectedTags);
  }

  return { render, getFilter, getSelectedTags };
}
