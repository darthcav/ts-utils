/**
 * A generic runtime object with property names and values that are not known at
 * compile time.
 *
 * Uses `unknown` instead of `any` so callers must narrow values before using
 * them in a type-safe way.
 */
export type RuntimeObject = Record<string, unknown>

/**
 * Returns the input when it is a non-array object that can be treated as a runtime JSON object.
 *
 * @param value - Value to narrow.
 * @returns The same value as a {@link RuntimeObject}, or `undefined` when the value is not an object.
 */
export function asRuntimeObject(value: unknown): RuntimeObject | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as RuntimeObject)
        : undefined
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
