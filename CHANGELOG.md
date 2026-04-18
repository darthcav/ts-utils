# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.8] - 2026-04-18

### Changed

- `LinuxRelease` and `WindowsRelease` converted from `interface` declarations to `type` aliases.
  `LinuxRelease` is now `Record<string, string>`; `WindowsRelease` is a type alias with the same
  property shape. Public API is compatible.
- Markdown `printWidth` in `.prettierrc.json` narrowed from 120 to 100; Markdown files reflowed
  accordingly.
- `CLAUDE.md` aligned with template: "Before Merging or Pushing" checklist expanded (tests,
  coverage, lint, documentation), Stack bullets added (`type` over `interface`, Biome + Prettier,
  `node:test`, TypeDoc), lint command wording updated to mention Prettier for Markdown.

## [0.8.7] - 2026-04-18

### Added

- `RuntimeObject` — a `Record<string, unknown>` alias for objects whose keys and values are only
  known at runtime.
- Optional `locale` parameter on `millisecondsToString` (defaults to `"en"`), forwarded to
  `Intl.DurationFormat` to control unit labels.
- Type-level tests using `asserttt` for `RuntimeObject`, `LauncherFunction`, `LinuxRelease`, and
  `WindowsRelease`.

### Changed

- `millisecondsToString` reimplemented on top of `Intl.DurationFormat` with a per-locale formatter
  cache.
- `millisecondsToString` now omits every zero-valued component instead of always including seconds:
  an input of `0` returns `""`, and `millisecondsToString(3_600_000)` returns `"1h"` instead of
  `"1h 0s"`.
- Dev dependencies bumped via Dependabot (`@biomejs/biome`, `@types/node`, `typedoc`, `prettier`).
- GitHub Actions bumped via Dependabot (`actions/upload-pages-artifact`, other workflow actions).
- `.github/copilot-instructions.md`, `CLAUDE.md`, and `README.md` updated for clarity.

## [0.8.6] - 2026-03-31

### Added

- `prettier` for Markdown linting and formatting (`lint` and `lint:fix` scripts).
- `.prettierrc.json` with Markdown-specific options (`proseWrap: always`, `printWidth: 120`).

### Changed

- `@biomejs/biome` updated from 2.4.9 to 2.4.10 (dev).

## [0.8.5] - 2026-03-27

### Changed

- `@logtape/logtape` updated from 2.0.4 to 2.0.5.
- `@biomejs/biome` updated from 2.4.8 to 2.4.9 (dev).
- `typedoc` updated from 0.28.17 to 0.28.18 (dev).

## [0.8.4] - 2026-03-22

### Changed

- Updated Codecov coverage badge token in `README.md`.

## [0.8.3] - 2026-03-22

### Added

- `linuxRelease` — parses `/etc/os-release` on Linux and returns key-value pairs, or `null` on other
  platforms or when the file is absent.
- `windowsRelease` — returns the Windows version name, NT kernel version string, and processor
  architecture, or `null` on non-Windows platforms.
- `LinuxRelease` and `WindowsRelease` TypeScript interfaces.

### Changed

- Test scripts now include `--experimental-test-module-mocks` to enable `mock.module()` in tests.
- CI workflow renamed to `lint/test/coverage CI` and matrix format aligned with template.
- `files` in `package.json` switched to negation-based pattern for clarity.

## [0.8.2] - 2025

### Added

- `noop` — a no-operation function that accepts any arguments and returns `undefined`.

## [0.8.1] - 2025

### Added

- `millisecondsToString` — formats a duration in milliseconds as a human-readable string (e.g.
  `"1h 2m 3s"`).
- `monitorMemory` — starts a periodic logger that reports process uptime and heap usage.
- `getDummyLogger` — returns a logger with no-op methods for use in tests.

### Changed

- `main` enhanced with overloads supporting all combinations of the optional `launcher` and
  `monitorMemoryHours` parameters.

## [0.8.0] - 2025

### Changed

- Removed the SIGKILL handler from `main`; only SIGINT, SIGTERM, `uncaughtException`, and
  `unhandledRejection` are handled.

## [0.7.0] - 2025

### Added

- SIGKILL handler in `main`.

## [0.6.0] - 2025

### Fixed

- Signal handlers in `main` changed from `process.once` to `process.on` to handle repeated signals
  correctly.

### Added

- `uncaughtException` and `unhandledRejection` handlers in `main` for improved error resilience.

## [0.5.0] - 2025

### Added

- Optional `launcher` parameter to `main`, allowing an async function to be executed on startup.

## [0.4.0] - 2025

### Added

- `defaultInterruptionHandler` parameter to `main` to opt out of automatic SIGINT/SIGTERM handling.

## [0.3.0] - 2025

### Added

- `getConsoleLogger` — creates a `Logger` backed by the Node.js `console`.

## [0.2.0] - 2025

### Changed

- Updated logger method signatures for consistency with `@logtape/logtape`.

## [0.1.0] - 2025

### Added

- Initial release with `main` — an opinionated application entry point that registers signal and
  error handlers, logs startup information, and optionally runs a launcher function.

## [0.0.1] - 2026-03-07

### Added

- Initial project scaffolding: `package.json` metadata, TypeScript configuration, and GitHub Actions
  workflow (`publish.yml`) for publishing to npm.
