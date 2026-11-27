# Agent Instructions for `@darthcav/ts-utils`

## Commands

- Use Node.js `>=26` and install dependencies with `npm install`.
- Build with `npm run build` (uses `tsconfig.build.json`, which leaves the tests out of `dist/`);
  clean generated output with `npm run clean`.
- Type-check with `npm run typecheck`.
- Lint with `npm run lint` (Biome, plus Prettier for the `*.md` files); auto-fix with
  `npm run lint:fix`.
- Generate the API docs with `npm run doc`.
- Run the tests with `npm test`, coverage with `npm run test:coverage` (LCOV output:
  `npm run test:coverage:lcov`). The test runner loads `.env.local` when it exists
  (`--env-file-if-exists`); it is optional, and `.env.example` shows the supported variables.
- Run a single test file with the same flags used by the repo:
  `node --env-file-if-exists=.env.local --experimental-test-module-mocks --test --test-reporter=spec src/__tests__/main.test.ts`
- Run a single test by name:
  `node --env-file-if-exists=.env.local --experimental-test-module-mocks --test --test-name-pattern="should log startup information" src/__tests__/main.test.ts`

## Architecture

- A small ESM TypeScript utility library. Source lives in `src/` and is compiled to `dist/`. Modules
  are grouped by domain, and each domain has an `index.ts` entry point exposed as a subpath export;
  `src/index.ts` is the root entry point and re-exports all of them:
    - `src/core/` (`@darthcav/ts-utils/core`): portable helpers that must not import Node.js
      built-ins or packages at runtime (`src/__tests__/index.test.ts` checks this).
        - `guards.ts`: `RuntimeObject`, `TypeGuard`, the type guards `isRuntimeObject`, `isString`,
          `isBoolean`, `isFiniteNumber`, `isArrayOf`, and the narrowing helpers `asRuntimeObject`,
          `asString`, `asBoolean`, `asFiniteNumber`, `asArrayOf`, `filterByGuard`,
          `toRuntimeObjectArray`.
        - `millisecondsToString.ts` (needs `Intl.DurationFormat` and `Temporal`) and `noop.ts`.
    - `src/node/` (`@darthcav/ts-utils/node`): Node.js process utilities.
        - `main.ts` bootstraps the process: it logs the startup state, registers the lifecycle and
          fatal error handlers, optionally starts memory monitoring, runs the optional launcher, and
          returns a teardown function. On a signal or fatal failure it stops the monitoring, runs
          the optional `shutdown` function, flushes the logs with `flushLogs`, then exits; the last
          two steps are bounded by `shutdownTimeoutMs` and `flushTimeoutMs`.
        - `monitorMemory.ts` emits periodic uptime and memory statistics using
          `process.memoryUsage()` and `millisecondsToString()`.
        - `osRelease.ts` reads `/etc/os-release` (falling back to `/usr/lib/os-release`) on Linux
          and `/System/Library/CoreServices/SystemVersion.plist` on macOS, through a per-platform
          table, and maps Windows kernel versions to human-readable names. The file parsers live in
          `releaseParsers.ts`.
        - `delays.ts` holds the timer delay limit (2³¹ − 1 ms) and its range check, shared by
          `main.ts` and `monitorMemory.ts`.
        - `delays.ts`, `releaseParsers.ts`, and the internal exports of `monitorMemory.ts`
          (`isValidHours`, `HOURS_RANGE`) are not re-exported by the entry point.
    - `src/loggers/` (`@darthcav/ts-utils/loggers`): `getConsoleLogger.ts` wraps `@logtape/logtape`,
      configures logging globally, and returns a category logger (ANSI colors only on color
      terminals; `FORCE_COLOR` overrides). `getDummyLogger.ts` provides a synchronous no-op logger
      factory for tests.
    - `src/type-testing/` (`@darthcav/ts-utils/type-testing`): the type-level testing helpers, one
      type per module (e.g. `src/type-testing/Equal.ts`). Types only, no runtime exports.
- TypeDoc generates the documentation from the five entry points into `public/`, with `README.md` as
  the landing page.
- Packaging is intentionally source-aware: `package.json` publishes `dist/` and `src/`, but excludes
  `src/__tests__`. Every new entry point needs an `exports` entry, a `typedoc.json` entry point, and
  a pin in `src/__tests__/index.test.ts`.

