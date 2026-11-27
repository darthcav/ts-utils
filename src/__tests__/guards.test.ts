import assert from "node:assert/strict"
import { suite, test } from "node:test"
import { runInNewContext } from "node:vm"
import {
    asArrayOf,
    asBoolean,
    asFiniteNumber,
    asRuntimeObject,
    asString,
    filterByGuard,
    isArrayOf,
    isBoolean,
    isFiniteNumber,
    isRuntimeObject,
    isString,
    type RuntimeObject,
    type TypeGuard,
    toRuntimeObjectArray,
} from "../core/guards.ts"
import type { Assert } from "../type-testing/Assert.ts"
import type { Equal } from "../type-testing/Equal.ts"

type _RuntimeObjectShape = Assert<Equal<RuntimeObject, Record<string, unknown>>>
type _TypeGuardShape = Assert<
    Equal<TypeGuard<string>, (value: unknown) => value is string>
>
type _AsBooleanReturn = Assert<
    Equal<ReturnType<typeof asBoolean>, boolean | undefined>
>
type _AsFiniteNumberReturn = Assert<
    Equal<ReturnType<typeof asFiniteNumber>, number | undefined>
>
// The element type is inferred from the guard.
const _inferredAsArrayOf = asArrayOf([] as unknown, isString)
type _AsArrayOfInference = Assert<
    Equal<typeof _inferredAsArrayOf, string[] | undefined>
>
const _inferredFilter = filterByGuard([] as unknown, isRuntimeObject)
type _FilterByGuardInference = Assert<
    Equal<typeof _inferredFilter, RuntimeObject[]>
>
// @ts-expect-error -- a plain boolean predicate is not a type guard
filterByGuard([], (value: unknown): boolean => value !== null)
type _ToRuntimeObjectArrayReturn = Assert<
    Equal<ReturnType<typeof toRuntimeObjectArray>, RuntimeObject[]>
>

class Point {
    x = 1
}

/** Values that count as plain objects. */
const PLAIN_OBJECTS: readonly unknown[] = [
    { a: 1 },
    Object.assign(Object.create(null), { a: 1 }),
    JSON.parse('{"a":{"b":[1,2]}}'),
    runInNewContext("({ a: 1 })"),
]

/** Values that do not: arrays, class instances, built-ins, and primitives. */
const NOT_PLAIN_OBJECTS: readonly unknown[] = [
    [1, 2, 3],
    new Point(),
    new Date(),
    new Map(),
    new Set(),
    /re/,
    new Error("x"),
    Promise.resolve(),
    new Uint8Array(1),
    new String("boxed"),
    await import("../core/noop.ts"),
    () => {},
    null,
    undefined,
    "hello",
    42,
]

await suite("asRuntimeObject", () => {
    test("returns plain objects themselves", () => {
        for (const value of PLAIN_OBJECTS) {
            assert.equal(asRuntimeObject(value), value)
        }
    })

    test("returns undefined for everything else", () => {
        for (const value of NOT_PLAIN_OBJECTS) {
            assert.equal(asRuntimeObject(value), undefined)
        }
    })

    test("keeps own __proto__ keys from JSON.parse without changing prototypes", () => {
        const obj = JSON.parse('{"__proto__":{"polluted":true}}')
        const result = asRuntimeObject(obj)
        assert.equal(result, obj)
        assert.ok(result !== undefined && Object.hasOwn(result, "__proto__"))
        assert.equal(Object.getPrototypeOf(obj), Object.prototype)
        assert.equal(
            (Object.prototype as Record<string, unknown>)["polluted"],
            undefined,
        )
    })
})

await suite("isRuntimeObject", () => {
    test("returns true for plain objects", () => {
        for (const value of PLAIN_OBJECTS) {
            assert.equal(isRuntimeObject(value), true)
        }
    })

    test("returns false for everything else", () => {
        for (const value of NOT_PLAIN_OBJECTS) {
            assert.equal(isRuntimeObject(value), false)
        }
    })

    test("narrows unknown to RuntimeObject", () => {
        const value: unknown = { a: 1 }
        if (isRuntimeObject(value)) {
            type _Narrowed = Assert<Equal<typeof value, RuntimeObject>>
            assert.equal(value["a"], 1)
        } else {
            assert.fail("expected a plain object")
        }
    })

    test("narrows unions and leaves the other members in the else branch", () => {
        const value = [1] as RuntimeObject | number[]
        if (isRuntimeObject(value)) {
            assert.fail("arrays are not runtime objects")
        } else {
            type _Rest = Assert<Equal<typeof value, number[]>>
            assert.deepEqual(value, [1])
        }
    })
})

await suite("toRuntimeObjectArray", () => {
    test("keeps only the plain objects, in order", () => {
        const mixed = [
            ...NOT_PLAIN_OBJECTS,
            ...PLAIN_OBJECTS.flatMap((plain) => [plain, 42]),
        ]
        assert.deepEqual(toRuntimeObjectArray(mixed), PLAIN_OBJECTS)
    })

    test("returns an empty array for a non-array value or an empty array", () => {
        for (const value of [undefined, null, "not an array", []]) {
            assert.deepEqual(toRuntimeObjectArray(value), [])
        }
    })
})

/** Values of every kind, for checking what a guard rejects. */
const SAMPLES: readonly unknown[] = [
    undefined,
    null,
    true,
    false,
    0,
    -1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1n,
    "",
    "42",
    "true",
    Symbol("s"),
    {},
    [],
    () => {},
    new Date(),
    Object(true),
    Object(1),
    Object("boxed"),
]

