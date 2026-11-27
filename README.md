# @darthcav/ts-utils

[![Node][node-version]][node-url] ![Version][version-image] ![CI][ci-badge]
[![Coverage][coverage-badge]][coverage-url]

A collection of utility functions for TypeScript applications and modules.

## Documentation

[API Documentation][pages-url]

## Features

- `main`: bootstraps a Node.js process with startup logging, signal and error handlers, graceful
  shutdown of application resources, log flushing on exit, and optional memory monitoring.
- `getConsoleLogger` and `getDummyLogger`: a configured LogTape console logger, and a no-op logger
  for tests.
- `monitorMemory`: periodic uptime and memory usage reports.
- `millisecondsToString`: human-readable, localized durations.
- `osRelease`: OS name, version, and architecture on Linux, macOS, and Windows.
- Type guards and narrowing helpers (`isString`/`asString`, `isBoolean`/`asBoolean`,
  `isFiniteNumber`/`asFiniteNumber`, `isRuntimeObject`/`asRuntimeObject`, `isArrayOf`/`asArrayOf`,
  `filterByGuard`, `toRuntimeObjectArray`): narrow `unknown` values such as parsed JSON without type
  assertions.
- `Assert`, `Equal`, `Extends`, `Not`, `IsAny`, `IsNever`, and `IsUnknown`: type-level assertions
  for tests.
- `noop`: a function that does nothing.

ESM only, with TypeScript declarations included; requires Node.js 26 or later.

## Installation

```shell
npm install @darthcav/ts-utils
```

## Entry points

The root entry point re-exports everything. Subpath entry points load only one domain:

| Import                            | Contents                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `@darthcav/ts-utils`              | Everything below.                                                                  |
| `@darthcav/ts-utils/core`         | Type guards and narrowing helpers, `millisecondsToString`, `noop`. Portable.       |
| `@darthcav/ts-utils/node`         | `main`, `monitorMemory`, `osRelease`.                                              |
| `@darthcav/ts-utils/loggers`      | `getConsoleLogger`, `getDummyLogger` (LogTape).                                    |
| `@darthcav/ts-utils/type-testing` | `Assert`, `Equal`, `Extends`, `Not`, `IsAny`, `IsNever`, `IsUnknown` (types only). |

```ts
import { asString } from "@darthcav/ts-utils/core"
import { main } from "@darthcav/ts-utils/node"
import { getConsoleLogger } from "@darthcav/ts-utils/loggers"
import type { Assert, Equal } from "@darthcav/ts-utils/type-testing"
```

The `core` entry point imports no Node.js built-ins and no packages, so its helpers run in any
runtime that supports ES2025 (`millisecondsToString` also needs `Intl.DurationFormat` and
`Temporal`).

## Usage

### `getConsoleLogger`

Configures LogTape globally and resolves to a `Logger` for the given category name. Records at or
above `lowestLevel` are written to the console with RFC 3339 timestamps, and the internal
`logtape/meta` logger is silenced.

Each call replaces the whole global LogTape configuration, including one made by the application, so
the latest call wins. Applications that configure LogTape themselves should not call it; they get
their loggers from LogTape's `getLogger` and can pass them to `main` (see its `flushLogs` option).

ANSI colors are used only when both stdout and stderr are terminals that support them (respecting
`NO_COLOR`, `NODE_DISABLE_COLORS`, and `TERM=dumb`), so logs redirected to files or pipes stay free
of escape codes. Set `FORCE_COLOR` to override: `0` or `false` disables colors, any other value
enables them.

```ts
import { getConsoleLogger, main } from "@darthcav/ts-utils"

const logger = await getConsoleLogger("my-app")

main("my-app", logger, {
    launcher: () => {
        logger.info(`Application is running`)
        // start servers, connect to databases, etc.
    },
})
```

Pass a second argument to change the minimum log level (defaults to `"info"`):

```ts
const logger = await getConsoleLogger("my-app", "debug")
```

### `monitorMemory`

Starts a periodic interval that logs process uptime and memory usage (in bytes) through a
`"monitorMemory"` child category of the given logger. The interval defaults to every 24 hours and
must be between one minute (`1 / 60`) and about 596.5 hours (2³¹ − 1 ms, the longest delay
`setInterval` supports); anything outside that range throws a `RangeError`.

It returns a function that stops the monitoring. The timer is unreferenced, so monitoring alone does
not keep the process alive. Each report also attaches its figures as structured properties (`uptime`
and `uptimeMs`; `rss`, `heapTotal`, `heapUsed`, and `external`), so sinks that keep properties, such
as JSON Lines, can query them. With `main`, use its `monitorMemoryHours` option instead.

