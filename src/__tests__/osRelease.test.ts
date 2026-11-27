import assert from "node:assert/strict"
import { platform } from "node:os"
import { suite, test } from "node:test"
import { type OsRelease, osRelease } from "../node/osRelease.ts"
import type { Assert } from "../type-testing/Assert.ts"
import type { Equal } from "../type-testing/Equal.ts"

type _OsReleaseName = Assert<Equal<OsRelease["name"], string>>
type _OsReleaseVersion = Assert<Equal<OsRelease["version"], string>>
type _OsReleaseArch = Assert<Equal<OsRelease["arch"], string>>

const os = platform()

/** Skip reason for a test that needs a real `p` system, or `false` to run it. */
const onlyOn = (p: NodeJS.Platform): string | false => os !== p && `${p} only`

// These tests read the real release information of the machine they run on;
// the osRelease-*.test.ts files cover every platform with mocked files.
await suite("osRelease", () => {
    test("on Linux: returns the normalized fields and the raw os-release keys, unquoted", {
        skip: onlyOn("linux"),
    }, () => {
        const result = osRelease()
        assert.ok(result !== null)
        assert.ok("ID" in result)
        assert.ok("NAME" in result)
        for (const value of Object.values(result)) {
            assert.equal(typeof value, "string")
            assert.ok(
                !String(value).startsWith('"') && !String(value).endsWith('"'),
                String(value),
            )
        }
    })

    test("on macOS: reports the product version, not the Darwin version", {
        skip: onlyOn("darwin"),
    }, () => {
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(result.name, "macOS")
        // A product version such as "15.1" or "26.0", never empty.
        assert.match(result.version, /^\d+(\.\d+)+$/)
        assert.equal(result["ProductVersion"], result.version)
        assert.equal(typeof result["ProductBuildVersion"], "string")
        assert.equal(typeof result.arch, "string")
    })

    test("on Windows: reports a Windows product name", {
        skip: onlyOn("win32"),
    }, () => {
        const result = osRelease()
        assert.ok(result !== null)
        assert.ok(result.name.startsWith("Windows "))
        assert.equal(typeof result.version, "string")
        assert.equal(typeof result.arch, "string")
    })

    test("returns null on unsupported platforms", {
        skip: ["linux", "darwin", "win32"].includes(os) && "supported platform",
    }, () => {
        assert.equal(osRelease(), null)
    })
})
