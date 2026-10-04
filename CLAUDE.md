# Project Conventions

## Git Workflow

### Branching Strategy

- **`main`** - production branch, kept in sync with published npm releases. Do not commit directly;
  it only moves via a release merge from `dev` (see Releases below).
- **`dev`** - default working branch. Day-to-day commits, PRs, and Dependabot updates
  (`.github/dependabot.yml` targets `dev`, `interval: monthly`) land here first.
- **Feature branches**: `feature/<feature-name>` - for new features
- **Bugfix branches**: `fix/<issue-description>` - for bug fixes
- **Always create a feature branch** before making changes to existing functionality
- Feature/bugfix branches PR into `dev`, not `main`, directly

### Releases

- Cut manually: bump the version in `package.json`/`package-lock.json`, update `CHANGELOG.md` and
  the README version badge on `dev`, then merge `dev` into `main` with a `Release vX.Y.Z` commit
  message, tag `vX.Y.Z`, and push both.
- Pushing the tag triggers `.github/workflows/publish.yml`, which runs
  `npm publish --provenance --access public` — this is a real, public, irreversible action, so don't
  tag/push a release without the user's explicit go-ahead.
- `publish.yml` first runs a `verify` job without the npm OIDC token: it fails unless the tag equals
  `v` + the `package.json` version and points to a commit on `main`, then runs lint, typecheck, and
  tests. The `publish` job then installs with `--ignore-scripts`, without the npm cache, in the
  `npm` environment (add required reviewers to that environment so each publish needs approval).
- In workflows, reference actions by version tag (e.g. `actions/checkout@v7`), install with
  `npm ci --ignore-scripts`, and set `persist-credentials: false` on checkouts.
- `.github/workflows/sync-dev.yml` runs on every push to `main`: it merges `main` into `dev`
  server-side through the GitHub merges API so `dev` doesn't drift behind the release commit. It
  deliberately opens no PR, so `tests.yml` doesn't run for the sync (a PR that was merged right away
  made its `pull_request` CI run race the merge and fail); `main` was already tested on `dev`. On
  conflicts the workflow fails, and `main` has to be merged into `dev` locally.

### Commit Practices

- **Commit incrementally** - small, focused commits that do one thing
- **Use conventional commits** format:
    - `feat:` - new features
    - `fix:` - bug fixes
    - `docs:` - documentation changes
    - `refactor:` - code refactoring
    - `test:` - adding or updating tests
    - `chore:` - maintenance tasks
- **Write descriptive commit messages** with a summary line and bullet points for details
- **Verify build passes** before committing (`npm run build`)

### Before Merging or Pushing

- Test changes locally (`npm run test` and `npm run lint`)
- Ensure no TypeScript errors
- Review the diff for unintended changes
- **Update tests** — if the change adds, removes, or modifies user-visible features, add or update
  tests in `src/__tests__/` to cover the new behavior and ensure existing tests still pass.
- **Check coverage** — ensure test coverage does not decrease and critical paths are covered.
- **Run lint** — ensure code style is consistent and no lint errors are introduced.
- **Update documentation** — if the change adds, removes, or modifies user-visible features, update
  `README.md` (feature descriptions, usage examples, project structure) and add an entry under
  `[Unreleased]` in `CHANGELOG.md` before merging.
- **Keep it cross-platform** — CI runs the tests on Linux, Windows, and macOS. In `package.json`
  scripts, quote globs with escaped double quotes (`\"src/**/*.test.ts\"`, not single quotes, which
  `cmd.exe` passes through literally). Instead of POSIX-only commands (`rm -rf`, `mkdir -p`), use
  Node built-ins via `node -e` with single-quoted JS strings (e.g.
  `node -e \"fs.rmSync('dist', { recursive: true, force: true })\"`) rather than adding a package.

## Stack

- Node.js >= 26 with native TypeScript execution (type stripping)
- TypeScript with strict mode and isolated declarations
- Only erasable TS syntax (no enums, no runtime namespaces, no parameter properties)
- ESM only (`"type": "module"`)
- Make sure that whenever possible and not conflicting with TypeScript best practices, use `type`
  instead of `interface` for typing.
- Biome for linting and formatting, Prettier for Markdown
- Node.js built-in test runner (`node:test`)
- TypeDoc for API documentation

## Commands

- `npm run build` — compile TypeScript to JavaScript
- `npm run clean` — remove compiled output
- `npm run typecheck` — type-check without emitting
- `npm test` — run tests (Node.js built-in test runner)
- `npm run test:coverage` — run tests with coverage
- `npm run lint` — check with Biome and Prettier (Markdown)
- `npm run lint:fix` — auto-fix with Biome and Prettier (Markdown)
- `npm run doc` — generate TypeDoc documentation

## Code Style

- Biome handles formatting and linting
- 4 spaces indentation, LF line endings
- Use JSDoc comments for all exported functions and types
- Use `import type` for type-only imports (`verbatimModuleSyntax`)
- Use `.ts` extensions in imports (`allowImportingTsExtensions`)
- Exported functions must have explicit return types (`isolatedDeclarations`)
- Check lint, documentation and test coverage, including `*.md` files after every change to ensure
  quality and consistency

## Testing

- Use `node:test` and `node:assert/strict`
- Tests must use `suite` and `test` instead of `describe` and `it` from `node:test`
- Use the library's own type-testing helpers (`Assert`, `Equal`, … from `src/type-testing/`) for
  type-level assertions, imported from their source modules, and `@ts-expect-error` for negative
  cases
- Test files go in `src/__tests__/` with `*.test.ts` suffix
