/**
 * Type-level predicate: `true` when `X` is assignable to `Y`, `false`
 * otherwise.
 *
 * Unions are compared as a whole rather than member by member, so
 * `Extends<string | number, string>` is `false`. Since `any` and `never` are
 * assignable to every type, `Extends<any, Y>` and `Extends<never, Y>` are
 * always `true`; use {@link Equal} to check for an exact type.
 *
 * @typeParam X - The type to check.
 * @typeParam Y - The type `X` must be assignable to.
 *
 * @example
 * ```ts
 * import type { Assert, Extends, Not } from "@darthcav/ts-utils"
 *
 * type _Literal = Assert<Extends<"a", string>>
 * type _Union = Assert<Not<Extends<string | number, string>>>
 * ```
 */
export type Extends<X, Y> = [X] extends [Y] ? true : false
