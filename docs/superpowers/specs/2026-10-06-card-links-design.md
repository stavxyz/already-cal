---
type: spec
issue: 93
status: design
validated:
  sha: 2d731efb2b2a1c383f198f4f30d8748fa98dae54
  date: 2026-10-06T17:01:39Z
  reviewers: [fact-check, solid-hygiene]
  findings:
    critical: 0
    important: 5
    medium: 4
    low: 4
    nitpick: 0
  net_negative_raised: 4
  net_negative_addressed: 4
  net_negative_remaining: 0
---

# Cards open through a link, not a button: design

Implements #93. Today `bindEventClick` (`src/views/helpers.js`) makes every card, day-view row, month chip, and week block an activatable element: `role="button"`, `tabindex="0"`, and click, Enter, and Space all open the event. A card also contains other interactive content: the Badge layout's Details link, and since v0.12.0 the RSVP button and its form. Interactive content inside an element with `role="button"` is what accessibility checkers call nested-interactive. Observable today: a card that offers RSVP has an accessible name that is its whole text ending in "RSVP", the RSVP button is announced as just "RSVP" with no event name, and Badge's Details link bubbles its click to the card, so activating it opens the Google event page and the widget's detail view at once.

This design makes the event's title the one link that opens it, stretches that link over the card so the whole card stays clickable, and leaves every other control a sibling of the link rather than a descendant of a button. It is a behaviour change for hosts that style or script `role="button"` on cards, so it ships as v0.14.0.

## Goals

- No interactive element inside another interactive element anywhere the widget renders an event: cards in the grid, list, and hover popover, day-view rows, month chips, and week blocks.
- The whole card stays clickable with a pointer, exactly as today, and gains what a link gives for free: Enter opens it, middle-click and "open in new tab" open the host page at the event's deep link, and the context menu offers copy link.
- A screen reader hears "link, Burger Night" for the card and "button, RSVP for Burger Night" for its RSVP control.
- Custom layouts keep working with no change, and get the same link if they render a title element.
- An automated accessibility check over every built-in layout and every view runs in the test suite, so this class of bug cannot come back silently.

## Non-goals (deferred)

