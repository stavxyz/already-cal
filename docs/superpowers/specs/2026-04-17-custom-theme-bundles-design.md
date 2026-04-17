# Custom Theme Bundles — Design Spec

## Goal

Allow users to register named theme bundles that package a layout renderer, palette defaults, orientation/imagePosition defaults, constraints, and CSS custom property overrides into a single reusable unit. Refactor the four built-in themes into bundles so everything flows through the same code path.

## Prerequisite

Issue #32 (custom layout registry) — merged in PR #37.

## Registration API

```js
Already.registerTheme("timeline", {
  // Layout: render function (auto-registered) or string (existing layout name)
  layout: (event, options) => { /* ... returns HTMLElement */ },

  // Defaults: applied when user doesn't specify, but overridable
  defaults: {
    orientation: "vertical",
    imagePosition: "left",
    palette: "light",
  },

  // Constraints: enforced always, throws if user contradicts
  constraints: {
    orientation: "vertical",
  },

  // CSS overrides: applied as --already-* inline styles (user overrides win)
  overrides: {
    primary: "#2563eb",
    fontSizeSm: "0.7rem",
  },
});
```

### Validation rules

- **Name**: non-empty string. Built-in names (`clean`, `hero`, `badge`, `compact`) cannot be overridden — throws.
- **layout** (optional): if a function, auto-registered in the layout registry under the theme name. If a string, must reference an already-registered layout — validated at registration time. If omitted, the theme inherits whatever the user passes (or the default `"clean"`).
- **defaults** (optional): object with keys limited to `orientation`, `imagePosition`, and `palette`. Other keys are rejected at registration time. Layout is not defaultable — it's set by the bundle's `layout` field.
- **constraints** (optional): same key restrictions as `defaults`. Values must be valid for their dimension (e.g., orientation must be `"vertical"` or `"horizontal"`).
- **overrides** (optional): object of CSS custom property values. Keys become `--already-{kebab-case}` inline styles.
- Re-registering a custom theme name replaces the previous bundle.

### Auto-registration of layout

When `layout` is a render function:

```js
Already.registerTheme("timeline", { layout: renderTimeline });
// Equivalent to:
Already.registerLayout("timeline", renderTimeline);
// + registering the theme bundle with layout: "timeline"
```

The layout is registered under the theme name. If a layout with that name already exists (custom, not built-in), it is replaced.

## Theme Resolution

### String shorthand

`theme: "timeline"` checks bundles first, then falls back to layout-name lookup:

```
String input
  ├─ Bundle registry has it? → expand to { layout: bundleName, ...bundle.defaults }
  └─ No bundle? → current behavior: { layout: stringValue }
```

### Object input

`theme: { layout: "timeline", palette: "dark" }` checks if the layout names a bundle:

```
Object input with layout field
  ├─ Bundle registry has layout name? → merge: bundle.defaults < user input < bundle.constraints
  └─ No bundle? → current behavior (layout registry lookup only)
```

### Priority chain per dimension

For each of `orientation`, `imagePosition`, `palette`:

```
constraint (enforced, throws if user contradicts)
  > user-provided value
    > bundle default
      > THEME_DEFAULTS
```

For `overrides` (CSS custom properties):

```
user overrides > bundle overrides
```

User-provided CSS override values win over bundle overrides. Both are merged — the bundle provides baseline values, the user can selectively override.

### Constraint violations

When a user provides a value that conflicts with a bundle constraint, `resolveTheme()` throws:

```
already-cal: Theme "timeline" constrains orientation to "vertical", but "horizontal" was passed
```

Error propagation differs by call site:
- **`init()`** — catches the error and renders the error state in the container (visible on page). The exception also propagates to the caller.
- **`setConfig()`** — catches the error, logs via `console.error`, and leaves the current theme unchanged (non-destructive).

## Built-in Theme Refactoring

The four built-in themes are registered as bundles via `registerBuiltIn("theme", ...)` during module initialization:

| Theme | Layout | Constraints | Defaults | Overrides |
|-------|--------|------------|----------|-----------|
| `clean` | `"clean"` | none | none | none |
| `hero` | `"hero"` | none | none | none |
| `badge` | `"badge"` | none | none | none |
| `compact` | `"compact"` | `{ orientation: "vertical" }` | none | none |

