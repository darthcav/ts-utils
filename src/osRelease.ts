import { readFileSync } from "node:fs"
import { arch, release as kernelRelease, platform } from "node:os"
import type { RuntimeObject } from "./types.ts"

/**
 * OS release information with normalized fields and optional platform-specific extras.
 *
 * `name`, `version`, and `arch` are always present. On Linux, the keys read from
 * the os-release file (`/etc/os-release`, or `/usr/lib/os-release` as a
 * fallback; e.g. `ID`, `PRETTY_NAME`, `ID_LIKE`) are also accessible by string
 * index.
 */
export type OsRelease = {
    /** Human-readable OS name, e.g. `"Ubuntu"` or `"Windows 11"`. */
    name: string
    /** OS version string, e.g. `"24.04"` or `"10.0.22000"`. */
    version: string
    /** Processor architecture as returned by `os.arch()`, e.g. `"x64"`. */
    arch: string
} & RuntimeObject

/**
 * Candidate os-release files, in lookup order. Per the freedesktop.org spec,
 * `/etc/os-release` takes precedence and `/usr/lib/os-release` is the fallback.
 */
const OS_RELEASE_FILES = ["/etc/os-release", "/usr/lib/os-release"] as const

/**
 * Valid os-release keys: shell-compatible, upper-case variable names. This
 * also rules out keys such as `__proto__` or `constructor`.
 */
const OS_RELEASE_KEY = /^[A-Z][A-Z0-9_]*$/

/**
 * Reads the first readable os-release file, or returns `null` when none can be
 * read (missing, unreadable, or not a regular file).
 */
function readOsReleaseFile(): string | null {
    for (const file of OS_RELEASE_FILES) {
        try {
            return readFileSync(file, "utf-8")
        } catch {
            // Try the next candidate.
        }
    }
    return null
}

/**
 * Removes one level of shell-style quoting from an os-release value. Double
 * quotes allow the `\\`, `\"`, `` \` `` and `\$` escapes; single quotes are
 * literal.
 */
function unquote(value: string): string {
    if (value.length >= 2) {
        const quote = value[0]
        if (quote === '"' && value.endsWith('"')) {
            return value.slice(1, -1).replace(/\\([\\"`$])/g, "$1")
        }
        if (quote === "'" && value.endsWith("'")) {
            return value.slice(1, -1)
        }
    }
    return value
}

/**
 * Parses os-release content into a null-prototype record. Blank lines,
 * comments, lines without `=`, and keys that are not valid variable names are
 * skipped.
 */
function parseOsRelease(content: string): Record<string, string> {
    const raw: Record<string, string> = Object.create(null)
    for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed === "" || trimmed.startsWith("#")) {
            continue
        }
        const eq = trimmed.indexOf("=")
        if (eq === -1) {
            continue
        }
        const key = trimmed.substring(0, eq).trim()
        if (!OS_RELEASE_KEY.test(key)) {
            continue
        }
        raw[key] = unquote(trimmed.substring(eq + 1).trim())
    }
    return raw
}

/**
 * Returns OS release information for the current platform, or `null` on
 * unsupported platforms or when no os-release file can be read on Linux.
 *
 * On Linux, the information is read from `/etc/os-release`, falling back to
 * `/usr/lib/os-release`. `name`, `version`, and `arch` are normalized from
 * `NAME`/`PRETTY_NAME`, `VERSION_ID`/`VERSION`, and `os.arch()` respectively.
 * All raw keys from the file are also present on the returned object. Comment
 * lines are ignored, single- and double-quoted values are unquoted (with
 * backslash escapes inside double quotes), and keys that are not upper-case
 * shell variable names are skipped.
 *
 * On Windows, distinguishes Windows 11 from Windows 10 by NT build number
 * (>= 22000 → Windows 11).
 *
 * @returns An {@link OsRelease} object on supported platforms, or `null` when
 *   the platform is unsupported or no os-release file can be read on Linux.
 *
 * @example
 * ```ts
 * import { osRelease } from "@darthcav/ts-utils"
 *
 * const info = osRelease()
 * if (info) console.log(info.name)        // e.g. "Ubuntu" or "Windows 11"
 * if (info) console.log(info.PRETTY_NAME) // e.g. "Ubuntu 24.04 LTS" (Linux only)
 * ```
 */
export function osRelease(): OsRelease | null {
    const p = platform()
    if (p === "linux") {
        const content = readOsReleaseFile()
        if (content === null) {
            return null
        }
        const raw = parseOsRelease(content)
        return {
            ...raw,
            name: raw["NAME"] ?? raw["PRETTY_NAME"] ?? "",
            version: raw["VERSION_ID"] ?? raw["VERSION"] ?? "",
            arch: arch(),
        }
    }
    if (p === "win32") {
        const version = kernelRelease()
        const [major, , build] = version.split(".").map(Number)
        let name = "Windows "
        if (major === 10 && (build ?? 0) >= 22000) {
            name += "11"
        } else {
            switch (version.substring(0, 3)) {
                case "10.":
                    name += "10"
                    break
                case "6.3":
                    name += "8.1"
                    break
                case "6.2":
                    name += "8"
                    break
                case "6.1":
                    name += "7"
                    break
                case "6.0":
                    name += "Vista"
                    break
                case "5.2":
                    name += "XP 64-Bit Edition"
                    break
                case "5.1":
                    name += "XP"
                    break
                case "5.0":
                    name += "2000"
                    break
                default:
                    name += "unknown version"
                    break
            }
        }
        return { name, version, arch: arch() }
    }
    return null
}
