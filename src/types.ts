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
 * Returns the input when it is a plain object that can be treated as a runtime
 * JSON object, as decided by {@link isRuntimeObject} (see there for what counts
 * as a plain object and the caveats about unsanitized keys).
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
 * Filters an unknown value down to an array of runtime JSON objects.
 *
 * Elements are kept when {@link isRuntimeObject} accepts them, i.e. only plain
 * objects; the same caveats about unsanitized keys apply.
 *
 * @param value - Value that may contain runtime objects.
 * @returns Only the elements that can be treated as {@link RuntimeObject} values.
 */
export function toRuntimeObjectArray(value: unknown): RuntimeObject[] {
    return Array.isArray(value) ? value.filter(isRuntimeObject) : []
}
