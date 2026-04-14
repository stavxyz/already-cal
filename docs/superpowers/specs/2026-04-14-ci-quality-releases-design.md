# CI/CD, Quality, Testing & Releases — Design Spec

## Goal

Add CI/CD, code quality tooling, test coverage reporting, and a release pipeline to already-cal using native GitHub tooling and minimal dependencies.

## Principles

- **No behavior changes.** Only config files, workflow files, package.json scripts, and one formatting commit.
- **Follow already.events precedent.** Biome for quality, separate workflow files, path filtering.
- **Minimal dependencies.** Biome + c8 — nothing else.
- **Manual releases.** Tag-driven, intentional versioning — no automated version bumps.

---

## Section 1: Code Quality — Biome

### Dependencies

Add `@biomejs/biome` as a devDependency.

### Config — `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.12/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": [
      "**",
      "!dist/**",
      "!**/*.min.js",
      "!**/*.min.css"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `check` | `biome ci .` | Lint + format check (CI, fails on violations) |
| `lint` | `biome ci .` | Alias for `check` (discoverability) |
| `format` | `biome check --write .` | Auto-fix lint and formatting |

### Initial Formatting Pass

Run `biome check --write .` once on the codebase and commit the result as a single formatting commit before adding CI enforcement. This establishes the baseline.

---

## Section 2: Test Coverage — c8

### Dependencies

Add `c8` as a devDependency.

### Config

Coverage config goes in `package.json` under a `"c8"` key (avoids a separate config file):

```json
{
  "c8": {
    "include": ["src/**/*.js"],
    "exclude": ["dist/**", "test/**", "build.cjs"],
    "reporter": ["text", "lcov"],
    "report-dir": "coverage"
  }
}
```

Add `coverage/` to `.gitignore`.

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `node --test test/*.test.cjs test/views/*.test.cjs test/ui/*.test.cjs` | Fast local test (unchanged) |
| `test:coverage` | `c8 node --test test/*.test.cjs test/views/*.test.cjs test/ui/*.test.cjs` | Tests with coverage (CI) |

### Thresholds

Run coverage once to determine current baseline. Set thresholds ~5% below actual to catch regressions without false failures. Add thresholds to the `"c8"` config in `package.json` once measured:

```json
{
  "c8": {
    "branches": <measured - 5>,
    "lines": <measured - 5>,
    "functions": <measured - 5>,
    "statements": <measured - 5>
  }
}
```

### Scope

No new tests in this PR. Coverage tooling only. Filling coverage gaps is a separate effort.

---

## Section 3: CI Workflows — GitHub Actions

Three separate workflow files with path filtering, following the `already.events` pattern. All actions are pinned to commit SHAs for supply-chain security. Concurrency groups cancel superseded runs.

### `.github/workflows/quality.yml` — Biome

- Path-filtered: only triggers when JS/CSS/JSON files change
- Uses `biomejs/setup-biome` (no npm install needed)
- Biome version pinned to match `devDependency` (2.4.12)

### `.github/workflows/tests.yml` — Tests + Coverage + Build

- Path-filtered: only triggers when src/test/build files change
- Node 20/22 matrix with `fail-fast: false` (each leg completes independently)
- Coverage (`c8`) runs only on Node 22
- Build verification runs only on Node 22 (esbuild output is deterministic)

### `.github/workflows/release.yml` — Tag-Triggered Release

- Triggers on tags matching `v[0-9]*` (rejects non-semver junk tags)
- Permissions scoped to the release job (not workflow-level)
- Verifies dist is clean (`git diff --exit-code dist/`) before creating release
- Uploads 5 dist assets via `gh release create --generate-notes`

---

## Section 4: Release Process

Manual, intentional versioning. No automated version bumps.

### Workflow

1. Bump `version` in `package.json`, commit
2. Tag: `git tag v<version>`
3. Push: `git push origin v<version>`
4. `release.yml` fires automatically — builds, tests, creates GitHub Release with dist assets

### Release Assets

| File | Description |
|------|-------------|
| `already-cal.js` | IIFE bundle |
| `already-cal.min.js` | Minified bundle |
| `already-cal.css` | Styles |
| `already-cal.min.css` | Minified styles |
| `already-cal.js.map` | Source map |

### CDN Access

jsdelivr and unpkg serve from the git repository at a tagged version:
```
https://cdn.jsdelivr.net/gh/stavxyz/already-cal@v0.2.0/dist/already-cal.min.js
```

This references the dist files committed at the tag, not the Release assets. No npm publish required.

---

## Out of Scope

- No behavior changes to already-cal source code (beyond formatting)
- No new tests (coverage tooling only)
- No npm publish (GitHub Releases only)
- No `.nvmrc` (CI matrix covers Node 18/20/22)
- No pre-commit hooks (Biome runs in CI; developers can run `npm run format` locally)
- No coverage gap filling (separate effort after tooling is in place)

## Closes

- #19 — CI/CD with GitHub Actions
- #20 — Test infrastructure and coverage
- #21 — Code quality tooling
- #22 — Releases and distribution
