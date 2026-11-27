/**
 * A generic runtime object with property names and values that are not known at
 * compile time.
 *
 * Uses `unknown` instead of `any` so callers must narrow values before using
 * them in a type-safe way.
 */
export type RuntimeObject = Record<string, unknown>

/**
 * Type guard that checks whether a value is a plain object that can be treated
 * as a runtime JSON object.
 *
 * Plain objects are object literals, `JSON.parse` results, and
 * `Object.create(null)` objects, including those from another realm (e.g. a
 * `node:vm` context). Arrays, class instances, and built-ins such as `Date`,
 * `Map`, `Set`, `RegExp`, or module namespace objects are rejected.
 *
 * The check is shallow and keys are not sanitized: an own `__proto__` or
 * `constructor` key (as `JSON.parse` can produce from untrusted input) is kept.
 * Do not merge the value into other objects key by key without guarding
 * against those keys, or prototype pollution becomes possible.
 *
 * @param value - Value to check.
 * @returns `true` when the value is a plain object, narrowing it to
 *   {@link RuntimeObject}.
 *
 * @example
 * ```ts
 * const body: unknown = JSON.parse(input)
 * if (isRuntimeObject(body)) {
 *     console.log(Object.keys(body)) // body: RuntimeObject
 * }
 * ```
 */
export function isRuntimeObject(value: unknown): value is RuntimeObject {
    if (typeof value !== "object" || value === null) {
        return false
    }
    const prototype: unknown = Object.getPrototypeOf(value)
    // A null prototype, or a realm's root `Object.prototype` (whose own
    // prototype is null), marks a plain object.
    if (
        prototype !== null &&
        prototype !== Object.prototype &&
        Object.getPrototypeOf(prototype) !== null
    ) {
        return false
    }
    // Exclude null-prototype exotics such as module namespace objects.
    return !(Symbol.toStringTag in value || Symbol.iterator in value)
}

/**
 * Returns the input when it is a plain object, as decided by
 * {@link isRuntimeObject} (see there for the caveats about unsanitized keys).
 *
 * @param value - Value to narrow.
 * @returns The same value as a {@link RuntimeObject}, or `undefined` when the
 *   value is not a plain object.
 */
export function asRuntimeObject(value: unknown): RuntimeObject | undefined {
    return isRuntimeObject(value) ? value : undefined
}

/**
 * Type guard that checks whether a value is a string.
 *
 * @param value - Value to check.
 * @returns `true` when the value is a string, narrowing it to `string`.
 */
export function isString(value: unknown): value is string {
    return typeof value === "string"
}

/**
 * Returns the input when it is a string.
 *
 * @param value - Value to narrow.
 * @returns The same value as a string, or `undefined` when the value is not a string.
 */
export function asString(value: unknown): string | undefined {
    return isString(value) ? value : undefined
}

/**
 * Type guard that checks whether a value is a boolean primitive (`true` or
 * `false`). Boxed `Boolean` objects are rejected.
 *
 * @param value - Value to check.
 * @returns `true` when the value is a boolean, narrowing it to `boolean`.
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean"
}

/**
 * Returns the input when it is a boolean primitive, as decided by
 * {@link isBoolean}.
 *
 * @param value - Value to narrow.
 * @returns The same value as a boolean, or `undefined` when the value is not
 *   a boolean.
 *
 * @example
 * ```ts
 * const enabled = asBoolean(config["enabled"]) ?? false
 * ```
 */
export function asBoolean(value: unknown): boolean | undefined {
    return isBoolean(value) ? value : undefined
}

/**
 * Type guard that checks whether a value is a finite number primitive. `NaN`,
 * `Infinity`, `-Infinity`, boxed `Number` objects, bigints, and numeric
 * strings are rejected.
 *
 * @param value - Value to check.
 * @returns `true` when the value is a finite number, narrowing it to
 *   `number`.
 */
