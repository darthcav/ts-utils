/**
 * A collection of utility functions for TypeScript applications and modules.
 *
 * The root entry point re-exports every public utility. Import from a subpath
 * to load only one domain:
 *
 * - `@darthcav/ts-utils/core`: portable helpers (no Node.js built-ins).
 * - `@darthcav/ts-utils/node`: Node.js process utilities.
 * - `@darthcav/ts-utils/loggers`: LogTape logger helpers.
 * - `@darthcav/ts-utils/type-testing`: type-level testing helpers.
 *
 * @module @darthcav/ts-utils
 */

export * from "./core/index.ts"
export * from "./loggers/index.ts"
export * from "./node/index.ts"
export type * from "./type-testing/index.ts"
