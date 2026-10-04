/**
 * Type-level predicate: `true` when `T` is `any`, `false` otherwise.
 *
 * Useful to catch a value or return type that silently widened to `any`.
 *
 * @typeParam T - The type to check.
 *
 * @example
 * ```ts
 * import type { Assert, IsAny, Not } from "@darthcav/ts-utils"
 *
 * type _Parsed = Assert<IsAny<ReturnType<typeof JSON.parse>>>
 * type _Typed = Assert<Not<IsAny<unknown>>>
 * ```
 */
export type IsAny<T> = 0 extends 1 & T ? true : false
