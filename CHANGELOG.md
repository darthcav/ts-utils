# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.11.0] - 2026-10-02

This release changes the signature and behavior of `main`, `osRelease`, `asRuntimeObject`, and
`toRuntimeObjectArray`; entries marked **Breaking** may need attention when upgrading.

### Added

- `main` accepts its optional settings as a `MainOptions` object
  (`main(name, logger, { launcher, monitorMemoryHours, defaultInterruptionHandler, flushTimeoutMs })`),
  exported as a type.
- `main` returns a teardown function that removes the process handlers it registered and stops the
  memory monitoring it started, so `main` can be called again (e.g. in tests). Calling it more than
  once is harmless.
- `main` accepts an async launcher (`LauncherFunction` is now `() => void | Promise<void>`).
- The `flushTimeoutMs` option makes the log flush timeout on shutdown configurable (default 3000 ms;
  out-of-range values throw a `RangeError`).
- `monitorMemory` returns a function that stops the monitoring (calling it more than once is
  harmless).
- `monitorMemory` reports attach their figures as structured properties: `uptime` (formatted) and
  `uptimeMs` on the uptime record; `rss`, `heapTotal`, `heapUsed`, and `external` on the memory
  record. The rendered message text is unchanged.
- `isRuntimeObject` and `isString` type guards, the predicate counterparts of `asRuntimeObject` and
  `asString` (which now delegate to them, so both always agree).

### Changed

- **Breaking:** the positional forms of `main`
  (`main(name, logger, launcher?, monitorMemoryHours?, defaultInterruptionHandler?)` and their
  subsets) are removed in favor of the options object. Migrate e.g.
  `main(name, logger, launcher, 2, false)` to
  `main(name, logger, { launcher, monitorMemoryHours: 2, defaultInterruptionHandler: false })`. A
  non-object third argument now throws a `TypeError`.
- **Breaking:** `main` throws if called again while a previous call is still active (i.e. before its
  teardown runs), instead of registering a second set of process handlers.
- **Breaking:** if the launcher throws or its promise rejects, `main` logs the failure and exits
  with status `1` after flushing the logs, instead of letting a synchronous error propagate to the
  caller.
- **Breaking:** the `monitorMemory` interval timer is now unreferenced, so monitoring alone no
  longer keeps the process alive. A process whose only remaining work is the monitoring interval now
  exits instead of running forever.
- **Breaking:** on `SIGINT`/`SIGTERM`, `main` no longer exits with status `0`. After flushing the
  logs it re-raises the signal, so the process ends as killed by it (exit status 130/143 in a
  shell), which is what shells and supervisors such as systemd expect for a clean stop. If another
  listener for the signal is registered, it exits with status `128 + signal number` instead. The
  signal is now logged at `info` instead of `error` level.
- **Breaking:** `getDummyLogger` now returns the `Logger` directly instead of a `Promise<Logger>`.
  `await getDummyLogger()` keeps working, but code calling `.then()` on the result must drop it. It
  no longer needs `as unknown as` casts: every logging method is a single no-op that satisfies all
  logtape overloads, returning an already-settled promise for the async-properties ones.

- All modules now use named exports only (enforced by Biome's `noDefaultExport` rule), and
  `src/os-utils.ts` is renamed to `src/osRelease.ts` so single-function modules are named after
  their function. The public API is unchanged: the package only exposes its root entry point, whose
  named exports are now pinned by a test.
- `@logtape/logtape` updated from 2.3.0 to 2.3.10.
- `@biomejs/biome` (2.5.7 → 2.5.15), `@types/node` (26.2.0 → 26.6.4), and `prettier` (3.9.6 → 3.9.9)
  dev dependencies updated.
- `CLAUDE.md` documents the `main`/`dev` branching strategy, the release process, and the release
  gates in `publish.yml`.

### Fixed

- `main` now starts memory monitoring (which validates `monitorMemoryHours`) before registering any
  process handler, so an invalid value throws a `RangeError` with nothing left registered.
- `getConsoleLogger` no longer writes ANSI escape codes when its output is not a color terminal.
  Colors are used only when both stdout and stderr are terminals that support them (respecting
  `NO_COLOR`, `NODE_DISABLE_COLORS`, and `TERM=dumb`); otherwise the plain text formatter with the
  same timestamp and level options is used. `FORCE_COLOR` overrides the detection (`0`/`false`
  disable, any other value enables).
- `main` now flushes and disposes the configured logtape sinks (for at most 3 seconds) before
  exiting on a signal, an uncaught exception, or an unhandled rejection. Previously it called
  `process.exit()` immediately, so buffered or asynchronous sinks (files, remote collectors) could
  lose the final messages, including the crash details. A second signal or error during the flush
  exits immediately.
- `monitorMemory` now rejects intervals longer than 2³¹ − 1 ms (about 596.5 hours) or shorter than
  one minute with a `RangeError`. Previously, Node.js silently replaced oversized delays with 1 ms,
  so a value such as `monitorMemory(logger, 1000)` (or `main(name, logger, 1000)`) flooded the logs
  with a report every millisecond.
- `osRelease` no longer throws when `/etc/os-release` exists but cannot be read (e.g. `EACCES`); it
  returns `null` instead, as documented. It now falls back to `/usr/lib/os-release`, skips comment
  lines, and unquotes single-quoted values and backslash escapes inside double quotes. **Breaking:**
  a value with an unbalanced quote is now kept as-is instead of having that single quote character
  stripped.
- The `sync-dev.yml` workflow no longer reports real `gh pr create` failures (e.g. Actions lacking
  permission to open PRs) as "nothing to sync"; only the "no commits between" case is a no-op.
- The `sync-dev.yml` workflow merges the `main` → `dev` sync PR right after opening it instead of
  relying on `gh pr merge --auto`, which needs branch protection on `dev` and otherwise left the PR
  open forever.

### Security

- **Breaking:** `main` now logs the Node.js process options (`execArgv` and `NODE_OPTIONS`) at
  `debug` instead of `info` level, since they can reveal sensitive flags such as `--inspect=0.0.0.0`
  or `--require` paths. Configure the logger with `lowestLevel: "debug"` to keep seeing them.
- **Breaking:** `osRelease` only accepts upper-case shell variable names as os-release keys and
  parses into a null-prototype record, so keys such as `__proto__` or `constructor` (and any
  lower-case keys) are skipped.
- **Breaking:** `asRuntimeObject` (and therefore `toRuntimeObjectArray`) now accepts only plain
  objects: object literals, `JSON.parse` results, and null-prototype objects, including those from
  other realms. Class instances and built-ins such as `Date`, `Map`, `Set`, `RegExp`, or module
  namespace objects now yield `undefined`. Previously any non-array object was accepted, contrary to
  the documented "runtime JSON object" contract. The docs now also warn that own
  `__proto__`/`constructor` keys are not sanitized.
- `npm ci` runs with `--ignore-scripts` in CI, so dependency install scripts never run (in
  particular not in jobs holding an OIDC token).
- Checkouts use `persist-credentials: false`; `tests.yml` now sets `contents: read` explicitly, and
  `gh-pages.yml` grants `pages: write`/`id-token: write` only to the deploy job.
- `publish.yml` gains a `verify` job that runs without the npm OIDC token: it checks that the tag
  matches the `package.json` version and is on `main`, then runs lint, typecheck, and tests. The
  `publish` job runs in an `npm` environment (for required-reviewer approval), skips the npm cache,
  and publishes with `--ignore-scripts` after an explicit build.

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
