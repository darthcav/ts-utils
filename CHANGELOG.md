# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.3] - 2026-03-22

### Added

- `linuxRelease` — parses `/etc/os-release` on Linux and returns key-value pairs, or `null` on other platforms or when the file is absent.
- `windowsRelease` — returns the Windows version name, NT kernel version string, and processor architecture, or `null` on non-Windows platforms.
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

- `millisecondsToString` — formats a duration in milliseconds as a human-readable string (e.g. `"1h 2m 3s"`).
- `monitorMemory` — starts a periodic logger that reports process uptime and heap usage.
- `getDummyLogger` — returns a logger with no-op methods for use in tests.

### Changed

- `main` enhanced with overloads supporting all combinations of the optional `launcher` and `monitorMemoryHours` parameters.

## [0.8.0] - 2025

### Changed

- Removed the SIGKILL handler from `main`; only SIGINT, SIGTERM, `uncaughtException`, and `unhandledRejection` are handled.

## [0.7.0] - 2025

### Added

- SIGKILL handler in `main`.

## [0.6.0] - 2025

### Fixed

- Signal handlers in `main` changed from `process.once` to `process.on` to handle repeated signals correctly.

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

- Initial release with `main` — an opinionated application entry point that registers signal and error handlers, logs startup information, and optionally runs a launcher function.
