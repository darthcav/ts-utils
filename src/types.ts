/**
 * A generic runtime object with property names and values that are not known at
 * compile time.
 *
 * Uses `unknown` instead of `any` so callers must narrow values before using
 * them in a type-safe way.
 */
export type RuntimeObject = Record<string, unknown>

/**
 * Returns the input when it is a plain object that can be treated as a runtime
 * JSON object.
 *
 * Plain objects are object literals, `JSON.parse` results, and
 * `Object.create(null)` objects, including those from another realm (e.g. a
 * `node:vm` context). Arrays, class instances, and built-ins such as `Date`,
 * `Map`, `Set`, `RegExp`, or module namespace objects are rejected.
 *
 * The check is shallow and keys are not sanitized: an own `__proto__` or
 * `constructor` key (as `JSON.parse` can produce from untrusted input) is kept.
 * Do not merge the result into other objects key by key without guarding
 * against those keys, or prototype pollution becomes possible.
 *
 * @param value - Value to narrow.
 * @returns The same value as a {@link RuntimeObject}, or `undefined` when the
 *   value is not a plain object.
 */
export function asRuntimeObject(value: unknown): RuntimeObject | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined
    }
    const prototype: unknown = Object.getPrototypeOf(value)
    // A null prototype, or a realm's root `Object.prototype` (whose own
    // prototype is null), marks a plain object.
    if (
        prototype !== null &&
        prototype !== Object.prototype &&
        Object.getPrototypeOf(prototype) !== null
    ) {
        return undefined
    }
    // Exclude null-prototype exotics such as module namespace objects.
    if (Symbol.toStringTag in value || Symbol.iterator in value) {
        return undefined
    }
    return value as RuntimeObject
}

/**
 * Returns the input when it is a string.
 *
 * @param value - Value to narrow.
 * @returns The same value as a string, or `undefined` when the value is not a string.
 */
export function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined
}

/**
 * Filters an unknown value down to an array of runtime JSON objects.
 *
 * Elements are kept when {@link asRuntimeObject} accepts them, i.e. only plain
 * objects; the same caveats about unsanitized keys apply.
 *
 * @param value - Value that may contain runtime objects.
 * @returns Only the elements that can be treated as {@link RuntimeObject} values.
 */
export function toRuntimeObjectArray(value: unknown): RuntimeObject[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.reduce<RuntimeObject[]>((objects, item) => {
        const object = asRuntimeObject(item)
        if (object) {
            objects.push(object)
        }
        return objects
    }, [])
}
