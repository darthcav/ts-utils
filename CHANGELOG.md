# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.10] - 2026-08-10

### Fixed

- `.github/dependabot.yml` no longer uses an invalid `cronjob` expression. The "first Saturday of
  the month" schedule relied on a `*/100,1-7 * 6` trick meant to force day-of-month/day-of-week to
  combine with AND; Dependabot rejected it as invalid (standard 5-field cron only ORs those fields).
  Both `npm` and `github-actions` updates now use `interval: monthly` instead.

## [0.10.9] - 2026-08-10

### Changed

- `@logtape/logtape` updated from 2.2.4 to 2.3.0.
- `@biomejs/biome`, `@types/node`, and `prettier` dev dependencies updated.
- `brace-expansion`, `mdurl`, and `minimatch` transitive dependencies updated.
- Dependabot checks now run on the first Saturday of each month instead of weekly.

## [0.10.8] - 2026-07-18

### Changed

- `monitorMemory` now emits its reports through a `"monitorMemory"` child category of the given
  logger instead of logging directly with it.
- `millisecondsToString` now shows milliseconds as their own integer component (e.g. `5_250` →
  `"5s 250ms"`, `499` → `"499ms"`) instead of rounding sub-second values to the nearest second.
  Fractional inputs are rounded to the nearest millisecond.
- `@logtape/logtape` updated from 2.1.5 to 2.2.4.
- `@biomejs/biome`, `@types/node`, `prettier`, and `typedoc` dev dependencies updated.
- `actions/setup-node` and `actions/checkout` updated in the GitHub Actions workflows.

## [0.10.7] - 2026-06-18

### Changed

- `@logtape/logtape` updated from 2.1.4 to 2.1.5.

### Security

- `millisecondsToString` now bounds its internal `Intl.DurationFormat` cache to 64 entries, evicting
  the least-recently-inserted formatter when full. This prevents unbounded memory growth when many
  distinct (valid) locales are requested, e.g. a locale derived from untrusted input.
- `monitorMemory` now throws a `RangeError` when `hours` is not a finite number greater than `0`.
  Previously a non-positive value produced a degenerate `setInterval` delay (clamped to ~0), causing
  a tight logging loop.

## [0.10.6] - 2026-06-15

### Fixed

- `main` now logs via logtape's tagged-template form instead of pre-interpolated strings. Previously
  any `{...}` in an interpolated value (notably error stacks and `NODE_OPTIONS` containing JSON or
  object literals) was parsed by logtape as a message placeholder and replaced with `null`,
  corrupting crash diagnostics and startup logs.
- `getConsoleLogger` no longer throws when called more than once. It now configures logtape with
  `reset: true`, so repeated calls reconfigure cleanly instead of failing with "Already configured".
- `millisecondsToString` now throws a clear `RangeError` for non-finite `ms` (`NaN`, `Infinity`) and
  for an invalid `locale`, instead of surfacing a cryptic `Intl`/`Temporal` error.
- `millisecondsToString` now formats negative durations from their magnitude with a leading `"-"`
  (e.g. `-90_000` → `"-1m 30s"`) instead of producing nonsensical mixed-component output.

## [0.10.5] - 2026-06-15

### Changed

- `@logtape/logtape` updated from 2.1.1 to 2.1.4.
- `@biomejs/biome`, `@types/node`, and other dev dependencies updated.
- `codecov-action` updated to v7 in the GitHub Actions workflow.

## [0.10.4] - 2026-05-24

### Changed

- `markdown-it` updated to 14.2.0 (transitive, via `typedoc`).
- `linkify-it` updated to 5.0.1 (transitive, via `typedoc`).

## [0.10.3] - 2026-05-24

### Changed

- `@logtape/logtape` updated from 2.0.7 to 2.1.1.
- `@types/node` updated from 25.8.0 to 25.9.1 (dev).

## [0.10.2] - 2026-05-16

### Fixed

- Test files (`dist/__tests__`) excluded from the published package; they were inadvertently
  included.

### Changed

- Minimum Node.js engine raised from `>=25` to `>=26`.
- `@biomejs/biome` updated from 2.4.14 to 2.4.15 (dev).
- `@types/node` updated from 25.6.2 to 25.8.0 (dev).
- `yaml` updated from 2.8.4 to 2.9.0 (dev).

## [0.10.1] - 2026-05-09

### Changed

- `@logtape/logtape` updated from 2.0.5 to 2.0.7.
- `@biomejs/biome` updated from 2.4.13 to 2.4.14 (dev).
- `@types/node` updated from 25.6.0 to 25.6.2 (dev).

## [0.10.0] - 2026-04-26

### Added

- `asRuntimeObject` — narrows an `unknown` value to `RuntimeObject` when the value is a non-array
  object, returning `undefined` otherwise.
- `asString` — narrows an `unknown` value to `string`, returning `undefined` when the value is not a
  string.
- `toRuntimeObjectArray` — filters an `unknown` value down to a `RuntimeObject[]`, keeping only the
  elements that are non-array objects; returns an empty array for non-array inputs.

## [0.9.0] - 2026-04-22

### Added

- `osRelease` — returns OS release information for the current platform, or `null` on unsupported
  platforms or when `/etc/os-release` is absent on Linux. On Linux, normalizes `NAME`/`PRETTY_NAME`
  → `name`, `VERSION_ID`/`VERSION` → `version`, and `os.arch()` → `arch`, while preserving all raw
  `/etc/os-release` keys on the returned object. On Windows, distinguishes Windows 11 from Windows
  10 by NT build number (>= 22000 → Windows 11).
- `OsRelease` — unified type with fixed `name`, `version`, and `arch` fields plus a string index
  signature for platform-specific extras (e.g. raw `/etc/os-release` keys on Linux).

### Removed

- `linuxRelease` — replaced by `osRelease`.
- `windowsRelease` — replaced by `osRelease`.
- `LinuxRelease` — replaced by `OsRelease`.
- `WindowsRelease` — replaced by `OsRelease`.

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