```ts
import { getConsoleLogger, monitorMemory } from "@darthcav/ts-utils"

const logger = await getConsoleLogger("my-app")

monitorMemory(logger)                  // every 24 hours
const stop = monitorMemory(logger, 1)  // every hour
// later:
stop()
```

### `millisecondsToString`

Converts a duration in milliseconds to a human-readable string via `Intl.DurationFormat`.
Milliseconds are shown as their own integer component (fractional inputs are rounded to the nearest
millisecond), and any zero-valued components are omitted — so a zero-millisecond input returns an
empty string. Negative durations are formatted from their magnitude and prefixed with `"-"`. An
optional BCP 47 locale tag (default `"en"`) controls the unit labels. Throws a `RangeError` if `ms`
is not finite or `locale` is not a valid BCP 47 tag.

```ts
import { millisecondsToString } from "@darthcav/ts-utils"

millisecondsToString(3_661_000)        // "1h 1m 1s"
millisecondsToString(90_000)           // "1m 30s"
millisecondsToString(5_250)            // "5s 250ms"
millisecondsToString(499)              // "499ms"
millisecondsToString(-90_000)          // "-1m 30s"
millisecondsToString(90_061_000, "es") // "1d 1h 1min 1s"
```

### `noop`

Does nothing. Useful as a placeholder callback or default handler.

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

### Type guards and narrowing helpers

Narrow `unknown` values (e.g. parsed JSON) without type assertions:

- `isRuntimeObject`, `isString`, `isBoolean`, and `isFiniteNumber` are type guards for use in
  conditions. `isBoolean` and `isFiniteNumber` accept primitives only; `isFiniteNumber` rejects
  `NaN`, `Infinity`, and `-Infinity`.
- `asRuntimeObject`, `asString`, `asBoolean`, and `asFiniteNumber` return the value, or `undefined`
  when it does not match, for use with `?.` and `??`.
- `isArrayOf(value, guard)` checks that a value is an array whose elements **all** pass a guard; one
  invalid element makes it fail, and an empty array passes. `asArrayOf` is its narrowing helper.
- `filterByGuard(value, guard)` keeps the elements that pass a guard and silently drops the others;
  a value that is not an array yields `[]`. Use it to filter, and `isArrayOf` to validate.
- `toRuntimeObjectArray` keeps only the plain-object elements of an array (`filterByGuard` with
  `isRuntimeObject`).
- `TypeGuard<T>` is the type of a guard (`(value: unknown) => value is T`), for writing your own.

A runtime object is a plain object (an object literal, a `JSON.parse` result, or an
`Object.create(null)` object); arrays, class instances, and built-ins such as `Date` or `Map` are
rejected. Keys are not sanitized: an own `__proto__` or `constructor` key from untrusted JSON is
kept, so guard against those keys before merging the value into other objects.

```ts
import {
    asArrayOf,
    asFiniteNumber,
    asRuntimeObject,
    asString,
    filterByGuard,
    isRuntimeObject,
    isString,
    toRuntimeObjectArray,
} from "@darthcav/ts-utils/core"

const body: unknown = JSON.parse(input)

if (isRuntimeObject(body) && isString(body["name"])) {
    console.log(body["name"].toUpperCase()) // narrowed to string
}

const config = asRuntimeObject(body)
const name = asString(config?.["name"]) ?? "anonymous"
const port = asFiniteNumber(config?.["port"]) ?? 3000
const tags = asArrayOf(config?.["tags"], isString) // string[] | undefined (all or nothing)
const someTags = filterByGuard(config?.["tags"], isString) // string[] (invalid ones dropped)
const items = toRuntimeObjectArray(config?.["items"])
```

### `osRelease`

Returns OS release information for the current platform as an `OsRelease` object, or `null` on
unsupported platforms or when the release file cannot be read. The normalized fields `name`,
`version`, and `arch` are present on every platform.

- On Linux, the data comes from `/etc/os-release`, falling back to `/usr/lib/os-release`, and all
  raw key-value pairs (e.g. `PRETTY_NAME`, `ID`, `ID_LIKE`) are also accessible by string index.
  Values are unquoted as in a shell; comments and keys that are not upper-case variable names (such
  as `__proto__`) are skipped.
- On macOS, the data comes from `/System/Library/CoreServices/SystemVersion.plist`: `name` is the
  product name (`"macOS"`) and `version` the product version (e.g. `"15.1"`) — never the Darwin
  kernel version, which `os.release()` returns. The string keys of the file (e.g.
  `ProductBuildVersion`) are also accessible by string index.
