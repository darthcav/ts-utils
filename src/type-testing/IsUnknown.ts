import type { IsAny } from "./IsAny.ts"

/**
 * Type-level predicate: `true` when `T` is `unknown`, `false` otherwise
 * (including for `any`).
 *
 * Useful to check that an untrusted value (e.g. parsed input) is typed as
 * `unknown` and has to be narrowed before use.
 *
 * @typeParam T - The type to check.
 *
 * @example
 * ```ts
 * import type { Assert, IsUnknown, Not } from "@darthcav/ts-utils"
 *
 * type _Unknown = Assert<IsUnknown<unknown>>
 * type _Any = Assert<Not<IsUnknown<any>>>
 * ```
 */
export type IsUnknown<T> =
    IsAny<T> extends true ? false : unknown extends T ? true : false
