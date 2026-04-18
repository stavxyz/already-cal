function createTestEvent(overrides = {}) {
  return {
    id: overrides.id || `event-${Math.random().toString(36).slice(2, 8)}`,
    title: "Test Event",
    description: "",
    location: "",
    start: "2099-06-15T10:00:00-05:00",
    end: "2099-06-15T11:00:00-05:00",
    allDay: false,
    image: null,
    images: [],
    links: [],
    attachments: [],
    tags: [],
    featured: false,
    hidden: false,
    htmlLink: "",
    ...overrides,
  };
}

/**
 * Capture console.error calls during fn execution. Restores console.error
 * in a finally block to prevent test pollution on assertion failures.
 * @param {Function} fn - Function to execute while capturing
 * @returns {string[]} Array of captured error message strings
 */
function captureConsoleError(fn) {
  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    fn();
  } finally {
    console.error = origError;
  }
  return errors;
}

module.exports = { createTestEvent, captureConsoleError };
