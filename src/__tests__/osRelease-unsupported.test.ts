import assert from "node:assert/strict"
import { mock, suite, test } from "node:test"

const readFileSync = mock.fn((): string => {
    throw new Error("no release file should be read")
})

mock.module("node:os", {
    namedExports: {
        platform: () => "freebsd",
        release: () => "14.1-RELEASE",
        arch: () => "x64",
    },
})

mock.module("node:fs", { namedExports: { readFileSync } })

const { osRelease } = await import("../node/osRelease.ts")

await suite("osRelease (unsupported platform)", () => {
    test("returns null without reading any file", () => {
        assert.equal(osRelease(), null)
        assert.equal(readFileSync.mock.callCount(), 0)
    })
})
