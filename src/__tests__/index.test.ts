import assert from "node:assert/strict"
import { suite, test } from "node:test"
import * as api from "../index.ts"

await suite("public API", () => {
    test("exports exactly the documented runtime values", () => {
        assert.deepEqual(Object.keys(api).sort(), [
            "asRuntimeObject",
            "asString",
            "getConsoleLogger",
            "getDummyLogger",
            "isRuntimeObject",
            "isString",
            "main",
            "millisecondsToString",
            "monitorMemory",
            "noop",
            "osRelease",
            "toRuntimeObjectArray",
        ])
    })

    test("has no default export", () => {
        assert.ok(!("default" in api))
    })

    test("every runtime export is a function", () => {
        for (const [name, value] of Object.entries(api)) {
            assert.equal(typeof value, "function", name)
        }
    })
})