## Git Workflow

### Branches

- **`main`** - production branch, kept in sync with published npm releases. Do not commit directly;
  it only moves via a release merge from `dev` (see Releases below).
- **`dev`** - default working branch. Day-to-day commits, PRs, and Dependabot updates
  (`.github/dependabot.yml` targets `dev`, `interval: monthly`) land here first.
- **Always create a branch** before changing existing functionality: `feature/<feature-name>` for
  new features, `fix/<issue-description>` for bug fixes. These branches PR into `dev`, never
  directly into `main`.

### Releases

- Cut manually: bump the version in `package.json`/`package-lock.json`, update `CHANGELOG.md` and
  the README version badge on `dev`, then merge `dev` into `main` with a `Release vX.Y.Z` commit
  message, tag `vX.Y.Z`, and push both.
- Pushing the tag triggers `.github/workflows/publish.yml`, which runs
  `npm publish --provenance --access public` — this is a real, public, irreversible action, so don't
  tag/push a release without the user's explicit go-ahead.
- After the release, `sync-dev.yml` merges `main` back into `dev` (see GitHub Workflows below).

### Commits

- **Commit incrementally** - small, focused commits that do one thing.
- **Use conventional commits**: `feat:` (new features), `fix:` (bug fixes), `docs:` (documentation),
  `refactor:` (code refactoring), `test:` (adding or updating tests), `chore:` (maintenance).
- **Write descriptive commit messages** with a summary line and bullet points for details.

## GitHub Workflows

- `publish.yml` first runs a `verify` job without the npm OIDC token: it fails unless the tag equals
  `v` + the `package.json` version and points to a commit on `main`, then runs lint, typecheck, and
  tests. The `publish` job then installs with `--ignore-scripts`, without the npm cache, in the
  `npm` environment (add required reviewers to that environment so each publish needs approval).
- `sync-dev.yml` runs on every push to `main`: it merges `main` into `dev` server-side through the
  GitHub merges API so `dev` doesn't drift behind the release commit. It deliberately opens no PR,
  so `tests.yml` doesn't run for the sync (a PR that was merged right away made its `pull_request`
  CI run race the merge and fail); `main` was already tested on `dev`. On conflicts the workflow
  fails, and `main` has to be merged into `dev` locally.
- In workflows, reference actions by version tag (e.g. `actions/checkout@v7`), install with
  `npm ci --ignore-scripts`, and set `persist-credentials: false` on checkouts.

## Checks

### Before every commit

Run `npm run build`, then verify the `exports` paths. The check fails when an export target is
missing from `dist/` or an entry point cannot be imported by package name:

```sh
node --input-type=module -e "import p from './package.json' with { type: 'json' }; import { existsSync } from 'node:fs'; for (const [k, t] of Object.entries(p.exports)) { for (const f of Object.values(t)) if (existsSync(f) === false) throw new Error(k + ': ' + f + ' is missing'); await import(p.name + k.slice(1)) } console.log('exports OK')"
```

### Before merging or pushing

- **Run the checks**: `npm test`, `npm run typecheck`, and `npm run lint`.
- **Update tests** — if the change adds, removes, or modifies user-visible features, add or update
  tests in `src/__tests__/` to cover the new behavior and ensure existing tests still pass.
- **Check coverage** (`npm run test:coverage`) — the coverage scripts require 100% line, branch, and
  function coverage of `src/` (excluding `src/__tests__`) and fail below it, so every new path needs
  a test.
- **Update documentation** — if the change adds, removes, or modifies user-visible features, update
  `README.md` (feature descriptions, usage examples, project structure), the JSDoc, and add an entry
  under `[Unreleased]` in `CHANGELOG.md`.

## Cross-Platform

CI runs the tests on Linux, Windows, and macOS. In `package.json` scripts, quote globs with escaped
double quotes (`\"src/**/*.test.ts\"`, not single quotes, which `cmd.exe` passes through literally).
Instead of POSIX-only commands (`rm -rf`, `mkdir -p`), use Node built-ins via `node -e` with
single-quoted JS strings (e.g. `node -e \"fs.rmSync('dist', { recursive: true, force: true })\"`)
rather than adding a package.

## Code Style

- Node.js runs the TypeScript sources directly (type stripping), without a transpiler. Keep code
  erasable (`erasableSyntaxOnly` enforces it): ESM only, no enums, no runtime namespaces, no
  parameter properties.
