import assert from "node:assert/strict"
import { mock, suite, test } from "node:test"

/** Mocked file system: path → content, or an error code to throw. */
let files: Record<string, string | { code: string }> = {}

mock.module("node:os", {
    namedExports: {
        platform: () => "linux",
        release: () => "6.0.0",
        arch: () => "x64",
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

const { osRelease } = await import("../os-utils.ts")

await suite("osRelease (linux platform)", async () => {
    test("returns null when no os-release file exists", () => {
        files = {}
        assert.equal(osRelease(), null)
    })

    test("returns null instead of throwing when the files are unreadable", () => {
        files = {
            "/etc/os-release": { code: "EACCES" },
            "/usr/lib/os-release": { code: "EISDIR" },
        }
        assert.equal(osRelease(), null)
    })

    test("prefers /etc/os-release over /usr/lib/os-release", () => {
        files = {
            "/etc/os-release": "NAME=Etc\n",
            "/usr/lib/os-release": "NAME=UsrLib\n",
        }
        assert.equal(osRelease()?.name, "Etc")
    })

    test("falls back to /usr/lib/os-release", () => {
        files = {
            "/etc/os-release": { code: "EACCES" },
            "/usr/lib/os-release": 'NAME="Fedora Linux"\nVERSION_ID=40\n',
        }
        const result = osRelease()
        assert.equal(result?.name, "Fedora Linux")
        assert.equal(result?.version, "40")
        assert.equal(result?.arch, "x64")
    })

    test("skips comments, blank lines, and lines without '='", () => {
        files = {
            "/etc/os-release":
                "# NAME=Commented\n\n   # ID=indented-comment\nGARBAGE\nNAME=Real\r\n",
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(result.name, "Real")
        assert.deepEqual(Object.keys(result).sort(), [
            "NAME",
            "arch",
            "name",
            "version",
        ])
    })

    test("unquotes double- and single-quoted values", () => {
        files = {
            "/etc/os-release": [
                'PRETTY_NAME="Ubuntu 24.04 LTS"',
                "ID_LIKE='debian'",
                'HOME_URL="https://example.com/a\\"b\\\\c\\$d\\`e"',
                "SINGLE='no \\escapes'",
                'UNBALANCED="open',
                "PLAIN=value",
            ].join("\n"),
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(result["PRETTY_NAME"], "Ubuntu 24.04 LTS")
        assert.equal(result["ID_LIKE"], "debian")
        assert.equal(result["HOME_URL"], 'https://example.com/a"b\\c$d`e')
        assert.equal(result["SINGLE"], "no \\escapes")
        assert.equal(result["UNBALANCED"], '"open')
        assert.equal(result["PLAIN"], "value")
        assert.equal(result.name, "Ubuntu 24.04 LTS")
    })

    test("skips keys that are not upper-case variable names", () => {
        files = {
            "/etc/os-release": [
                "__proto__=polluted",
                "constructor=polluted",
                "lower=skipped",
                "1ID=skipped",
                "BAD-KEY=skipped",
                "ID=ubuntu",
            ].join("\n"),
        }
        const result = osRelease()
        assert.ok(result !== null)
        assert.equal(Object.getPrototypeOf(result), Object.prototype)
        assert.ok(!Object.hasOwn(result, "__proto__"))
        assert.ok(!Object.hasOwn(result, "constructor"))
        assert.deepEqual(Object.keys(result).sort(), [
            "ID",
            "arch",
            "name",
            "version",
        ])
    })

    test("falls back to PRETTY_NAME/VERSION, then to empty strings", () => {
        files = {
            "/etc/os-release": 'PRETTY_NAME="Arch Linux"\nVERSION=rolling\n',
        }
        assert.equal(osRelease()?.name, "Arch Linux")
        assert.equal(osRelease()?.version, "rolling")
        files = { "/etc/os-release": "ID=minimal\n" }
        assert.equal(osRelease()?.name, "")
        assert.equal(osRelease()?.version, "")
    })
})
