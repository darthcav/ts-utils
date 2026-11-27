import { readFileSync } from "node:fs"
import { arch, release as kernelRelease, platform } from "node:os"
import type { RuntimeObject } from "../core/guards.ts"
import { parseOsRelease, parsePlistStrings } from "./releaseParsers.ts"

/**
 * OS release information: the normalized `name`, `version`, and `arch`, plus
 * the platform's raw keys by string index:
 *
 * - On Linux, the keys read from the os-release file (`/etc/os-release`, or
 *   `/usr/lib/os-release` as a fallback; e.g. `ID`, `PRETTY_NAME`,
 *   `ID_LIKE`).
 * - On macOS, the string keys of
 *   `/System/Library/CoreServices/SystemVersion.plist` (e.g. `ProductName`,
 *   `ProductVersion`, `ProductBuildVersion`).
 */
export type OsRelease = {
    /** Human-readable OS name, e.g. `"Ubuntu"`, `"macOS"`, or `"Windows 11"`. */
    name: string
    /**
     * OS version string, e.g. `"24.04"`, `"15.1"`, or `"10.0.22000"`. On
     * macOS it is the product version, not the Darwin kernel version (which
     * `os.release()` returns).
     */
    version: string
    /** Processor architecture as returned by `os.arch()`, e.g. `"x64"`. */
    arch: string
} & RuntimeObject

/** Where a platform keeps its release file, and how to read it. */
type ReleaseFile = {
    /** Candidate files, in lookup order. */
    readonly files: readonly string[]
    /** Parses the file content into a null-prototype record of raw keys. */
    readonly parse: (content: string) => Record<string, string>
    /** Picks the normalized `name` from the raw keys. */
    readonly name: (raw: Record<string, string>) => string
    /** Picks the normalized `version` from the raw keys. */
    readonly version: (raw: Record<string, string>) => string
}

/** The platforms whose release information comes from a file. */
const RELEASE_FILES: Readonly<Partial<Record<NodeJS.Platform, ReleaseFile>>> = {
    linux: {
        // Per the freedesktop.org spec, `/etc/os-release` takes precedence and
        // `/usr/lib/os-release` is the fallback.
        files: ["/etc/os-release", "/usr/lib/os-release"],
        parse: parseOsRelease,
        name: (raw) => raw["NAME"] ?? raw["PRETTY_NAME"] ?? "",
        version: (raw) => raw["VERSION_ID"] ?? raw["VERSION"] ?? "",
    },
    darwin: {
        files: ["/System/Library/CoreServices/SystemVersion.plist"],
        parse: parsePlistStrings,
        name: (raw) => raw["ProductName"] || "macOS",
        version: (raw) => raw["ProductVersion"] ?? "",
    },
}

/**
 * Windows names by the first three characters of the kernel version. Windows
 * 11 also reports `10.`, so it is told apart by build number.
 */
const WINDOWS_NAMES: ReadonlyMap<string, string> = new Map([
    ["10.", "10"],
    ["6.3", "8.1"],
    ["6.2", "8"],
    ["6.1", "7"],
    ["6.0", "Vista"],
    ["5.2", "XP 64-Bit Edition"],
    ["5.1", "XP"],
    ["5.0", "2000"],
])

/** First Windows 11 build number. */
const WINDOWS_11_BUILD = 22000

/** Reads the first readable file of `files`, or returns `null` if none is. */
function readFirstFile(files: readonly string[]): string | null {
    for (const file of files) {
        try {
            return readFileSync(file, "utf-8")
        } catch {
            // Try the next candidate.
        }
    }
    return null
}

/** Maps a Windows kernel version (e.g. `"10.0.22000"`) to a product name. */
function windowsName(version: string): string {
    const [major, , build = 0] = version.split(".").map(Number)
    if (major === 10 && build >= WINDOWS_11_BUILD) {
        return "Windows 11"
    }
    return `Windows ${WINDOWS_NAMES.get(version.substring(0, 3)) ?? "unknown version"}`
}

/**
 * Returns OS release information for the current platform (Linux, macOS, or
 * Windows). `arch` always comes from `os.arch()`.
 *
 * - On Linux, it reads `/etc/os-release`, falling back to
 *   `/usr/lib/os-release`. `name` comes from `NAME` (or `PRETTY_NAME`) and
 *   `version` from `VERSION_ID` (or `VERSION`). Values are unquoted as in a
 *   shell; comments and keys that are not upper-case variable names are
 *   skipped.
 * - On macOS, it reads `/System/Library/CoreServices/SystemVersion.plist`.
 *   `name` is `ProductName` (or `"macOS"`) and `version` is
 *   `ProductVersion` (e.g. `"15.1"`), never the Darwin kernel version.
 * - On Windows, `version` is the kernel version, and Windows 11 is told
 *   apart from Windows 10 by NT build number (>= 22000).
 *
 * On Linux and macOS, the raw keys of the file are also present.
 *
 * @returns An {@link OsRelease}, or `null` on unsupported platforms or when
 *   the release file cannot be read.
 *
 * @example
 * ```ts
 * import { asString, osRelease } from "@darthcav/ts-utils"
 *
 * const info = osRelease()
 * if (info) {
 *     console.log(info.name) // e.g. "Ubuntu", "macOS", or "Windows 11"
 *     // Raw keys are `unknown`; narrow them before use.
 *     const prettyName = asString(info["PRETTY_NAME"]) // e.g. "Ubuntu 24.04 LTS" (Linux only)
 * }
 * ```
 */
export function osRelease(): OsRelease | null {
    const p = platform()
    if (p === "win32") {
        const version = kernelRelease()
        return { name: windowsName(version), version, arch: arch() }
    }
    const source = RELEASE_FILES[p]
    if (source === undefined) {
        return null
    }
    const content = readFirstFile(source.files)
    if (content === null) {
        return null
    }
    const raw = source.parse(content)
    return {
        ...raw,
        name: source.name(raw),
        version: source.version(raw),
        arch: arch(),
    }
}
