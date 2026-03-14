import assert from "node:assert/strict"
import { suite, test } from "node:test"
import noop from "../noop.ts"

await suite("noop", () => {
    test("returns undefined", () => {
        assert.equal(noop(), undefined)
    })

    test("is a function", () => {
        assert.equal(typeof noop, "function")
    })
})
