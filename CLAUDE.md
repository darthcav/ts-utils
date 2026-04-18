# Project Conventions

## Git Workflow

### Branching Strategy

- **Main branch**: `main` - production-ready code only
- **Feature branches**: `feature/<feature-name>` - for new features
- **Bugfix branches**: `fix/<issue-description>` - for bug fixes
- **Always create a feature branch** before making changes to existing functionality

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
  `README.md` (feature descriptions, route table, env vars) and any relevant guides in `docs/`
  before merging. Also update `TODO.md` to mark completed items.

## Stack

- Node.js >= 25 with native TypeScript execution (type stripping)
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
- Use `asserttt` for type-level assertions
- Test files go in `src/__tests__/` with `*.test.ts` suffix
