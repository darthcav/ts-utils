import assert from "node:assert/strict"
import { mock, suite, test } from "node:test"
import { fakeReadFileSync, type MockedFiles } from "./helpers.ts"

let files: MockedFiles = {}

mock.module("node:os", {
    namedExports: {
        platform: () => "linux",
        release: () => "6.0.0",
        arch: () => "x64",
    },
})

mock.module("node:fs", {
    namedExports: { readFileSync: fakeReadFileSync(() => files) },
})

const { osRelease } = await import("../node/osRelease.ts")

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

    test("exposes the raw keys in a plain object next to the normalized fields", () => {
        files = {
            "/etc/os-release": 'ID=ubuntu\nNAME="Ubuntu"\nVERSION_ID=24.04\n',
        }
        const result = osRelease()
        assert.equal(Object.getPrototypeOf(result), Object.prototype)
        assert.deepEqual(
            { ...result },
            {
                ID: "ubuntu",
                NAME: "Ubuntu",
                VERSION_ID: "24.04",
                name: "Ubuntu",
                version: "24.04",
                arch: "x64",
            },
        )
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
