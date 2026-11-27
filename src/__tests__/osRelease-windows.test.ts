import assert from "node:assert/strict"
import { mock, suite, test } from "node:test"

let mockRelease = "10.0.22000"

mock.module("node:os", {
    namedExports: {
        platform: () => "win32",
        release: () => mockRelease,
        arch: () => "x64",
    },
})

const { osRelease } = await import("../node/osRelease.ts")

await suite("osRelease (win32 platform)", () => {
    test("reports the kernel version and os.arch()", () => {
        mockRelease = "10.0.22000"
        assert.deepEqual(osRelease(), {
            name: "Windows 11",
            version: "10.0.22000",
            arch: "x64",
        })
    })

    for (const [release, name] of [
        ["10.0.22000", "Windows 11"],
        ["10.0.21999", "Windows 10"], // last build before Windows 11
        ["10.0.19041", "Windows 10"],
        ["10.0", "Windows 10"], // no build number
        ["6.3.9600", "Windows 8.1"],
        ["6.2.9200", "Windows 8"],
        ["6.1.7601", "Windows 7"],
        ["6.0.6002", "Windows Vista"],
        ["5.2.3790", "Windows XP 64-Bit Edition"],
        ["5.1.2600", "Windows XP"],
        ["5.0.2195", "Windows 2000"],
        ["4.0.1381", "Windows unknown version"],
    ] as const) {
        test(`maps ${release} to ${name}`, () => {
            mockRelease = release
            assert.equal(osRelease()?.name, name)
        })
    }
})