- On Windows, `version` is the kernel version and `name` tells Windows 11 from Windows 10 by build
  number.

```ts
import { asString, osRelease } from "@darthcav/ts-utils"

const info = osRelease()
if (info) {
    console.log(info.name)    // e.g. "Ubuntu", "macOS", or "Windows 11"
    console.log(info.version) // e.g. "24.04", "15.1", or "10.0.22000"
    console.log(info.arch)    // e.g. "x64"
    // Raw keys are `unknown`; narrow them before use.
    const prettyName = asString(info["PRETTY_NAME"]) // e.g. "Ubuntu 24.04 LTS" (Linux only)
}
```

### `getDummyLogger`

Returns a no-op `Logger` (synchronously) useful as a placeholder in tests. All logging methods are
no-ops and `isEnabledFor` always returns `false`. `getChild` and `with` return the same dummy logger
instance. Each call returns a new instance, so mocking a method on one does not affect others.

```ts
import { getDummyLogger } from "@darthcav/ts-utils"

const logger = getDummyLogger()
// use logger in tests without any console output
```

### `main`

Bootstraps an application process: logs startup information, optionally registers handlers for
`SIGINT` and `SIGTERM`, always registers handlers for `uncaughtException` and `unhandledRejection`,
optionally starts memory monitoring, then runs an optional launcher function.

The process title, PID, name, and `NODE_ENV` are logged at `info` level. The Node.js process options
(`execArgv` and `NODE_OPTIONS`) are logged at `debug` level only, since they can reveal sensitive
flags such as `--inspect=0.0.0.0`.

On `SIGINT`/`SIGTERM`, an uncaught exception, an unhandled rejection, or a launcher failure, `main`
runs a shutdown sequence once:

1. It logs the cause (signals at `info`, failures at `error` level) and stops the memory monitoring.
2. It runs your `shutdown` function, if any, for at most `shutdownTimeoutMs` (10 seconds by
   default). The function receives a `ShutdownContext`: `{ reason: "signal", signal }` for a normal
   stop, or `{ reason: "error", source, error }` for a fatal failure, where `source` is
   `"uncaughtException"`, `"unhandledRejection"`, or `"launcher"`. A rejection, exception, or
   timeout is logged at `error` level.
