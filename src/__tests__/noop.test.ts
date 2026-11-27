import assert from "node:assert/strict"
import { suite, test } from "node:test"
import { noop } from "../core/noop.ts"

await suite("noop", () => {
    test("is a function that returns undefined", () => {
        assert.equal(typeof noop, "function")
        assert.equal(noop(), undefined)
    })
})
