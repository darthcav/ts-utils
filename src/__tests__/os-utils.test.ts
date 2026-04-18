import assert from "node:assert/strict"
import { platform } from "node:os"
import { suite, test } from "node:test"
import type { Assert, Equal } from "asserttt"
import { type LinuxRelease, linuxRelease, windowsRelease } from "../os-utils.ts"

type _LinuxReleaseValueType = Assert<Equal<LinuxRelease[string], string>>

await suite("linuxRelease", () => {
    test("returns an object on Linux", () => {
        if (platform() !== "linux") {
            return
        }
        const result = linuxRelease()
        assert.notEqual(result, null)
        assert.equal(typeof result, "object")
    })

    test("returns null on non-Linux platforms", () => {
        if (platform() === "linux") {
            return
        }
        assert.equal(linuxRelease(), null)
    })

    test("parsed object has string values", () => {
        if (platform() !== "linux") {
            return
        }
        const result = linuxRelease()
        assert.ok(result !== null)
        for (const value of Object.values(result)) {
            assert.equal(typeof value, "string")
        }
    })

    test("parsed object contains expected keys on Linux", () => {
        if (platform() !== "linux") {
            return
        }
        const result = linuxRelease()
        assert.ok(result !== null)
        assert.ok("ID" in result)
        assert.ok("NAME" in result)
    })

    test("values do not contain surrounding quotes", () => {
        if (platform() !== "linux") {
            return
        }
        const result = linuxRelease()
        assert.ok(result !== null)
        for (const value of Object.values(result)) {
            assert.ok(!value.startsWith('"'))
            assert.ok(!value.endsWith('"'))
        }
    })
})

await suite("windowsRelease", () => {
    test("returns an object on Windows", () => {
        if (platform() !== "win32") {
            return
        }
        const result = windowsRelease()
        assert.notEqual(result, null)
        assert.equal(typeof result, "object")
    })

    test("returns null on non-Windows platforms", () => {
        if (platform() === "win32") {
            return
        }
        assert.equal(windowsRelease(), null)
    })

    test("returned object has name, version, and arch on Windows", () => {
        if (platform() !== "win32") {
            return
        }
        const result = windowsRelease()
        assert.ok(result !== null)
        assert.equal(typeof result.name, "string")
        assert.equal(typeof result.version, "string")
        assert.equal(typeof result.arch, "string")
    })

    test("name starts with 'Windows' on Windows", () => {
        if (platform() !== "win32") {
            return
        }
        const result = windowsRelease()
        assert.ok(result !== null)
        assert.ok(result.name.startsWith("Windows "))
    })
})