The hardcoded `layout === "compact" ? "vertical" : ...` special case in `resolveTheme()` is removed. Compact's vertical forcing flows through the generic constraint system.

## setConfig() Integration

```js
cal.setConfig({ theme: "timeline" });
cal.setConfig({ theme: { layout: "timeline", palette: "dark" } });
```

Delegates to the same `applyTheme()` → `resolveTheme()` path. Re-render vs CSS-only logic unchanged: if `layout`, `orientation`, or `imagePosition` changed, re-render. If only `palette` or CSS overrides changed, CSS-only update.

Constraint violations in `setConfig()` log `console.error` and leave the current theme untouched.

PostMessage API works unchanged — `{ type: "already:config", config: { theme: "timeline" } }` resolves through `setConfig()`.

## Already.THEMES

```js
Already.THEMES
// → {
//   clean: { layout: "clean" },
//   hero: { layout: "hero" },
//   badge: { layout: "badge" },
//   compact: { layout: "compact", constraints: { orientation: "vertical" } },
//   timeline: { layout: "timeline", defaults: {...}, constraints: {...}, overrides: {...} }
// }
```

Returns a frozen snapshot (not a live reference). Includes built-in and custom bundles. Rebuilt on each access from the registry.

## File Changes

### New files

- `src/themes/registry.js` — Defines the `"theme"` registry type via `defineType("theme", validator)`. Registers four built-in bundles. Exports `getTheme(name)`.

### Modified files

- `src/theme.js` — `resolveTheme()` rewritten to check bundle registry, apply defaults/constraints/overrides with priority chain. Compact special case removed. Side-effect import of `src/themes/registry.js` added.
- `src/already-cal.js` — Adds `registerTheme()` export and `THEMES` getter. Wraps `init()` theme resolution in try/catch for error state rendering. Updates `setConfig()` theme path for constraint error handling.

### Unchanged files

- `src/registry.js` — Generic registry already supports this.
- `src/layouts/registry.js` — Layout registry unchanged. Theme bundles with render functions call `registerLayout()` but the layout registry itself is not modified.
- `src/views/grid.js`, `src/views/list.js` — Call `getLayout()` which works the same.
- `src/palettes/*.css` — No CSS injection. Custom palette CSS is external.

## Testing Strategy

- Theme bundle registry: register, validation (bad keys, bad values, bad layout references), built-in protection, duplicate guard, re-registration
- `resolveTheme()`: bundle defaults, constraints, override merging, full priority chain
- Constraint violation: throws with descriptive message, error message includes theme name and conflicting values
- `init()`: renders error state on constraint violation
- `setConfig()`: survives constraint violation non-destructively (keeps previous theme)
- String shorthand: resolves bundle, falls back to layout-name for non-bundles
- Auto-registration: passing render function in `layout` registers it in the layout registry
- `Already.THEMES`: frozen snapshot, includes built-in and custom bundles
- Compact regression: vertical constraint works through generic path
- Backward compatibility: all existing theme tests pass unchanged

## Documentation

- `docs/configuration.md` — Add "Custom Themes" section with `registerTheme()` API, bundle shape, validation rules, constraint behavior
- `docs/architecture.md` — Update Theme System section to describe bundle resolution
- `README.md` — Update Themes section, add custom theme bundle example

## Scope Exclusions

- **Palette CSS injection** — Custom palette CSS is external files, same as built-ins. No `<style>` element management.
- **i18n for error messages** — Constraint violation errors are developer-facing, not end-user-facing.
- **`unregisterTheme()`** — Not needed. Registration is permanent within a page lifecycle.

## Backward Compatibility

All existing usage continues working unchanged:

```js
// String shorthand — still works (built-in bundle lookup)
theme: "hero"

// Object — still works (layout registry lookup, no bundle)
theme: { layout: "hero", palette: "dark" }

// CSS overrides — still work
theme: { primary: "#ff0000" }
```

**Breaking change:** compact's vertical constraint now throws if a user explicitly passes `orientation: "horizontal"` with `layout: "compact"`. Previously this was silently overridden to `"vertical"`. This is intentional — it surfaces a config error that was previously hidden. Users who had `{ layout: "compact", orientation: "horizontal" }` in their config will see an error and need to remove the conflicting `orientation` key.
