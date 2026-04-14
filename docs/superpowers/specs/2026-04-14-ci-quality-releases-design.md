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
  "$schema": "https://biomejs.dev/schemas/2.4.11/schema.json",
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

Three separate workflow files with path filtering, following the `already.events` pattern.

### `.github/workflows/quality.yml` — Biome

```yaml
name: Quality

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  filter-paths:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
      changed: ${{ steps.filter.outputs.code }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          base: main
          filters: |
            code:
              - '**/*.js'
              - '**/*.cjs'
              - '**/*.css'
              - '**/*.json'
              - 'biome.json'

  biome:
    needs: filter-paths
    if: needs.filter-paths.outputs.changed == 'true'
    name: Biome
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .
```

### `.github/workflows/tests.yml` — Tests + Coverage + Build

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  filter-paths:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
      changed: ${{ steps.filter.outputs.code }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          base: main
          filters: |
            code:
              - 'src/**'
              - 'test/**'
              - 'build.cjs'
              - 'package.json'
              - 'package-lock.json'

  test:
    needs: filter-paths
    if: needs.filter-paths.outputs.changed == 'true'
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    permissions:
      contents: read
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - name: Run tests with coverage
        if: matrix.node-version == 22
        run: npm run test:coverage
      - name: Run tests
        if: matrix.node-version != 22
        run: npm test
      - name: Verify build
        run: npm run build
```

### `.github/workflows/release.yml` — Tag-Triggered Release

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Create GitHub Release
        run: |
          gh release create "${{ github.ref_name }}" \
            dist/already-cal.js \
            dist/already-cal.min.js \
            dist/already-cal.css \
            dist/already-cal.min.css \
            dist/already-cal.js.map \
            --generate-notes \
            --title "${{ github.ref_name }}"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

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

jsdelivr and unpkg serve from GitHub Releases:
```
https://cdn.jsdelivr.net/gh/stavxyz/already-cal@v0.2.0/dist/already-cal.min.js
```

No npm publish required.

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
