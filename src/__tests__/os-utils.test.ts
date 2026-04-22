import assert from "node:assert/strict"
import { platform } from "node:os"
import { suite, test } from "node:test"
import type { Assert, Equal } from "asserttt"
import { type OsRelease, osRelease } from "../os-utils.ts"

type _OsReleaseName = Assert<Equal<OsRelease["name"], string>>
type _OsReleaseVersion = Assert<Equal<OsRelease["version"], string>>
type _OsReleaseArch = Assert<Equal<OsRelease["arch"], string>>

await suite("osRelease", () => {
    test("returns an object on Linux", () => {
        if (platform() !== "linux") {
            return
        }
        const result = osRelease()
        assert.notEqual(result, null)
        assert.equal(typeof result, "object")
    })

    test("returns an object on Windows", () => {
        if (platform() !== "win32") {
            return
        }
        const result = osRelease()
        assert.notEqual(result, null)
        assert.equal(typeof result, "object")
    })

    test("returns null on unsupported platforms", () => {
        if (platform() === "linux" || platform() === "win32") {
            return
        }
        assert.equal(osRelease(), null)
    })

    test("all values are strings on Linux", () => {
        if (platform() !== "linux") {
            return
        }
        const result = osRelease()
        assert.ok(result !== null)
        for (const value of Object.values(result)) {
            assert.equal(typeof value, "string")
        }
    })

    test("contains expected raw keys on Linux", () => {
        if (platform() !== "linux") {
            return
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.ok("ID" in result)
        assert.ok("NAME" in result)
    })

    test("values do not contain surrounding quotes on Linux", () => {
        if (platform() !== "linux") {
            return
        }
        const result = osRelease()
        assert.ok(result !== null)
        for (const value of Object.values(result)) {
            if (typeof value !== "string") {
                continue
            }
            assert.ok(!value.startsWith('"'))
            assert.ok(!value.endsWith('"'))
        }
    })

    test("name, version, and arch are strings", () => {
        if (platform() !== "linux" && platform() !== "win32") {
            return
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(typeof result.name, "string")
        assert.equal(typeof result.version, "string")
        assert.equal(typeof result.arch, "string")
    })

    test("name starts with 'Windows' on Windows", () => {
        if (platform() !== "win32") {
            return
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.ok(result.name.startsWith("Windows "))
    })
})
