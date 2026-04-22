import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mock, suite, test } from "node:test"

mock.module("node:fs", {
    namedExports: {
        existsSync: () => false,
        readFileSync,
    },
})

const { osRelease } = await import("../os-utils.ts")

await suite("osRelease (file missing)", async () => {
    test("returns null when /etc/os-release does not exist", () => {
        assert.equal(osRelease(), null)
    })
})
