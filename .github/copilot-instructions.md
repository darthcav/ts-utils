# Copilot instructions for `@darthcav/ts-utils`

## Build, test, and lint commands

- Use Node.js `>=26`.
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

- This repository is a small ESM TypeScript utility library. Source lives in `src/`, TypeScript is
  compiled to `dist/`, and the package export map only exposes the root entrypoint. `src/index.ts`
  is the public API surface and re-exports the supported utilities and types.
- The public API currently includes:
    - `main` and `LauncherFunction`
    - `monitorMemory`
    - `getConsoleLogger`
    - `getDummyLogger`
    - `millisecondsToString`
    - `noop`
    - `osRelease` and `OsRelease`
    - `isRuntimeObject`, `isString`, `asRuntimeObject`, `asString`, `toRuntimeObjectArray`, and
      `RuntimeObject`
- The library is organized as small leaf modules plus one orchestration module:
    - `src/main.ts` is the central process-bootstrap utility. It logs startup state, registers
      lifecycle and fatal error handlers, optionally starts memory monitoring, and then invokes an
      optional launcher callback.
    - `src/monitorMemory.ts` emits periodic uptime and memory statistics using
      `process.memoryUsage()` and `millisecondsToString()`.
    - `src/loggers/getConsoleLogger.ts` wraps `@logtape/logtape`, configures logging globally, and
      returns a category logger. It uses ANSI colors only on color terminals (`FORCE_COLOR`
      overrides).
    - `src/loggers/getDummyLogger.ts` provides a synchronous no-op logger factory for tests and any
      code path that needs a logger-shaped object without side effects.
    - `src/osRelease.ts` contains the platform helper `osRelease()`, which parses `/etc/os-release`
      (falling back to `/usr/lib/os-release`) on Linux and maps Windows kernel versions to
      human-readable names. Returns `null` on unsupported platforms or when no os-release file can
      be read on Linux.
    - `src/types.ts` provides runtime type guards (`isRuntimeObject`, `isString`), narrowing helpers
      (`asRuntimeObject`, `asString`, `toRuntimeObjectArray`), and the `RuntimeObject` type alias.
    - `src/millisecondsToString.ts` and `src/noop.ts` are standalone utility modules.
- Documentation is generated from `src/index.ts` via TypeDoc into `public/`. TypeDoc uses
  `README.md` as the docs landing page.
- Packaging is intentionally source-aware: `package.json` publishes `dist/` and `src/`, but excludes
  `src/__tests__` and `*.test.ts`.

## Key conventions

- The project relies on native TypeScript execution in Node 26 rather than a runtime transpiler.
  Keep code compatible with type stripping: ESM only, no enums, no runtime namespaces, no parameter
  properties.
- Use `.ts` extensions in relative imports and `import type` for type-only imports. The TypeScript
  config enforces this.
- Biome conventions matter here: 4-space indentation, LF line endings, no required semicolons,
  imports first, and explicit block statements.
- Exported functions and exported types should have complete JSDoc because TypeDoc output is part of
  the package workflow.
- All modules use named exports only; Biome's `noDefaultExport` rule enforces this. Name
  single-function modules after their function in camelCase (e.g. `src/osRelease.ts`), and re-export
  new public utilities from `src/index.ts` (`src/__tests__/index.test.ts` pins the public API).
- If you change `main()`, update all three surfaces together: overload signatures, runtime argument
  resolution, and tests. Its optional arguments are intentionally resolved by runtime type
  (`LauncherFunction | number | boolean`), and the overload coverage in `src/__tests__/main.test.ts`
  is the safety net.
- `main()` installs `SIGINT` and `SIGTERM` handlers only when `defaultInterruptionHandler` is
  `true`, but it always installs `uncaughtException` and `unhandledRejection` handlers. Preserve
  that behavior unless a deliberate API change is intended.
- `monitorMemory()` logs memory figures in raw bytes and formats uptime via
  `millisecondsToString()`, attaching the figures as structured properties as well. It unreferences
  its timer and returns a stop function. Keep the rendered message text and property names stable
  unless tests and documentation are updated together.
- `getConsoleLogger()` configures LogTape globally and explicitly silences the `logtape/meta`
  logger. Be careful not to introduce duplicate or conflicting global logger configuration.
- `getDummyLogger()` is synchronous and returns a `Logger`; its single no-op logging method
  satisfies every logtape overload without casts.
- `osRelease()` should return `null` (never throw) on unsupported platforms or when no os-release
  file can be read on Linux. It distinguishes Windows 11 from Windows 10 by NT build number (>=
  22000 → Windows 11).
- Tests use the built-in `node:test` runner with `suite`/`test`, top-level `await`, and Node’s
  experimental module mocking. When mocking ESM dependencies, call `mock.module()` before
  dynamically importing the module under test, as shown in the `osRelease` tests.
- Test files are named after the module they cover (e.g. `main.test.ts`, `main-shutdown.test.ts`,
  `osRelease.test.ts`, `osRelease-linux.test.ts`, `osRelease-windows.test.ts`, `types.test.ts`,
  `index.test.ts`). Keep coverage aligned with the module you change.
- Tests import source files from `src/` directly with `.ts` extensions; they do not test compiled
  output from `dist/`.
