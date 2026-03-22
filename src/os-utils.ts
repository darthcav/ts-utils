import { existsSync, readFileSync } from "node:fs"
import { arch, release as osRelease, platform } from "node:os"

/**
 * Parsed key-value pairs from `/etc/os-release`.
 *
 * Common keys include `ID`, `NAME`, `VERSION_ID`, and `PRETTY_NAME`.
 * See {@link https://www.freedesktop.org/software/systemd/man/os-release.html | os-release(5)} for the full spec.
 */
export interface LinuxRelease {
    [key: string]: string
}

/**
 * Basic information about the current Windows environment.
 */
export interface WindowsRelease {
    /** Human-readable Windows version name, e.g. `"Windows 11"`. */
    name: string
    /** NT kernel version string as returned by `os.release()`, e.g. `"10.0.22000"`. */
    version: string
    /** Processor architecture as returned by `os.arch()`, e.g. `"x64"`. */
    arch: string
}

const OS_RELEASE = "/etc/os-release"

/**
 * Returns parsed key-value pairs from `/etc/os-release` on Linux, or `null` on other platforms
 * or when the file is absent.
 *
 * @example
 * ```ts
 * import { linuxRelease } from "@darthcav/ts-utils"
 *
 * const info = linuxRelease()
 * if (info) console.log(info.PRETTY_NAME) // e.g. "Ubuntu 24.04 LTS"
 * ```
 */
export function linuxRelease(): LinuxRelease | null {
    if (platform() !== "linux" || !existsSync(OS_RELEASE)) {
        return null
    }
    const result: LinuxRelease = {}
    for (const line of readFileSync(OS_RELEASE, "utf-8").split("\n")) {
        const eq = line.indexOf("=")
        if (eq === -1) {
            continue
        }
        const key = line.substring(0, eq).trim()
        const value = line
            .substring(eq + 1)
            .trim()
            .replace(/^"|"$/g, "")
        result[key] = value
    }
    return result
}

/**
 * Returns basic Windows version information, or `null` on non-Windows platforms.
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
export function windowsRelease(): WindowsRelease | null {
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
