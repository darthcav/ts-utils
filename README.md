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

### `main`

Bootstraps an application process: logs startup information, registers handlers
for `SIGINT`, `SIGTERM`, `uncaughtException`, and `unhandledRejection`, then
delegates to an optional launcher function.

```ts
import { getLogger } from "@logtape/logtape"
import { main } from "@darthcav/ts-utils"

main("my-app", getLogger(["my-app"]), (name, logger) => {
    logger.info(`${name} is running`)
    // start servers, connect to databases, etc.
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
  __tests__/        # Test files
dist/               # Compiled output (generated)
public/             # Documentation output (generated)
```

## License

[Apache-2.0](LICENSE)

[node-version]: https://img.shields.io/badge/node-%3E%3D25-orange.svg?style=flat-square
[version-image]: https://img.shields.io/badge/version-0.1.0-blue.svg?style=flat-square
[ci-badge]: https://github.com/darthcav/ts-utils/actions/workflows/tests.yml/badge.svg
[coverage-badge]: https://img.shields.io/badge/coverage-check%20CI-yellow.svg?style=flat-square
[pages-url]: https://darthcav.github.io/ts-utils/
