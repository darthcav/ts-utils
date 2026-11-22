import { readFileSync } from "node:fs"
import { arch, release as kernelRelease, platform } from "node:os"
import type { RuntimeObject } from "../core/guards.ts"

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

/** The macOS property list with the product name and version. */
const MACOS_SYSTEM_VERSION_FILE =
    "/System/Library/CoreServices/SystemVersion.plist"

/** A `<key>…</key>` followed by a `<string>…</string>` value in a plist. */
const PLIST_STRING_ENTRY = /<key>([^<]*)<\/key>\s*<string>([^<]*)<\/string>/g

/** Valid plist keys to copy; this also rules out keys such as `__proto__`. */
const PLIST_KEY = /^[A-Za-z][A-Za-z0-9_]*$/

/** The predefined XML entities. */
const XML_ENTITIES: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
}

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

/** Decodes the predefined and numeric character references of XML text. */
function decodeXml(text: string): string {
    return text.replace(
        /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-z]+));/g,
        (match, hex?: string, decimal?: string, name?: string) => {
            if (hex !== undefined || decimal !== undefined) {
                const codePoint = Number.parseInt(
                    hex ?? decimal ?? "",
                    hex === undefined ? 10 : 16,
                )
                return codePoint <= 0x10ffff
                    ? String.fromCodePoint(codePoint)
                    : match
            }
            return (
                (name !== undefined && Object.hasOwn(XML_ENTITIES, name)
                    ? XML_ENTITIES[name]
                    : undefined) ?? match
            )
        },
    )
}

/**
 * Parses the `<string>` entries of an XML property list into a
 * null-prototype record, skipping other value types and invalid keys.
 */
function parsePlistStrings(content: string): Record<string, string> {
    const raw: Record<string, string> = Object.create(null)
    for (const [, rawKey = "", value = ""] of content.matchAll(
        PLIST_STRING_ENTRY,
    )) {
        const key = decodeXml(rawKey.trim())
        if (PLIST_KEY.test(key)) {
            raw[key] = decodeXml(value.trim())
        }
    }
    return raw
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
 * Parses os-release content into a null-prototype record, skipping blank
 * lines, comments, lines without `=`, and invalid keys.
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
 * import { osRelease } from "@darthcav/ts-utils"
 *
 * const info = osRelease()
 * if (info) console.log(info.name)        // e.g. "Ubuntu", "macOS", or "Windows 11"
 * if (info) console.log(info.PRETTY_NAME) // e.g. "Ubuntu 24.04 LTS" (Linux only)
 * ```
 */
export function osRelease(): OsRelease | null {
    const p = platform()
    if (p === "linux") {
        const content = readFirstFile(OS_RELEASE_FILES)
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
    if (p === "darwin") {
        const content = readFirstFile([MACOS_SYSTEM_VERSION_FILE])
        if (content === null) {
            return null
        }
        const raw = parsePlistStrings(content)
        return {
            ...raw,
            name: raw["ProductName"] || "macOS",
            version: raw["ProductVersion"] ?? "",
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
