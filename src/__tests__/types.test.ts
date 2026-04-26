import assert from "node:assert/strict"
import { suite, test } from "node:test"
import type { Assert, Equal } from "asserttt"
import type { RuntimeObject as PublicRuntimeObject } from "../index.ts"
import {
    asRuntimeObject,
    asString,
    type RuntimeObject,
    toRuntimeObjectArray,
} from "../types.ts"

type _RuntimeObjectShape = Assert<Equal<RuntimeObject, Record<string, unknown>>>
type _RuntimeObjectExport = Assert<Equal<PublicRuntimeObject, RuntimeObject>>

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
})