3. It flushes the logs with `flushLogs` (LogTape's `dispose` by default) for at most
   `flushTimeoutMs` (3 seconds by default), so asynchronous sinks keep the final messages.
4. It exits. A signal is re-raised, so the process ends as killed by it (exit status 130/143), which
   shells and supervisors such as systemd treat as a clean stop; if another listener for that signal
   exists, it exits with status `128 + signal number` instead. Fatal failures, and a failed or
   timed-out `shutdown` function, exit with status `1`, so supervisors notice the failed cleanup.

A second signal or fatal failure during the sequence exits immediately. After a fatal failure the
application may be in an inconsistent state, so check `context.reason` and only clean up, e.g. close
connections.

Optional settings are passed as a `MainOptions` object:

| Option                       | Type                                 | Default           | Description                                                     |
| ---------------------------- | ------------------------------------ | ----------------- | --------------------------------------------------------------- |
| `launcher`                   | `() => void \| Promise<void>`        | —                 | Runs after the handlers are registered; may be async.           |
| `shutdown`                   | `(context) => void \| Promise<void>` | —                 | Cleans up application resources once, before the process exits. |
| `shutdownTimeoutMs`          | `number`                             | `10000`           | Longest wait for `shutdown` (0 to 2³¹ − 1 ms).                  |
| `monitorMemoryHours`         | `number`                             | `0`               | Logs memory usage every N hours; `0` disables it.               |
| `defaultInterruptionHandler` | `boolean`                            | `true`            | Register the `SIGINT`/`SIGTERM` handlers.                       |
| `flushLogs`                  | `() => void \| Promise<void>`        | LogTape `dispose` | Flushes the log sinks before exiting; `noop` skips flushing.    |
| `flushTimeoutMs`             | `number`                             | `3000`            | Longest wait for `flushLogs` (0 to 2³¹ − 1 ms).                 |

An out-of-range `monitorMemoryHours` (negative, `NaN`, or outside `monitorMemory`'s range),
`shutdownTimeoutMs`, or `flushTimeoutMs` throws a `RangeError`, and a `launcher`, `shutdown`, or
`flushLogs` that is not a function throws a `TypeError`, before anything is logged or registered. If
the launcher throws or its promise rejects, the failure is logged and the shutdown sequence runs.

The default `flushLogs` disposes the sinks configured through the `@logtape/logtape` copy this
package uses. If the application configures another copy (e.g. a different LogTape version, whose
configuration this package cannot reach), pass that copy's `dispose` instead.

`main` returns a teardown function that removes the handlers it registered and stops the memory
monitoring (it neither runs `shutdown` nor exits the process). Only one `main` call can be active at
a time: calling it again before the teardown throws.

```ts
import { dispose, getLogger } from "@logtape/logtape"
import { main } from "@darthcav/ts-utils"

const logger = getLogger(["my-app"])

// Call main() once per process. Alternatives:

// 1. All defaults:
main("my-app", logger)

// 2. An async launcher and memory logging every 2 hours:
main("my-app", logger, {
    launcher: async () => {
        await connectToDatabase()
        startServer()
    },
    monitorMemoryHours: 2,
})

// 3. Graceful shutdown of the application's resources:
let server: Server | undefined
main("my-app", logger, {
    launcher: async () => {
        await connectToDatabase()
        server = startServer()
    },
    shutdown: async (context) => {
        if (context.reason === "error") {
            logger.warn`Shutting down after a failure in ${context.source}`
        }
        await server?.close()
        await disconnectFromDatabase()
    },
    shutdownTimeoutMs: 15_000,
})

// 4. Keep your own LogTape setup (e.g. another LogTape version) and flush it yourself:
main("my-app", logger, { flushLogs: dispose })
```

The positional forms of earlier versions (e.g. `main("my-app", logger, () => startServer(), 2)`)
were removed in 0.11.0; passing anything other than an options object throws a `TypeError`.

### Type testing

Type-level helpers to check types at compile time, e.g. in test files. They are types only, so they
add no code at runtime:

- `Assert<T>` type-checks only when `T` is exactly `true`.
- `Equal<X, Y>` is `true` when `X` and `Y` are identical types. It is stricter than mutual
  assignability: `any` only equals `any`, and `readonly` and `?` modifiers must match.
- `Extends<X, Y>` is `true` when `X` is assignable to `Y` (unions are compared as a whole).
- `Not<T>` negates a predicate result.
- `IsAny<T>`, `IsNever<T>`, and `IsUnknown<T>` detect those special types.

Declare each assertion as an (unused) type alias; a failing one is reported by `tsc` (e.g.
`tsc --noEmit`), not by the test runner, since Node.js strips types without checking them. Use
`@ts-expect-error` to assert that an assertion fails.

```ts
import {
    type Assert,
    asString,
    type Equal,
    type IsUnknown,
    type Not,
} from "@darthcav/ts-utils"

type _AsString = Assert<Equal<ReturnType<typeof asString>, string | undefined>>
type _NotAny = Assert<Not<Equal<ReturnType<typeof asString>, any>>>
type _Parsed = Assert<IsUnknown<Parameters<typeof asString>[0]>>
// @ts-expect-error -- `string` is not `number`
type _Fails = Assert<Equal<string, number>>
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
  index.ts                   # Root entry point (re-exports every domain)
  core/                      # @darthcav/ts-utils/core (portable)
    guards.ts                #   RuntimeObject, TypeGuard, type guards and narrowing helpers
    millisecondsToString.ts  #   Duration formatting
    noop.ts                  #   No-op function
  node/                      # @darthcav/ts-utils/node
    main.ts                  #   Process bootstrap and shutdown (main)
    monitorMemory.ts         #   Periodic memory reporting
    osRelease.ts             #   OS release information
    releaseParsers.ts        #   os-release and plist parsers (internal)
    delays.ts                #   Timer delay limit and range check (internal)
  loggers/                   # @darthcav/ts-utils/loggers (LogTape helpers)
  type-testing/              # @darthcav/ts-utils/type-testing (type-level assertions)
  __tests__/                 # Test files, shared helpers, and child-process fixtures
dist/                        # Compiled output (generated)
public/                      # Documentation output (generated)
```

## License

[Apache-2.0](LICENSE)

[node-version]: https://img.shields.io/badge/node-%3E%3D26-orange.svg?style=flat-square
[node-url]: https://nodejs.org
[version-image]: https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square
[ci-badge]: https://github.com/darthcav/ts-utils/actions/workflows/tests.yml/badge.svg
[coverage-badge]:
    https://codecov.io/github/darthcav/ts-utils/branch/dev/graph/badge.svg?token=RNEPER4KEI
[coverage-url]: https://codecov.io/github/darthcav/ts-utils
[pages-url]: https://darthcav.github.io/ts-utils/
