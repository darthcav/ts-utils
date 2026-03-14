# @darthcav/ts-utils

![Node][node-version] ![Version][version-image] ![CI][ci-badge] ![Coverage][coverage-badge]

A collection of utility functions for TypeScript applications and modules.

[API Documentation][pages-url]

## Features

- Native TypeScript execution (Node.js type stripping, no transpiler needed at runtime)
- Strict TypeScript configuration with isolated declarations
- Biome for linting and formatting
- Built-in Node.js test runner
- TypeDoc for API documentation
- GitHub Actions CI/CD workflows

## Installation

```shell
npm install @darthcav/ts-utils
```

## Usage

### `getConsoleLogger`

Configures logging and returns a `Logger` for the given category name. Records
at or above `lowestLevel` are written to the console using an ANSI color
formatter with RFC 3339 timestamps. The internal `logtape/meta` logger is
silenced.

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

### `getDummyLogger`

Returns a no-op `Logger` useful as a placeholder in tests. All logging methods
are no-ops and `isEnabledFor` always returns `false`. `getChild` and `with`
return the same dummy logger instance.

```ts
import { getDummyLogger } from "@darthcav/ts-utils"

const logger = getDummyLogger()
// use logger in tests without any console output
```

### `main`

Bootstraps an application process: logs startup information, optionally registers
handlers for `SIGINT` and `SIGTERM` (controlled by
`defaultInterruptionHandler`, defaults to `true`), always registers handlers for
`uncaughtException` and `unhandledRejection`, then delegates to an optional
launcher function. Set `defaultInterruptionHandler` to `false` when the
application manages its own graceful shutdown (e.g. closing servers or database
connections).

`defaultInterruptionHandler` can always be omitted — pass the launcher directly
as the third argument. Use a closure inside the launcher to capture any
additional context your application needs.

```ts
import { getLogger } from "@logtape/logtape"
import { main } from "@darthcav/ts-utils"

const logger = getLogger(["my-app"])
const config = loadConfig()

main("my-app", logger, () => {
    logger.info(`Application is running`)
    startServer(config) // config captured via closure
})
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
  loggers/          # Logger utilities
  __tests__/        # Test files
dist/               # Compiled output (generated)
public/             # Documentation output (generated)
```

## License

[Apache-2.0](LICENSE)

[node-version]: https://img.shields.io/badge/node-%3E%3D25-orange.svg?style=flat-square
[version-image]: https://img.shields.io/badge/version-0.8.1-blue.svg?style=flat-square
[ci-badge]: https://github.com/darthcav/ts-utils/actions/workflows/tests.yml/badge.svg
[coverage-badge]: https://img.shields.io/badge/coverage-check%20CI-yellow.svg?style=flat-square
[pages-url]: https://darthcav.github.io/ts-utils/
