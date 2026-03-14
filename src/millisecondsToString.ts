/**
 * Converts a duration in milliseconds to a human-readable string such as
 * `"1d 4h 32m 10s"`.
 *
 * Sub-second values are rounded to the nearest second. Leading zero components
 * are omitted except for seconds, which are always included.
 *
 * @param ms - Duration in milliseconds.
 * @returns A formatted duration string.
 *
 * @example
 * ```ts
 * millisecondsToString(3_661_000) // "1h 1m 1s"
 * millisecondsToString(90_000)    // "1m 30s"
 * millisecondsToString(5_000)     // "5s"
 * ```
 */
export default function millisecondsToString(ms: number): string {
    const totalSeconds = Math.round(ms / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const parts: string[] = []
    if (days > 0) {
        parts.push(`${days}d`)
    }
    if (hours > 0) {
        parts.push(`${hours}h`)
    }
    if (minutes > 0) {
        parts.push(`${minutes}m`)
    }
    parts.push(`${seconds}s`)
    return parts.join(" ")
}
