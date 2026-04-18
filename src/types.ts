/**
 * A generic runtime object with property names and values that are not known at
 * compile time.
 *
 * Uses `unknown` instead of `any` so callers must narrow values before using
 * them in a type-safe way.
 */
export type RuntimeObject = Record<string, unknown>
