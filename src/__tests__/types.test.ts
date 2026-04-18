import assert from "node:assert/strict"
import { suite, test } from "node:test"
import type { Assert, Equal } from "asserttt"
import type { RuntimeObject as PublicRuntimeObject } from "../index.ts"
import type { RuntimeObject } from "../types.ts"

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
