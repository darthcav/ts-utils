/**
 * Type-level predicate: `true` when `T` is `never`, `false` otherwise.
 *
 * Useful to check that a union has been exhausted or that a conditional type
 * filters out every member.
 *
 * @typeParam T - The type to check.
 *
 * @example
 * ```ts
 * import type { Assert, IsNever } from "@darthcav/ts-utils"
 *
 * type _Empty = Assert<IsNever<Exclude<"a" | "b", string>>>
 * ```
 */
export type IsNever<T> = [T] extends [never] ? true : false
