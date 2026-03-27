# Copilot instructions for `@darthcav/ts-utils`

## Build, test, and lint commands

- Use Node.js `>=25`.
- Install dependencies with `npm install`.
- Build with `npm run build`.
- Clean generated output with `npm run clean`.
- Type-check with `npm run typecheck`.
- Lint with `npm run lint`.
- Auto-fix lint/format issues with `npm run lint:fix`.
- Generate API docs with `npm run doc`.

### Tests

- Full suite: `npm test`
- Coverage: `npm run test:coverage`
- LCOV coverage output: `npm run test:coverage:lcov`
- The test runner expects `.env.local`; if it is missing, copy `.env.example` first:
  `cp .env.example .env.local`
- Run a single test file with the same flags used by the repo:
  `node --env-file=.env.local --experimental-test-module-mocks --test --test-reporter=spec src/__tests__/main.test.ts`
- Run a single test by name:
  `node --env-file=.env.local --experimental-test-module-mocks --test --test-name-pattern="should log startup information" src/__tests__/main.test.ts`

## High-level architecture

- This repository is a small ESM TypeScript utility library. Source lives in `src/`, TypeScript is compiled to `dist/`, and the package export map only exposes the root entrypoint. `src/index.ts` is the public API surface and re-exports the supported utilities.
- The library is organized as small leaf modules plus one orchestration module:
  - `src/main.ts` is the central process-bootstrap utility. It logs startup state, registers lifecycle/error handlers, optionally starts memory monitoring, and then invokes an optional launcher callback.
  - `src/monitorMemory.ts` is a helper used by `main()` to emit periodic uptime and memory statistics.
  - `src/loggers/getConsoleLogger.ts` wraps `@logtape/logtape` and performs global logger configuration before returning a category logger.
  - `src/loggers/getDummyLogger.ts` provides a no-op logger used mainly in tests and code paths that need a logger-shaped object without side effects.
  - `src/os-utils.ts` contains the platform-specific helpers (`linuxRelease()` and `windowsRelease()`).
  - `src/millisecondsToString.ts` and `src/noop.ts` are standalone utility modules.
- Documentation is generated from `src/index.ts` via TypeDoc into `public/`. TypeDoc uses `README.md` as the docs landing page.
- Packaging is intentionally source-aware: `package.json` publishes `dist/` and `src/`, but excludes `src/__tests__` and `*.test.ts`.

## Key conventions

- The project relies on native TypeScript execution in Node 25 rather than a runtime transpiler. Keep code compatible with type stripping: ESM only, no enums, no runtime namespaces, no parameter properties.
- Use `.ts` extensions in relative imports and `import type` for type-only imports. The TypeScript config enforces this.
- Biome conventions matter here: 4-space indentation, LF line endings, no required semicolons, imports first, and explicit block statements.
- Exported functions and exported types should have complete JSDoc because TypeDoc output is part of the package workflow.
- Most leaf utility modules use a default export internally, while `src/index.ts` re-exports the public API as named exports. Preserve that split when adding new utilities.
- If you change `main()`, update all three surfaces together: overload signatures, runtime argument resolution, and tests. Its optional arguments are intentionally resolved by runtime type (`LauncherFunction | number | boolean`), and the overload coverage in `src/__tests__/main.test.ts` is the safety net.
- `getConsoleLogger()` configures LogTape globally and explicitly silences the `logtape/meta` logger. Be careful not to introduce duplicate or conflicting global logger configuration.
- `getDummyLogger()` is intentionally async and returns `Promise<Logger>` so it can be used interchangeably with async logger setup flows.
- Tests use the built-in `node:test` runner with `suite`/`test`, top-level `await`, and Node’s experimental module mocking. When mocking ESM dependencies, call `mock.module()` before dynamically importing the module under test, as shown in the `os-utils` tests.
- Tests import source files from `src/` directly with `.ts` extensions; they do not test compiled output from `dist/`.
