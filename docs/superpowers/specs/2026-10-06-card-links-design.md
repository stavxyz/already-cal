---
type: spec
issue: 93
status: design
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

`decorateEventCard` (`src/views/card-decoration.js`) gains one step, run before the parts and RSVP decorations: it finds the first `.already-card__title` in the card and moves that element's child nodes into a new `<a class="already-card__link" href="#event/<id>">` appended to the title element. The title element keeps its tag, class, and text; only the text is now inside a link. The link's accessible name is therefore the event title, read once.

A card with no `.already-card__title` (a custom layout) gets a visually hidden link appended to the card instead, with the event title as its text (or the i18n `openEvent` default "Open event" when the title is empty), so the card is still reachable and still opens.

The `href` names the entry the card is for: `#event/<event.id>`, or `#event/<event.parentId>` for a part with no id of its own (the same rule `bindEventClick` applies today). An entry with neither has no link and is not activatable; today such a card navigates to `#event/undefined` and shows the error state, which was never useful.

### D2. The link is stretched over the card

`src/layouts/base.css`: `.already-card` gets `position: relative` (it already has `overflow: hidden`), and `.already-card__link::after` is an empty absolutely positioned box covering the card (`inset: 0`). The link itself inherits colour and has no underline, so the title looks as it does today. The pointer cursor stays on the card.

Every control the card holds must sit above that box or it cannot be clicked. The rule: `.already-card__footer` (where every built-in layout puts its Details link and where `decorateRsvp` mounts the RSVP control) gets `position: relative; z-index: 1`. Clicking the empty area of a footer therefore does not open the card, which is acceptable: footers are small and hold controls. The RSVP form, when open, lives inside that footer and is above the link by the same rule. A custom layout that renders its own control outside a footer must give it `position: relative` (documented, D10).

Focus: the card has no outline of its own any more. `.already-card__link:focus-visible` has no visible outline on the text; instead `.already-card:has(.already-card__link:focus-visible)` draws the ring the card drew before. Where `:has()` is unavailable the ring falls back to the link text (`.already-card__link:focus-visible { outline: ... }`), which is still visible.

### D3. Activation goes through the link

`bindEventClick(el, event, viewName, config, { host } = {})` binds to the link (`el`) and no longer sets `role` or `tabindex` on anything. Its click handler does what today's does, except for navigation: it calls `config.onEventClick(event, viewName)`, and when that returns `false`, or when the host card has an open RSVP form (`host.classList.contains(RSVP_OPEN_CLASS)`, with `host` defaulting to `el.closest(".already-card")`), it calls `preventDefault()`. Otherwise it lets the link navigate: the hash changes, the router opens the detail view as it does for any deep link, and middle-click or a modifier key opens a new tab with the host page at that hash. The keydown handler is removed: Enter activates a link natively, and Space does not, which is the standard behaviour of links.

