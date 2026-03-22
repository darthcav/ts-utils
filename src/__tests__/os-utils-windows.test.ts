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

const { linuxRelease, windowsRelease } = await import("../os-utils.ts")

await suite("linuxRelease (non-linux platform)", async () => {
    test("returns null on non-Linux platforms", () => {
        assert.equal(linuxRelease(), null)
    })
})

await suite("windowsRelease (win32 platform)", async () => {
    test("Windows 11 (build >= 22000)", () => {
        mockRelease = "10.0.22000"
        const result = windowsRelease()
        assert.ok(result !== null)
        assert.equal(result.name, "Windows 11")
        assert.equal(result.version, "10.0.22000")
        assert.equal(result.arch, "x64")
    })

    test("Windows 10 (build < 22000)", () => {
        mockRelease = "10.0.19041"
        assert.equal(windowsRelease()?.name, "Windows 10")
    })

    test("Windows 8.1", () => {
        mockRelease = "6.3.9600"
        assert.equal(windowsRelease()?.name, "Windows 8.1")
    })

    test("Windows 8", () => {
        mockRelease = "6.2.9200"
        assert.equal(windowsRelease()?.name, "Windows 8")
    })

    test("Windows 7", () => {
        mockRelease = "6.1.7601"
        assert.equal(windowsRelease()?.name, "Windows 7")
    })

    test("Windows Vista", () => {
        mockRelease = "6.0.6002"
        assert.equal(windowsRelease()?.name, "Windows Vista")
    })

    test("Windows XP 64-Bit Edition", () => {
        mockRelease = "5.2.3790"
        assert.equal(windowsRelease()?.name, "Windows XP 64-Bit Edition")
    })

    test("Windows XP", () => {
        mockRelease = "5.1.2600"
        assert.equal(windowsRelease()?.name, "Windows XP")
    })

    test("Windows 2000", () => {
        mockRelease = "5.0.2195"
        assert.equal(windowsRelease()?.name, "Windows 2000")
    })

    test("unknown version", () => {
        mockRelease = "4.0.1381"
        assert.equal(windowsRelease()?.name, "Windows unknown version")
    })

    test("Windows 10 when build number is absent", () => {
        mockRelease = "10.0"
        assert.equal(windowsRelease()?.name, "Windows 10")
    })
})
