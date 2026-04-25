# @darthcav/ts-utils

[![Node][node-version]][node-url] ![Version][version-image] ![CI][ci-badge]
[![Coverage][coverage-badge]][coverage-url]

A collection of utility functions for TypeScript applications and modules.

## Documentation

[API Documentation][pages-url]

## Features

- Native TypeScript execution (Node.js type stripping, no transpiler needed at runtime)
- Strict TypeScript configuration with isolated declarations
- Biome for linting and formatting, Prettier for Markdown
- Built-in Node.js test runner
- TypeDoc for API documentation
- GitHub Actions CI/CD workflows

## Installation

```shell
npm install @darthcav/ts-utils
```

## Usage

### `getConsoleLogger`

Configures logging and returns a `Logger` for the given category name. Records at or above
`lowestLevel` are written to the console using an ANSI color formatter with RFC 3339 timestamps. The
internal `logtape/meta` logger is silenced.

```ts
import { getConsoleLogger, main } from "@darthcav/ts-utils"

const logger = await getConsoleLogger("my-app")

main("my-app", logger, () => {
    logger.info(`Application is running`)
    // start servers, connect to databases, etc.
})
```

Pass a second argument to change the minimum log level (defaults to `"info"`):

```ts
const logger = await getConsoleLogger("my-app", "debug")
```

### `monitorMemory`

Starts a periodic interval that logs process uptime and memory usage (in bytes). The interval
defaults to every 24 hours.

```ts
import { getConsoleLogger, main, monitorMemory } from "@darthcav/ts-utils"

const logger = await getConsoleLogger("my-app")

main("my-app", logger, () => {
    monitorMemory(logger)      // every 24 hours
    monitorMemory(logger, 1)   // every hour
})
```

### `millisecondsToString`

Converts a duration in milliseconds to a human-readable string via `Intl.DurationFormat`. Sub-second
values are rounded to the nearest second, and any zero-valued components are omitted — so a
zero-millisecond input returns an empty string. An optional BCP 47 locale tag (default `"en"`)
controls the unit labels.

```ts
import { millisecondsToString } from "@darthcav/ts-utils"

millisecondsToString(3_661_000)        // "1h 1m 1s"
millisecondsToString(90_000)           // "1m 30s"
millisecondsToString(5_000)            // "5s"
millisecondsToString(90_061_000, "es") // "1d 1h 1min 1s"
```

### `noop`

A no-op function that does nothing and returns `void`. Useful as a placeholder callback or default
handler.

```ts
import { noop } from "@darthcav/ts-utils"

setTimeout(noop, 1000)
element.addEventListener("click", noop)
```

### `RuntimeObject`

Represents an object whose keys and values are only known at runtime. It is defined as
`Record<string, unknown>` so values must be narrowed before use.

```ts
import type { RuntimeObject } from "@darthcav/ts-utils"

const payload: RuntimeObject = {
    id: 123,
    metadata: { active: true },
}
```

### `osRelease`

Returns OS release information for the current platform as an `OsRelease` object, or `null` on
unsupported platforms or when `/etc/os-release` is absent on Linux.

The `OsRelease` type exposes three normalized fields — `name`, `version`, and `arch` — present on
all platforms. On Linux, all raw key-value pairs from `/etc/os-release` (e.g. `PRETTY_NAME`, `ID`,
`ID_LIKE`) are also accessible by string index.

```ts
import { osRelease } from "@darthcav/ts-utils"

const info = osRelease()
if (info) {
    console.log(info.name)        // e.g. "Ubuntu" or "Windows 11"
    console.log(info.version)     // e.g. "24.04" or "10.0.22000"
    console.log(info.arch)        // e.g. "x64"
    console.log(info.PRETTY_NAME) // e.g. "Ubuntu 24.04 LTS" (Linux only)
}
```

### `getDummyLogger`

Returns a no-op `Logger` useful as a placeholder in tests. All logging methods are no-ops and
`isEnabledFor` always returns `false`. `getChild` and `with` return the same dummy logger instance.

```ts
import { getDummyLogger } from "@darthcav/ts-utils"

const logger = getDummyLogger()
// use logger in tests without any console output
```

### `main`

Bootstraps an application process: logs startup information, optionally registers handlers for
`SIGINT` and `SIGTERM` (controlled by `defaultInterruptionHandler`, defaults to `true`), always
registers handlers for `uncaughtException` and `unhandledRejection`, then delegates to an optional
launcher function.

The three optional parameters — `launcher` (function), `monitorMemoryHours` (number, defaults to
`0`), and `defaultInterruptionHandler` (boolean, defaults to `true`) — have distinct types. Any
subset can be passed in order and the function resolves each by type, so middle parameters can be
omitted:

```ts
import { getLogger } from "@logtape/logtape"
import { main } from "@darthcav/ts-utils"

const logger = getLogger(["my-app"])

main("my-app", logger)                            // all defaults
main("my-app", logger, () => startServer())       // launcher only
main("my-app", logger, 2)                         // monitor every 2h
main("my-app", logger, false)                     // disable SIGINT/SIGTERM handler
main("my-app", logger, () => startServer(), 2)    // launcher + monitor
main("my-app", logger, () => startServer(), false)// launcher + no handler
main("my-app", logger, 2, false)                  // monitor + no handler
main("my-app", logger, () => startServer(), 2, false) // all three
```

For the full API reference see the [API Documentation][pages-url].

## Development

```shell
# Install dependencies
npm install

# Type-check
npm run typecheck

# Build (compile to JavaScript)
npm run build

# Run tests
npm test

# Lint and format
npm run lint
npm run lint:fix

# Generate documentation
npm run doc
```

## Project Structure

```
src/
  index.ts          # Public API entry point
  main.ts           # Main module
  noop.ts           # No-op function
  os-utils.ts       # OS release utilities
  loggers/          # Logger utilities
  __tests__/        # Test files
dist/               # Compiled output (generated)
public/             # Documentation output (generated)
```

## License

[Apache-2.0](LICENSE)

[node-version]: https://img.shields.io/badge/node-%3E%3D25-orange.svg?style=flat-square
[node-url]: https://nodejs.org
[version-image]: https://img.shields.io/badge/version-0.9.1-blue.svg?style=flat-square
[ci-badge]: https://github.com/darthcav/ts-utils/actions/workflows/tests.yml/badge.svg
[coverage-badge]:
    https://codecov.io/github/darthcav/ts-utils/branch/dev/graph/badge.svg?token=RNEPER4KEI
[coverage-url]: https://codecov.io/github/darthcav/ts-utils
[pages-url]: https://darthcav.github.io/ts-utils/
