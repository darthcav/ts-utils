import assert from "node:assert/strict"
import { mock, suite, test } from "node:test"

const PLIST_FILE = "/System/Library/CoreServices/SystemVersion.plist"

/** Mocked file system: path → content, or an error code to throw. */
let files: Record<string, string | { code: string }> = {}

mock.module("node:os", {
    namedExports: {
        platform: () => "darwin",
        // The Darwin kernel version, which must not be reported as `version`.
        release: () => "24.1.0",
        arch: () => "arm64",
    },
})

mock.module("node:fs", {
    namedExports: {
        readFileSync: (path: string): string => {
            const entry = files[path]
            if (typeof entry === "string") {
                return entry
            }
            const code = entry?.code ?? "ENOENT"
            throw Object.assign(new Error(`${code}: ${path}`), { code })
        },
    },
})

const { osRelease } = await import("../node/osRelease.ts")

/** Wraps `<key>`/value entries in a property list document. */
const plist = (
    entries: string,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>
`

/** SystemVersion.plist as shipped with macOS 15.1. */
const SEQUOIA = plist(`	<key>BuildID</key>
	<string>9D5C1F7E-A9A5-11EF-9F2C-6E2C4B6A9C11</string>
	<key>ProductBuildVersion</key>
	<string>24B83</string>
	<key>ProductCopyright</key>
	<string>1983-2024 Apple Inc.</string>
	<key>ProductName</key>
	<string>macOS</string>
	<key>ProductUserVisibleVersion</key>
	<string>15.1</string>
	<key>ProductVersion</key>
	<string>15.1</string>
	<key>iOSSupportVersion</key>
	<string>18.1</string>`)

await suite("osRelease (darwin platform)", () => {
    test("reports the macOS product name and version, not the Darwin version", () => {
        files = { [PLIST_FILE]: SEQUOIA }
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(result.name, "macOS")
        assert.equal(result.version, "15.1")
        assert.equal(result.arch, "arm64")
        assert.notEqual(result.version, "24.1.0")
    })

    test("exposes every string key of the property list", () => {
        files = { [PLIST_FILE]: SEQUOIA }
        assert.deepEqual(
            { ...osRelease() },
            {
                BuildID: "9D5C1F7E-A9A5-11EF-9F2C-6E2C4B6A9C11",
                ProductBuildVersion: "24B83",
                ProductCopyright: "1983-2024 Apple Inc.",
                ProductName: "macOS",
                ProductUserVisibleVersion: "15.1",
                ProductVersion: "15.1",
                iOSSupportVersion: "18.1",
                name: "macOS",
                version: "15.1",
                arch: "arm64",
            },
        )
    })

    test("keeps the historical product name of older releases", () => {
        files = {
            [PLIST_FILE]: plist(`<key>ProductName</key>
<string>Mac OS X</string>
<key>ProductVersion</key>
<string>10.15.7</string>`),
        }
        const result = osRelease()
        assert.equal(result?.name, "Mac OS X")
        assert.equal(result?.version, "10.15.7")
    })

    test("returns null instead of throwing when the property list cannot be read", () => {
        for (const entry of [
            undefined,
            { code: "EACCES" },
            { code: "EISDIR" },
        ]) {
            files = entry === undefined ? {} : { [PLIST_FILE]: entry }
            assert.equal(osRelease(), null)
        }
    })

    test("falls back to 'macOS' and an empty version when the keys are missing or empty", () => {
        files = {
            [PLIST_FILE]: plist(`<key>ProductName</key>
<string></string>`),
        }
        const result = osRelease()
        assert.equal(result?.name, "macOS")
        assert.equal(result?.version, "")
    })

    test("decodes XML character references in keys and values", () => {
        files = {
            [PLIST_FILE]: plist(`<key>ProductCopyright</key>
<string>&#169; 1983&#x2013;2024 Apple &amp; Co &lt;Inc&gt; &quot;A&quot; &apos;B&apos; &bogus; &#x110000;</string>
<key>Product&#78;ame</key>
<string>macOS</string>`),
        }
        const result = osRelease()
        assert.equal(
            result?.["ProductCopyright"],
            `© 1983–2024 Apple & Co <Inc> "A" 'B' &bogus; &#x110000;`,
        )
        assert.equal(result?.["ProductName"], "macOS")
    })

    test("skips non-string values and keys that are not identifiers", () => {
        files = {
            [PLIST_FILE]: plist(`<key>ProductVersion</key>
<string>15.1</string>
<key>SomeFlag</key>
<true/>
<key>SomeNumber</key>
<integer>3</integer>
<key>__proto__</key>
<string>polluted</string>
<key>constructor</key>
<string>kept as data</string>
<key>has space</key>
<string>skipped</string>`),
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(result["SomeFlag"], undefined)
        assert.equal(result["SomeNumber"], undefined)
        assert.equal(result["has space"], undefined)
        assert.ok(!Object.hasOwn(result, "__proto__"))
        assert.equal(Object.getPrototypeOf(result), Object.prototype)
        assert.equal(result["constructor"], "kept as data")
        assert.equal(({} as Record<string, unknown>)["polluted"], undefined)
    })

    test("normalized fields win over raw keys of the same name", () => {
        files = {
            [PLIST_FILE]: plist(`<key>ProductVersion</key>
<string>15.1</string>
<key>version</key>
<string>raw</string>
<key>arch</key>
<string>raw</string>`),
        }
        const result = osRelease()
        assert.equal(result?.version, "15.1")
        assert.equal(result?.arch, "arm64")
    })
})
