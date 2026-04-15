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

module.exports = { createTestEvent };