- Changing what the RSVP form itself does or looks like (`src/ui/rsvp-form.js` keeps its markup and behaviour; the Turnstile work queued for that module is independent).
- A visible "Part of" cue on day-view part rows (already-cal #96).
- Renaming the Badge layout's Details link. Its accessible name stays "Details"; its purpose is clear from the card it sits in, and the double activation it suffers from today goes away with the structure change.
- Keyboard reachability of the month cell and week column (the day-view shortcut on an empty area). They are pointer-only on purpose and stay so.

## Decisions

### D1. The title is the link

The router owns the event route, in both directions. `src/router.js` gains `eventHref(entry)`, next to `parseHash` and `setEventDetail`: it returns `#event/<entry.id>`, or `#event/<entry.parentId>` for a part with no id of its own (the rule `bindEventClick` applies today), or `null` when the entry has neither. It writes the id exactly as `setEventDetail` does and `parseHash` reads it (no encoding on either side), so a link and a programmatic navigation always agree. Every place in this design that needs an event's href calls it; none builds the string.

One primitive puts the link in place: `linkTitle(host, href, { titleSelector, linkClass })` in a new module `src/ui/event-link.js`. It finds the first element matching `titleSelector` inside `host`, moves that element's child nodes into a new `<a class="already-event-link <linkClass>" href>` appended to the title element, and returns the link. The title element keeps its tag, class, and text; only the text is now inside a link, so the link's accessible name is the title, read once. When no title element exists it appends a visually hidden link (`already-event-link already-sr-only`) to `host` with the entry's title as its text, or the i18n `openEvent` default "Open event" when the title is empty. When `href` is `null` it does nothing and returns `null`: an entry with neither id nor parent id is not activatable. Today such a card navigates to `#event/undefined` and shows the error state, which was never useful.

`decorateEventCard` (`src/views/card-decoration.js`) calls `linkTitle(card, eventHref(event), { titleSelector: ".already-card__title", linkClass: "already-card__link" })` as its first step, before the parts and RSVP decorations, and binds activation to the returned link (D3). An error card (`already-card--error`) returns early from `decorateEventCard` today and keeps doing so: it gets no link, as it gets no other decoration.

> **Design note (2026-10-06):** The first draft had this step build `#event/<id>` itself, and D4 and D5 each built it again, which the design review flagged as net-negative: four copies of the route's shape and of the id rule, outside the router that owns the route (the share path doubled the same way before v0.5.3, which is why `src/util/event-path.js` exists). The route now has one writer for links (`eventHref`) beside its one reader (`parseHash`), and one link-insertion primitive serves cards and rows.

### D2. The link is stretched over its host

One stretch rule in `src/styles/base.css` serves every host: `.already-event-link::after` is an empty absolutely positioned box covering the host (`inset: 0`), and each host that carries such a link (`.already-card`, and `.already-day-event` in D4) gets `position: relative`. `.already-card` already has `overflow: hidden`. The link itself inherits colour and has no underline, so the title looks as it does today, and the pointer cursor stays on the host.

Every control inside a host must sit above that box or it cannot be clicked. One named hook owns that: the class `already-control`, with the rule `.already-control { position: relative; z-index: 1 }`. The widget applies it to every control it mounts in a host: the Badge layout's Details link (`src/layouts/badge/badge.js`), and in `appendRsvpControl` the RSVP open button, the form, and the done line (one class on each element it creates). A host's non-interactive content, such as the Hero layout's footer with its location and time, stays below the link, so clicking it still opens the event. A custom layout that renders its own control puts `already-control` on it (D9); the CSS behind the hook can change without the contract changing.

Focus: the card has no outline of its own any more. `.already-event-link:focus-visible` has no visible outline on the text; instead `.already-card:has(.already-event-link:focus-visible)` and `.already-day-event:has(.already-event-link:focus-visible)` draw the ring the host drew before. Where `:has()` is unavailable the ring falls back to the link text (`.already-event-link:focus-visible { outline: ... }`), which is still visible.

> **Design note (2026-10-06):** The first draft lifted the whole `.already-card__footer` above the link, which made a control's clickability depend on where a layout happened to mount it and would have put the Hero layout's content footer above the link too. The design review asked for one opt-in hook owned by the widget; `already-control` is that hook, and the footer rule is gone.

### D3. Activation goes through the link

`bindEventClick(el, event, viewName, config, { canNavigate } = {})` replaces the current `{ stopPropagation = false }` option, which no caller passes. It binds to the link (`el`) and no longer sets `role` or `tabindex` on anything. Its click handler does what today's does, except for navigation: it calls `config.onEventClick(event, viewName)`, and when that returns `false`, or when `canNavigate` is given and returns `false`, it calls `preventDefault()`. Otherwise it lets the link navigate: the hash changes, the router opens the detail view as it does for any deep link, and middle-click or a modifier key opens a new tab with the host page at that hash. The keydown handler is removed: Enter activates a link natively, and Space does not, which is the standard behaviour of links.

`canNavigate` is how the one caller that knows about RSVP keeps that knowledge: `decorateEventCard` passes `() => !card.classList.contains(RSVP_OPEN_CLASS)`, so a card with an open form stays put. Rows, chips, and blocks pass nothing. `bindEventClick` itself no longer imports `RSVP_OPEN_CLASS` or knows the card's class name.

`setEventDetail` (`src/router.js:80`) loses its only caller, `bindEventClick`, under this design. It stays exported beside `eventHref` as the router's programmatic counterpart (one line), so a host or a later view can still navigate without a link. The popover card keeps its own click listener that closes the popover. The popover's touch handling (`bindEventPopover` cancels a tap's pointerdown so the synthesised click never reaches the anchor's activation handler) works the same for a link, because a link navigates on that same click event.

> **Design note (2026-10-06):** The first draft had `bindEventClick` look up `el.closest(".already-card")` to read the RSVP state, which the design review flagged: a view-agnostic helper would learn the card's class and DOM shape. The caller that knows about RSVP now passes a predicate instead.

### D4. Day-view rows

`renderRow` in `src/views/day.js` calls the same primitive: `linkTitle(row, eventHref(entry), { titleSelector: ".already-day-event-title", linkClass: "already-day-event__link" })`, then `bindEventClick` on the returned link. The row gets `position: relative`, and the shared `.already-event-link::after` rule from D2 stretches the link over it. A part row under its parent (`--part`) is the same call with the part as the entry, so a part with no id resolves to its parent through `eventHref`, exactly as on a card. Rows hold no other controls today; one that is added later carries `already-control` (D2), so the rule exists before anything needs it.

> **Design note (2026-10-06):** The first draft gave rows their own href construction, their own link markup, and their own stretch CSS. The design review flagged the href as a second copy of the route and the rest as a second copy of the card's mechanism. Rows now share the builder, the primitive, the stretch rule, and the control hook with cards.

### D5. Month chips and week blocks are links

The chip (`src/views/month.js`) and the block (`src/views/week.js`) are created as `<a>` elements with their existing classes and `href` set from `eventHref(event)`, instead of `div` elements that `bindEventClick` turns into buttons; `bindEventClick` is still called on them for `onEventClick`. An entry `eventHref` returns `null` for stays a `div` with no activation, as on a card. Chips and blocks are already keyboard-reachable today; this makes them links with native semantics and removes the key handler. `bindEventPopover` binds to the same element as before. The month cell's and week column's click handlers already ignore clicks that land on a chip or block, and still do. The stale comment at `src/views/month.js:139`, which says chips stop propagation when the code below it says they do not, is corrected in the same change.

> **Design note (2026-10-06):** The first draft wrote `href="#event/<id>"` here, a third and fourth copy of the route with no parent-id fallback, which the design review flagged as net-negative. Both now call `eventHref`.

### D6. The RSVP button names its event

`appendRsvpControl` (`src/ui/rsvp-form.js`) sets `aria-label` on the open button from a new i18n string `rsvpFor`, default `"RSVP for {title}"`, with `{title}` replaced by the event's title. The visible text stays `i18n.rsvp` ("RSVP"), which the name contains, as WCAG 2.5.3 asks. The detail view's control gets the same label for consistency. This is the only change inside `rsvp-form.js`, and it is one attribute on one element.

### D7. An automated accessibility check in the suite

New dev dependency `axe-core`. A new test file `test/a11y/cards.test.cjs` renders, in jsdom, each built-in layout in the grid and list views for an ordinary event, a composite with parts, an event that offers RSVP (with the form open and closed), and the Badge layout with a Details link; the month, week, and day views; the detail view of a composite; and the hover popover. It runs `axe.run` on each container with the rules `nested-interactive`, `button-name`, `link-name`, `aria-allowed-attr`, `aria-roles`, `aria-valid-attr-value`, `duplicate-id-active`, and `focus-order-semantics` where jsdom supports them, and asserts zero violations, printing each violation's node and help text on failure. The `region` and colour-contrast rules are off (jsdom has no layout). `npm test` globs `test/a11y/*.test.cjs`.

Verified before planning, by a probe outside the repository (axe-core 4.14.0 with jsdom 29 and `pretendToBeVisual`, the `window`, `document`, `Node`, `Element`, and `HTMLElement` globals set from the JSDOM window): `axe.run` on a `div` with `role="button"` and `tabindex` that contains a button and a link reports one `nested-interactive` violation, and the same content as a title link with sibling controls reports none. No `getComputedStyle` stub was needed for the rules listed above. The first task of the plan repeats that probe inside the repository's own `test/setup-dom.cjs` environment before anything else is built; if a rule misbehaves there, that rule is dropped from the list rather than the check.

### D8. Behaviour changes a host can see

- Cards, rows, chips, and blocks no longer carry `role="button"` or `tabindex`. A host selector such as `.already-card[role="button"]` matches nothing.
- Space no longer opens a card. Enter still does. Middle-click and modifier-click open a new tab.
- Clicking the empty area of a card footer no longer opens the card.
- Activating the Badge layout's Details link opens the Google event page only.
- The RSVP button's accessible name includes the event title.
- `onEventClick` fires as before, for a click or Enter on the link, and `false` still prevents navigation.

### D9. Docs

- `docs/configuration.md`, Custom Layouts: a layout renders `.already-card__title` to receive the event link, and any control it renders (a button, a link, a form) carries the class `already-control` so it stays clickable above the stretched link; the CSS behind that class is the widget's and is not part of the contract. The `onEventClick` section notes Enter and middle-click; the i18n table gains `rsvpFor` and `openEvent`.

> **Design note (2026-10-06):** The first draft told layout authors to add `position: relative`, which the design review flagged as leaking the stretched link's implementation into the public contract. The contract names the hook instead.
- `docs/architecture.md`: the decoration step's description names the link.
- `docs/development.md`: the a11y test file and how to run it.
- `README.md`: one line under accessibility, if a section exists, else none.

### D10. Tests that change on purpose

- Every test that asserts `role="button"` or `tabindex="0"` on a card, row, chip, or block asserts the link instead (href, text, and that the container has no role). `eventHref` gets its own tests in `test/router.test.cjs` (id, parent id fallback, neither, and byte-for-byte agreement with what `setEventDetail` writes and `parseHash` reads for an id with reserved characters).
- `test/views/ordinary-card-markup.test.cjs` pins the decorated card's markup to v0.12.1; the title now contains a link, so the fixture is regenerated from this branch and its comment says it pins v0.14.0. That is the test doing its job.
- The RSVP tests gain the `aria-label` assertion and keep their behaviour assertions.

### D11. Release

v0.14.0, by the same release process as v0.13.0: a release commit on the branch, a squash merge, a tag, the release workflow. The consuming service re-vendors from the tag in its own PR, which also carries no code change beyond the pin unless its e2e specs click cards by role (to check in that PR).

## Open choices

- Whether the Details link should also name its event ("Details for Burger Night"). Deferred above; one attribute if wanted.
- Whether the popover card, which closes on any click, should keep its link at all. It does (the link is how the detail opens from the popover today, through the same decoration), and a visitor who middle-clicks it gets a new tab, which is a small gain.

## Verification

- `npm test` green with the new a11y file in the glob; `npm run test:perf` unchanged; `npm run check` clean; `dist/` rebuilt.
- The a11y test fails when the stretched link is put back inside a `role="button"` card (`nested-interactive`, the shape the probe in D7 confirmed it reports), and a plain assertion pins the RSVP `aria-label` with a composite's two RSVP buttons on one page (`button-name` is satisfied by the visible text, so axe alone would not catch its loss). A card with no link at all is caught by the tests of D10, which assert the link's presence, not by axe, which has no rule for an unreachable card.
- A manual pass in a browser on the consuming service's dev deploy after the re-vendor: Tab order on a Badge card with RSVP is title link, Details, RSVP; Enter on the title opens the event; Space does nothing; middle-click opens a new tab at the deep link; VoiceOver reads "link, <title>" and "button, RSVP for <title>".
