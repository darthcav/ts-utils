const durationFormatters = new Map<string, Intl.DurationFormat>()

function getDurationFormatter(locale: string): Intl.DurationFormat {
    let formatter = durationFormatters.get(locale)
    if (formatter === undefined) {
        formatter = new Intl.DurationFormat(locale, {
            style: "narrow",
        })
        durationFormatters.set(locale, formatter)
    }

    return formatter
}

/**
 * Converts a duration in milliseconds to a human-readable string such as
 * `"1d 4h 32m 10s"`.
 *
 * Sub-second values are rounded to the nearest second. Any zero-valued
 * components are omitted from the formatted output, so a zero-millisecond
 * input produces an empty string.
 *
 * @param ms - Duration in milliseconds.
 * @param locale - BCP 47 locale tag passed to `Intl.DurationFormat`. Defaults
 *   to `"en"`.
 * @returns A formatted duration string.
 *
 * @example
 * ```ts
 * millisecondsToString(3_661_000)       // "1h 1m 1s"
 * millisecondsToString(90_000)          // "1m 30s"
 * millisecondsToString(5_000)           // "5s"
 * millisecondsToString(90_061_000, "es") // "1d 1h 1min 1s"
 * ```
 */
export default function millisecondsToString(
    ms: number,
    locale = "en",
): string {
    const totalSeconds = Math.round(ms / 1000)

    return getDurationFormatter(locale).format({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    })
}
