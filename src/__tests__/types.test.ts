import assert from "node:assert/strict"
import { suite, test } from "node:test"
import { runInNewContext } from "node:vm"
import type { Assert, Equal } from "asserttt"
import {
    type RuntimeObject as PublicRuntimeObject,
    isRuntimeObject as publicIsRuntimeObject,
    isString as publicIsString,
} from "../index.ts"
import {
    asRuntimeObject,
    asString,
    isRuntimeObject,
    isString,
    type RuntimeObject,
    toRuntimeObjectArray,
} from "../types.ts"

type _RuntimeObjectShape = Assert<Equal<RuntimeObject, Record<string, unknown>>>
type _RuntimeObjectExport = Assert<Equal<PublicRuntimeObject, RuntimeObject>>
type _ToRuntimeObjectArrayReturn = Assert<
    Equal<ReturnType<typeof toRuntimeObjectArray>, RuntimeObject[]>
>

await suite("RuntimeObject", () => {
    test("accepts runtime-defined keys and unknown values", () => {
        const value: RuntimeObject = {
            answer: 42,
            nested: { enabled: true },
            nothing: null,
            text: "hello",
        }

        assert.deepEqual(value, {
            answer: 42,
            nested: { enabled: true },
            nothing: null,
            text: "hello",
        })
    })
})

await suite("asRuntimeObject", () => {
    test("returns the value for a plain object", () => {
        const obj = { a: 1 }
        assert.equal(asRuntimeObject(obj), obj)
    })

    test("returns undefined for null", () => {
        assert.equal(asRuntimeObject(null), undefined)
    })

    test("returns undefined for an array", () => {
        assert.equal(asRuntimeObject([1, 2, 3]), undefined)
    })

    test("returns undefined for a string", () => {
        assert.equal(asRuntimeObject("hello"), undefined)
    })

    test("returns undefined for a number", () => {
        assert.equal(asRuntimeObject(42), undefined)
    })

    test("returns undefined for undefined", () => {
        assert.equal(asRuntimeObject(undefined), undefined)
    })

    test("returns the value for a null-prototype object", () => {
        const obj = Object.assign(Object.create(null), { a: 1 })
        assert.equal(asRuntimeObject(obj), obj)
    })

    test("returns the value for a JSON.parse result", () => {
        const obj = JSON.parse('{"a":{"b":[1,2]}}')
        assert.equal(asRuntimeObject(obj), obj)
    })

    test("returns the value for a plain object from another realm", () => {
        const obj = runInNewContext("({ a: 1 })")
        assert.equal(asRuntimeObject(obj), obj)
    })

    test("returns undefined for class instances", () => {
        class Point {
            x = 1
        }
        assert.equal(asRuntimeObject(new Point()), undefined)
    })

    test("returns undefined for built-in objects", () => {
        for (const value of [
            new Date(),
            new Map(),
            new Set(),
            /re/,
            new Error("x"),
            Promise.resolve(),
            new Uint8Array(1),
            new String("boxed"),
        ]) {
            assert.equal(asRuntimeObject(value), undefined)
        }
    })

    test("returns undefined for functions", () => {
        assert.equal(
            asRuntimeObject(() => {}),
            undefined,
        )
    })

    test("returns undefined for module namespace objects", async () => {
        const namespace = await import("../noop.ts")
        assert.equal(asRuntimeObject(namespace), undefined)
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
    class Point {
        x = 1
    }
    const samples: unknown[] = [
        { a: 1 },
        Object.create(null),
        JSON.parse('{"a":1}'),
        runInNewContext("({ a: 1 })"),
        [],
        new Point(),
        new Date(),
        new Map(),
        null,
        undefined,
        "text",
        42,
        () => {},
    ]

    test("is exported from the package entry point", () => {
        assert.equal(publicIsRuntimeObject, isRuntimeObject)
    })

    test("returns true for plain objects", () => {
        for (const value of samples.slice(0, 4)) {
            assert.equal(isRuntimeObject(value), true)
        }
    })

    test("returns false for everything else", () => {
        for (const value of samples.slice(4)) {
            assert.equal(isRuntimeObject(value), false)
        }
    })

    test("agrees with asRuntimeObject", () => {
        for (const value of samples) {
            assert.equal(
                isRuntimeObject(value),
                asRuntimeObject(value) !== undefined,
            )
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

await suite("isString", () => {
    test("is exported from the package entry point", () => {
        assert.equal(publicIsString, isString)
    })

    test("returns true for strings", () => {
        assert.equal(isString("hello"), true)
        assert.equal(isString(""), true)
    })

    test("returns false for non-strings", () => {
        for (const value of [
            42,
            null,
            undefined,
            {},
            [],
            new String("boxed"),
        ]) {
            assert.equal(isString(value), false)
        }
    })

    test("narrows unknown to string", () => {
        const value: unknown = "hello"
        if (isString(value)) {
            type _Narrowed = Assert<Equal<typeof value, string>>
            assert.equal(value.toUpperCase(), "HELLO")
        } else {
            assert.fail("expected a string")
        }
    })
})

await suite("asString", () => {
    test("returns the value for a string", () => {
        assert.equal(asString("hello"), "hello")
    })

    test("returns the value for an empty string", () => {
        assert.equal(asString(""), "")
    })

    test("returns undefined for a number", () => {
        assert.equal(asString(42), undefined)
    })

    test("returns undefined for null", () => {
        assert.equal(asString(null), undefined)
    })

    test("returns undefined for an object", () => {
        assert.equal(asString({}), undefined)
    })

    test("returns undefined for undefined", () => {
        assert.equal(asString(undefined), undefined)
    })
})

await suite("toRuntimeObjectArray", () => {
    test("returns an empty array for a non-array value", () => {
        assert.deepEqual(toRuntimeObjectArray("not an array"), [])
    })

    test("returns an empty array for null", () => {
        assert.deepEqual(toRuntimeObjectArray(null), [])
    })

    test("returns an empty array for undefined", () => {
        assert.deepEqual(toRuntimeObjectArray(undefined), [])
    })

    test("filters out non-object elements", () => {
        assert.deepEqual(
            toRuntimeObjectArray([1, "two", null, true, undefined]),
            [],
        )
    })

    test("filters out nested arrays", () => {
        assert.deepEqual(
            toRuntimeObjectArray([
                [1, 2],
                [3, 4],
            ]),
            [],
        )
    })

    test("returns only the object elements", () => {
        const obj1 = { a: 1 }
        const obj2 = { b: 2 }
        assert.deepEqual(toRuntimeObjectArray([obj1, "skip", obj2, 42]), [
            obj1,
            obj2,
        ])
    })

    test("returns all elements when every element is an object", () => {
        const items = [{ x: 1 }, { y: 2 }, { z: 3 }]
        assert.deepEqual(toRuntimeObjectArray(items), items)
    })

    test("returns an empty array for an empty array", () => {
        assert.deepEqual(toRuntimeObjectArray([]), [])
    })

    test("filters out class instances and built-in objects", () => {
        class Point {
            x = 1
        }
        const obj = { a: 1 }
        assert.deepEqual(
            toRuntimeObjectArray([new Point(), new Date(), new Map(), obj]),
            [obj],
        )
    })
})