- Use `.ts` extensions in relative imports (`allowImportingTsExtensions`) and `import type` for
  type-only imports (`verbatimModuleSyntax` enforces it).
- Use `type` instead of `interface` whenever possible and not conflicting with TypeScript best
  practices.
- Give every exported function and type complete JSDoc; TypeDoc output is part of the package
  workflow.
- Biome conventions: 4-space indentation, LF line endings, no required semicolons, imports first,
  and explicit block statements.
- All modules use named exports only; Biome's `noDefaultExport` rule enforces this. Name
  single-function modules after their function in camelCase (e.g. `src/node/osRelease.ts`) and
  single-type modules after their type in PascalCase (e.g. `src/type-testing/Equal.ts`), and
  re-export new public utilities from their domain's `index.ts` (`src/__tests__/index.test.ts` pins
  the runtime API of every entry point).

## Module Conventions

- `main()` takes its optional settings as a single `MainOptions` object; add new settings there
  rather than as extra parameters. The positional forms were removed in 0.11.0, and a non-object
  `options` argument throws a `TypeError` so untyped callers fail loudly.
- Only one `main()` call can be active at a time; it throws until the returned teardown runs. Tests
  that call `main()` must run its teardown (e.g. in `afterEach`) before the next call.
- `main()` installs `SIGINT` and `SIGTERM` handlers only when `defaultInterruptionHandler` is
  `true`, but it always installs `uncaughtException` and `unhandledRejection` handlers. Preserve
  that behavior unless a deliberate API change is intended.
- The `main()` shutdown sequence runs once: a second signal or fatal failure during it exits
  immediately. A failing or timed-out `shutdown` function makes the process exit with status `1`,
  even after a signal. `src/__tests__/main-process.test.ts` checks the real exit behavior by running
  `src/__tests__/fixtures/mainApp.ts` as a child process (signal cases are skipped on Windows).
- `monitorMemory()` logs memory figures in raw bytes, also as structured properties, unreferences
  its timer, and returns a stop function. Keep the message text and property names stable unless
  tests and documentation are updated together.
- `getConsoleLogger()` configures LogTape globally (with `reset: true`) and explicitly silences the
  `logtape/meta` logger. Be careful not to introduce duplicate or conflicting global logger
  configuration. Applications that configure LogTape themselves use LogTape's `getLogger` instead
  and can pass their own `flushLogs` to `main()`.
- `getDummyLogger()` is synchronous and returns a `Logger`; its single no-op logging method
  satisfies every logtape overload without casts.
- `osRelease()` should return `null` (never throw) on unsupported platforms or when the release file
  cannot be read (os-release on Linux, `SystemVersion.plist` on macOS). On macOS `version` is the
  product version, never the Darwin kernel version. It distinguishes Windows 11 from Windows 10 by
  NT build number (>= 22000 → Windows 11).

## Testing

- Use the built-in `node:test` runner and `node:assert/strict`, with `suite` and `test` instead of
  `describe` and `it`, and top-level `await`.
- Test files go in `src/__tests__/` with the `*.test.ts` suffix and are named after the module they
  cover (e.g. `main.test.ts`, `main-shutdown.test.ts`, `main-process.test.ts`,
  `osRelease-macos.test.ts`, `guards.test.ts`, `index.test.ts`). Keep coverage aligned with the
  module you change.
- Shared test helpers (log rendering, `settle`, `handlerFor`, the mocked `readFileSync`) live in
  `src/__tests__/helpers.ts`; reuse them instead of redefining them per file.
- Test parsers and other pure helpers directly with plain inputs (e.g. `releaseParsers.test.ts`);
  keep module-mocked platform tests for the dispatch and file lookup.
- Tests import source files from `src/` directly; they do not test compiled output from `dist/` (the
  `exports` check above covers the built entry points).
- Mocking ESM dependencies uses Node's experimental module mocking: call `mock.module()` before
  dynamically importing the module under test, as the `osRelease` tests do.
- Type-level assertions use the library's own helpers (`Assert`, `Equal`, … imported from their
  source modules in `src/type-testing/`), declared as unused type aliases, with `@ts-expect-error`
  for cases that must fail. They are checked by `npm run typecheck`, not by `npm test`, since
  Node.js strips types without checking them.
