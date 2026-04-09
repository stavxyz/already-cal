export function renderLoading(container, config) {
  if (config && config.renderLoading) {
    const result = config.renderLoading();
    if (typeof result === 'string') {
      container.innerHTML = result;
    } else if (result instanceof HTMLElement || result instanceof DocumentFragment) {
      container.innerHTML = '';
      container.appendChild(result);
    }
    return;
  }
  container.innerHTML = `
    <div class="showcal-loading">
      <div class="showcal-loading-pulse"></div>
      <div class="showcal-loading-pulse"></div>
      <div class="showcal-loading-pulse"></div>
    </div>`;
}

export function renderEmpty(container, hasPastEvents, onShowPast, config) {
  const i18n = (config && config.i18n) || {};
  const noUpcomingEvents = i18n.noUpcomingEvents || 'No upcoming events.';
  const showPastEvents = i18n.showPastEvents || 'Show past events';

  if (config && config.renderEmpty) {
    const result = config.renderEmpty({ hasPastEvents });
    if (typeof result === 'string') {
      container.innerHTML = result;
    } else if (result instanceof HTMLElement || result instanceof DocumentFragment) {
      container.innerHTML = '';
      container.appendChild(result);
    }
    return;
  }

  const pastLink = hasPastEvents
    ? `<button class="showcal-empty-past-link" onclick="this.dispatchEvent(new CustomEvent('showcal:show-past', { bubbles: true }))">${showPastEvents}</button>`
    : '';
  container.innerHTML = `
    <div class="showcal-empty">
      <div class="showcal-empty-icon">📅</div>
      <p>${noUpcomingEvents}</p>
      ${pastLink}
    </div>`;
  if (hasPastEvents) {
    container.querySelector('.showcal-empty-past-link')?.addEventListener('click', onShowPast);
  }
}

export function renderError(container, message, onRetry, config) {
  const i18n = (config && config.i18n) || {};
  const couldNotLoad = i18n.couldNotLoad || 'Could not load events.';
  const retry = i18n.retry || 'Retry';

  if (config && config.renderError) {
    const result = config.renderError({ message });
    if (typeof result === 'string') {
      container.innerHTML = result;
    } else if (result instanceof HTMLElement || result instanceof DocumentFragment) {
      container.innerHTML = '';
      container.appendChild(result);
    }
    return;
  }

  container.innerHTML = `
    <div class="showcal-error">
      <p>${couldNotLoad}</p>
      <button class="showcal-error-retry">${retry}</button>
    </div>`;
  container.querySelector('.showcal-error-retry')?.addEventListener('click', onRetry);
}
