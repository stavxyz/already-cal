export function renderLoading(container) {
  container.innerHTML = `
    <div class="ogcal-loading">
      <div class="ogcal-loading-pulse"></div>
      <div class="ogcal-loading-pulse"></div>
      <div class="ogcal-loading-pulse"></div>
    </div>`;
}

export function renderEmpty(container, hasPastEvents, onShowPast) {
  const pastLink = hasPastEvents
    ? `<button class="ogcal-empty-past-link" onclick="this.dispatchEvent(new CustomEvent('ogcal:show-past', { bubbles: true }))">Show past events</button>`
    : '';
  container.innerHTML = `
    <div class="ogcal-empty">
      <div class="ogcal-empty-icon">📅</div>
      <p>No upcoming events.</p>
      ${pastLink}
    </div>`;
  if (hasPastEvents) {
    container.querySelector('.ogcal-empty-past-link')?.addEventListener('click', onShowPast);
  }
}

export function renderError(container, message, onRetry) {
  container.innerHTML = `
    <div class="ogcal-error">
      <p>Could not load events.</p>
      <button class="ogcal-error-retry">Retry</button>
    </div>`;
  container.querySelector('.ogcal-error-retry')?.addEventListener('click', onRetry);
}
