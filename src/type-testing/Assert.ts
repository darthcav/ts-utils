/**
 * Compile-time assertion: type-checks only when `T` is exactly `true`.
 *
 * Wrap one of the type-level predicates of this module ({@link Equal},
 * {@link Extends}, {@link Not}, {@link IsAny}, {@link IsNever},
 * {@link IsUnknown}) in it and declare the result as an (unused) type alias.
 * A predicate that evaluates to `false` or `boolean` becomes a type error that
 * `tsc` reports. The alias resolves to `true` and, like every type, is erased
 * at runtime.
 *
 * @typeParam T - The predicate result that must be `true`.
 *
 * @example
 * ```ts
 * import type { Assert, Equal } from "@darthcav/ts-utils"
 *
 * type _Ok = Assert<Equal<ReturnType<typeof parseInt>, number>>
 * // @ts-expect-error -- `string` is not `number`
 * type _Fails = Assert<Equal<string, number>>
 * ```
 */
export type Assert<T extends true> = T
