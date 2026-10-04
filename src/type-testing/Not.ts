/**
 * Type-level predicate: negates a boolean predicate result.
 *
 * `Not<true>` is `false` and `Not<false>` is `true`. An undecided `boolean`
 * stays `boolean`, so `Assert<Not<boolean>>` still fails.
 *
 * @typeParam T - The predicate result to negate.
 *
 * @example
 * ```ts
 * import type { Assert, Equal, Not } from "@darthcav/ts-utils"
 *
 * type _Different = Assert<Not<Equal<string, number>>>
 * ```
 */
export type Not<T extends boolean> = T extends true ? false : true