await suite("isString / asString", () => {
    test("accept only string primitives", () => {
        assert.deepEqual(SAMPLES.filter(isString), ["", "42", "true"])
        for (const value of SAMPLES) {
            assert.equal(asString(value), isString(value) ? value : undefined)
        }
    })

    test("narrow an unknown value to string", () => {
        const value: unknown = "hello"
        if (isString(value)) {
            type _Narrowed = Assert<Equal<typeof value, string>>
            assert.equal(value.toUpperCase(), "HELLO")
        } else {
            assert.fail("expected a string")
        }
    })
})

await suite("isBoolean / asBoolean", () => {
    test("accept only boolean primitives", () => {
        const accepted = SAMPLES.filter(isBoolean)
        assert.deepEqual(accepted, [true, false])
        for (const value of SAMPLES) {
            assert.equal(asBoolean(value), isBoolean(value) ? value : undefined)
        }
    })

    test("narrow an unknown value to boolean", () => {
        const value: unknown = false
        if (isBoolean(value)) {
            const narrowed: boolean = value
            assert.equal(narrowed, false)
        } else {
            assert.fail("false should be a boolean")
        }
    })
})

await suite("isFiniteNumber / asFiniteNumber", () => {
    test("accept only finite number primitives", () => {
        assert.deepEqual(SAMPLES.filter(isFiniteNumber), [0, -1.5])
        for (const value of SAMPLES) {
            assert.equal(
                asFiniteNumber(value),
                isFiniteNumber(value) ? value : undefined,
            )
        }
    })

    test("accept -0 and the extremes of the number range", () => {
        for (const value of [
            -0,
            Number.MAX_VALUE,
            -Number.MAX_VALUE,
            Number.MIN_VALUE,
            Number.MAX_SAFE_INTEGER,
        ]) {
            assert.equal(asFiniteNumber(value), value)
        }
    })
})

await suite("isArrayOf / asArrayOf", () => {
    test("accept an array whose elements all pass the guard", () => {
        const tags = ["a", "b"]
        assert.equal(isArrayOf(tags, isString), true)
        assert.equal(asArrayOf(tags, isString), tags)
    })

    test("accept an empty array", () => {
        const empty: unknown[] = []
        assert.equal(isArrayOf(empty, isString), true)
        assert.equal(asArrayOf(empty, isString), empty)
    })

    test("reject the whole array when any element fails, never dropping it", () => {
        const mixed = ["a", 1, "b"]
        assert.equal(isArrayOf(mixed, isString), false)
        assert.equal(asArrayOf(mixed, isString), undefined)
        assert.deepEqual(mixed, ["a", 1, "b"])
    })

    test("reject values that are not arrays", () => {
        for (const value of [
            undefined,
            null,
            "ab",
            { 0: "a", length: 1 },
            new Set(["a"]),
        ]) {
            assert.equal(isArrayOf(value, isString), false)
            assert.equal(asArrayOf(value, isString), undefined)
        }
    })

    test("check the holes of sparse arrays as undefined", () => {
        // ["a", <hole>, "b"]
        const sparse: unknown[] = ["a"]
        sparse[2] = "b"
        assert.equal(isArrayOf(sparse, isString), false)
        assert.equal(
            isArrayOf(
                sparse,
                (v: unknown): v is string | undefined =>
                    v === undefined || isString(v),
            ),
            true,
        )
    })

    test("call the guard with the element only", () => {
        const calls: unknown[][] = []
        function guard(value: unknown, ...rest: unknown[]): value is string {
            calls.push([value, ...rest])
            return true
        }
        isArrayOf(["x", "y"], guard)
        assert.deepEqual(calls, [["x"], ["y"]])
    })

    test("compose with other guards (array of runtime objects)", () => {
        const rows: unknown = JSON.parse('[{"id":1},{"id":2}]')
        assert.equal(isArrayOf(rows, isRuntimeObject), true)
        assert.equal(isArrayOf([{ id: 1 }, new Date()], isRuntimeObject), false)
    })

    test("narrow an unknown value to T[]", () => {
        const value: unknown = [1, 2]
        if (isArrayOf(value, isFiniteNumber)) {
            const total: number = value.reduce((a, b) => a + b, 0)
            assert.equal(total, 3)
        } else {
            assert.fail("[1, 2] should be an array of numbers")
        }
    })
})

await suite("filterByGuard", () => {
    test("keep only the elements that pass the guard, in order", () => {
        assert.deepEqual(filterByGuard(["a", 1, "b", null], isString), [
            "a",
            "b",
        ])
    })

    test("return a new array even when every element passes", () => {
        const tags = ["a", "b"]
        const filtered = filterByGuard(tags, isString)
        assert.deepEqual(filtered, tags)
        assert.notEqual(filtered, tags)
    })

    test("return an empty array for an empty array or a non-array value", () => {
        for (const value of [
            [],
            undefined,
            null,
            "ab",
            { 0: "a", length: 1 },
        ]) {
            assert.deepEqual(filterByGuard(value, isString), [])
        }
    })

    test("skip the holes of sparse arrays", () => {
        assert.deepEqual(
            filterByGuard(
                // [1, <hole>, 2]
                Object.assign([1], { 2: 2 }),
                (v: unknown): v is number | undefined =>
                    v === undefined || isFiniteNumber(v),
            ),
            [1, 2],
        )
    })

    test("call the guard with the element only", () => {
        const calls: unknown[][] = []
        function guard(value: unknown, ...rest: unknown[]): value is string {
            calls.push([value, ...rest])
            return false
        }
        filterByGuard(["x"], guard)
        assert.deepEqual(calls, [["x"]])
    })

    test("matches toRuntimeObjectArray when used with isRuntimeObject", () => {
        const input = [{ a: 1 }, "x", new Date(), Object.create(null), [1]]
        assert.deepEqual(
            filterByGuard(input, isRuntimeObject),
            toRuntimeObjectArray(input),
        )
    })
})
