/**
 * Type-level predicate: `true` when `X` and `Y` are identical types, `false`
 * otherwise.
 *
 * The comparison is the one the compiler uses for type identity, so it is
 * stricter than mutual assignability: `any` only equals `any`, and modifiers
 * such as `readonly` and `?` must match. An intersection is not identical to
 * the equivalent flattened object type (`{ a: 1 } & { b: 2 }` is not
 * `{ a: 1; b: 2 }`); flatten it with a mapped type before comparing when
 * needed.
 *
 * @typeParam X - The first type to compare.
 * @typeParam Y - The second type to compare.
 *
 * @example
 * ```ts
 * import type { Assert, Equal, Not } from "@darthcav/ts-utils"
 *
 * type _Same = Assert<Equal<{ a: string }, { a: string }>>
 * type _Readonly = Assert<Not<Equal<{ readonly a: string }, { a: string }>>>
 * type _Any = Assert<Not<Equal<any, string>>>
 * ```
 */
export type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false
