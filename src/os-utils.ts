import { existsSync, readFileSync } from "node:fs"
import { arch, release as osRelease, platform } from "node:os"

/**
 * OS release information with normalized fields and optional platform-specific extras.
 *
 * `name`, `version`, and `arch` are always present. On Linux, all keys from
 * `/etc/os-release` (e.g. `ID`, `PRETTY_NAME`, `ID_LIKE`) are also accessible by string index.
 */
export type OsRelease = {
    /** Human-readable OS name, e.g. `"Ubuntu"` or `"Windows 11"`. */
    name: string
    /** OS version string, e.g. `"24.04"` or `"10.0.22000"`. */
    version: string
    /** Processor architecture as returned by `os.arch()`, e.g. `"x64"`. */
    arch: string
    /** Additional platform-specific string properties (e.g. raw `/etc/os-release` keys on Linux). */
    [key: string]: string
}

const OS_RELEASE = "/etc/os-release"

/**
 * Returns OS release information on Linux, or `null` on other platforms or when
 * `/etc/os-release` is absent.
 *
 * The `name`, `version`, and `arch` fields are normalized from `NAME`/`PRETTY_NAME`,
 * `VERSION_ID`/`VERSION`, and `os.arch()` respectively. All raw keys from the file
 * are also present on the returned object.
 *
 * @example
 * ```ts
 * import { linuxRelease } from "@darthcav/ts-utils"
 *
 * const info = linuxRelease()
 * if (info) console.log(info.name)        // e.g. "Ubuntu"
 * if (info) console.log(info.PRETTY_NAME) // e.g. "Ubuntu 24.04 LTS"
 * ```
 */
export function linuxRelease(): OsRelease | null {
    if (platform() !== "linux" || !existsSync(OS_RELEASE)) {
        return null
    }
    const raw: Record<string, string> = {}
    for (const line of readFileSync(OS_RELEASE, "utf-8").split("\n")) {
        const eq = line.indexOf("=")
        if (eq === -1) {
            continue
        }
        const key = line.substring(0, eq).trim()
        raw[key] = line
            .substring(eq + 1)
            .trim()
            .replace(/^"|"$/g, "")
    }
    return {
        ...raw,
        name: raw["NAME"] ?? raw["PRETTY_NAME"] ?? "",
        version: raw["VERSION_ID"] ?? raw["VERSION"] ?? "",
        arch: arch(),
    }
}

/**
 * Returns Windows version information, or `null` on non-Windows platforms.
 *
 * Distinguishes Windows 11 from Windows 10 by NT build number (>= 22000 → Windows 11).
 *
 * @example
 * ```ts
 * import { windowsRelease } from "@darthcav/ts-utils"
 *
 * const info = windowsRelease()
 * if (info) console.log(info.name) // e.g. "Windows 11"
 * ```
 */
export function windowsRelease(): OsRelease | null {
    if (platform() !== "win32") {
        return null
    }
    const version = osRelease()
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