export function isFiniteNumber(value: unknown): value is number {
    return Number.isFinite(value)
}

/**
 * Returns the input when it is a finite number primitive, as decided by
 * {@link isFiniteNumber}.
 *
 * @param value - Value to narrow.
 * @returns The same value as a number, or `undefined` when the value is not a
 *   finite number.
 *
 * @example
 * ```ts
 * const port = asFiniteNumber(config["port"]) ?? 3000
 * ```
 */
export function asFiniteNumber(value: unknown): number | undefined {
    return isFiniteNumber(value) ? value : undefined
}

/**
 * A predicate that narrows an `unknown` value to `T`, such as
 * {@link isString}. Used by {@link isArrayOf}, {@link asArrayOf}, and
 * {@link filterByGuard}.
 *
 * @typeParam T - The type the guard narrows to.
 */
export type TypeGuard<T> = (value: unknown) => value is T

/**
 * Type guard that checks whether a value is an array whose elements all pass
 * `guard`. A single invalid element makes it fail (use {@link filterByGuard}
 * to keep only the valid ones); an empty array passes. Holes in sparse arrays
 * are checked as `undefined`.
 *
 * @typeParam T - The element type the guard narrows to.
 * @param value - Value to check.
 * @param guard - Type guard every element must pass.
 * @returns `true` when the value is an array of `T`, narrowing it to `T[]`.
 *
 * @example
 * ```ts
 * const body: unknown = JSON.parse(input)
 * if (isArrayOf(body, isString)) {
 *     body.map((tag) => tag.toUpperCase()) // body: string[]
 * }
 * ```
 */
export function isArrayOf<T>(
    value: unknown,
    guard: TypeGuard<T>,
): value is T[] {
    // An array iterator, unlike `Array#every`, visits the holes of sparse
    // arrays, as `undefined`.
    return (
        Array.isArray(value) &&
        value.values().every((element: unknown) => guard(element))
    )
}

/**
 * Returns the input when it is an array whose elements all pass `guard`, as
 * decided by {@link isArrayOf}.
 *
 * @typeParam T - The element type the guard narrows to.
 * @param value - Value to narrow.
 * @param guard - Type guard every element must pass.
 * @returns The same array as `T[]`, or `undefined` when the value is not an
 *   array or any element fails the guard.
 *
 * @example
 * ```ts
 * const tags = asArrayOf(asRuntimeObject(body)?.["tags"], isString) ?? []
 * ```
 */
export function asArrayOf<T>(
    value: unknown,
    guard: TypeGuard<T>,
): T[] | undefined {
    return isArrayOf(value, guard) ? value : undefined
}

/**
 * Keeps the elements of an array that pass `guard` and silently drops the
 * others, unlike {@link isArrayOf}, which rejects the whole array. A value
 * that is not an array yields an empty array, and holes in sparse arrays are
 * skipped.
 *
 * @typeParam T - The element type the guard narrows to.
 * @param value - Value that may be an array.
 * @param guard - Type guard deciding which elements to keep.
 * @returns A new array with the elements that pass the guard.
 *
 * @example
 * ```ts
 * filterByGuard(["a", 1, "b", null], isString) // ["a", "b"]
 * filterByGuard("not an array", isString)      // []
 * ```
 */
export function filterByGuard<T>(value: unknown, guard: TypeGuard<T>): T[] {
    return Array.isArray(value)
        ? value.filter((element: unknown): element is T => guard(element))
        : []
}

/**
 * Keeps the plain objects of an array: {@link filterByGuard} with
 * {@link isRuntimeObject}, whose caveats about unsanitized keys apply. A value
 * that is not an array yields an empty array.
 *
 * @param value - Value that may contain runtime objects.
 * @returns Only the elements that can be treated as {@link RuntimeObject} values.
 */
export function toRuntimeObjectArray(value: unknown): RuntimeObject[] {
    return filterByGuard(value, isRuntimeObject)
}