`setEventDetail` stays in `src/router.js` for the callers that navigate without a link (the back button, the day view's date route). The popover card keeps its own click listener that closes the popover.

### D4. Day-view rows

`.already-day-event` rows go through the same decoration: the row's `.already-day-event-title` text moves into `<a class="already-day-event__link" href=...>`, the row gets `position: relative`, and the link's `::after` stretches over the row. Rows hold no other controls today, so nothing needs lifting. A part row under its parent (`--part`) is the same with the part's own id.

### D5. Month chips and week blocks are links

The chip (`src/views/month.js`) and the block (`src/views/week.js`) are created as `<a href="#event/<id>">` elements with their existing classes instead of `div` elements with `role="button"`. They are already keyboard-reachable buttons today; this makes them links with native semantics and removes the key handler. `bindEventPopover` binds to the same element as before. The month cell's and week column's click handlers already ignore clicks that land on a chip or block, and still do.

### D6. The RSVP button names its event

`appendRsvpControl` (`src/ui/rsvp-form.js`) sets `aria-label` on the open button from a new i18n string `rsvpFor`, default `"RSVP for {title}"`, with `{title}` replaced by the event's title. The visible text stays `i18n.rsvp` ("RSVP"), which the name contains, as WCAG 2.5.3 asks. The detail view's control gets the same label for consistency. This is the only change inside `rsvp-form.js`, and it is one attribute on one element.

### D7. An automated accessibility check in the suite

New dev dependency `axe-core`. A new test file `test/a11y/cards.test.cjs` renders, in jsdom, each built-in layout in the grid and list views for an ordinary event, a composite with parts, an event that offers RSVP (with the form open and closed), and the Badge layout with a Details link; the month, week, and day views; the detail view of a composite; and the hover popover. It runs `axe.run` on each container with the rules `nested-interactive`, `button-name`, `link-name`, `aria-allowed-attr`, `aria-roles`, `aria-valid-attr-value`, `duplicate-id-active`, and `focus-order-semantics` where jsdom supports them, and asserts zero violations, printing each violation's node and help text on failure. The `region` and colour-contrast rules are off (jsdom has no layout). `npm test` globs `test/a11y/*.test.cjs`.

Whether axe-core runs under this repository's jsdom setup is unverified until the first task of the plan installs it and runs one rule. If it does not, the fallback is a homegrown check that walks each rendered container for an element with an interactive role or tag inside another, with the same fixtures; the spec's goal stands either way.

### D8. Behaviour changes a host can see

- Cards, rows, chips, and blocks no longer carry `role="button"` or `tabindex`. A host selector such as `.already-card[role="button"]` matches nothing.
- Space no longer opens a card. Enter still does. Middle-click and modifier-click open a new tab.
- Clicking the empty area of a card footer no longer opens the card.
- Activating the Badge layout's Details link opens the Google event page only.
- The RSVP button's accessible name includes the event title.
- `onEventClick` fires as before, for a click or Enter on the link, and `false` still prevents navigation.

### D9. Docs

- `docs/configuration.md`, Custom Layouts: a layout renders `.already-card__title` to receive the event link, and any control it renders outside a `.already-card__footer` needs `position: relative` to sit above the stretched link; the `onEventClick` section notes Enter and middle-click; the i18n table gains `rsvpFor` and `openEvent`.
- `docs/architecture.md`: the decoration step's description names the link.
- `docs/development.md`: the a11y test file and how to run it.
- `README.md`: one line under accessibility, if a section exists, else none.

### D10. Tests that change on purpose

- Every test that asserts `role="button"` or `tabindex="0"` on a card, row, chip, or block asserts the link instead (href, text, and that the container has no role).
- `test/views/ordinary-card-markup.test.cjs` pins the decorated card's markup to v0.12.1; the title now contains a link, so the fixture is regenerated from this branch and its comment says it pins v0.14.0. That is the test doing its job.
- The RSVP tests gain the `aria-label` assertion and keep their behaviour assertions.

### D11. Release

v0.14.0, by the same release process as v0.13.0: a release commit on the branch, a squash merge, a tag, the release workflow. The consuming service re-vendors from the tag in its own PR, which also carries no code change beyond the pin unless its e2e specs click cards by role (to check in that PR).

## Open choices

- Whether the Details link should also name its event ("Details for Burger Night"). Deferred above; one attribute if wanted.
- Whether the popover card, which closes on any click, should keep its link at all. It does (the link is how the detail opens from the popover today, through the same decoration), and a visitor who middle-clicks it gets a new tab, which is a small gain.

## Verification

- `npm test` green with the new a11y file in the glob; `npm run test:perf` unchanged; `npm run check` clean; `dist/` rebuilt.
- The a11y test fails when the D1 link is removed (the card is then neither a button nor a link, which `link-name` or the homegrown check reports as an unreachable card) and when the RSVP `aria-label` is removed with a composite's two RSVP buttons on one page (`button-name` is satisfied by the visible text, so this case is pinned by a plain assertion instead).
- A manual pass in a browser on the consuming service's dev deploy after the re-vendor: Tab order on a Badge card with RSVP is title link, Details, RSVP; Enter on the title opens the event; Space does nothing; middle-click opens a new tab at the deep link; VoiceOver reads "link, <title>" and "button, RSVP for <title>".
