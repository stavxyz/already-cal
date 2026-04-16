# Contributing to already-cal

Thanks for your interest in contributing! This guide covers the basics to get you started.

## Getting Started

```bash
git clone https://github.com/stavxyz/already-cal.git
cd already-cal
npm install
npm test              # run the test suite
open dev.html         # local preview with mock data
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `npm run lint` and `npm test` before pushing
4. Open a pull request against `main`

For project structure, build system, testing details, and CI configuration, see the **[Development Guide](docs/development.md)**.

For architecture and module internals, see the **[Architecture Guide](docs/architecture.md)**.

## Code Style

- [Biome](https://biomejs.dev/) handles formatting and linting — run `npm run format` to auto-fix
- No framework dependencies — vanilla JavaScript only
- Follow existing patterns in the codebase

## Testing

- Tests are required for new features and bug fixes
- Use the Node.js built-in test runner (`node:test`)
- Test files mirror the `src/` directory structure under `test/`
- Coverage thresholds are enforced in CI — see the [Development Guide](docs/development.md#coverage-thresholds) for details
- Run `npm run test:coverage` to check coverage locally

## Commit Conventions

Use descriptive commit messages with conventional prefixes:

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `test:` | Test additions or fixes |
| `build:` | Build system or dependency changes |
| `refactor:` | Code changes that don't add features or fix bugs |

Keep commits atomic — each commit should represent one logical change.

## Questions?

Open an issue on [GitHub](https://github.com/stavxyz/already-cal/issues) for bugs, feature requests, or questions.
