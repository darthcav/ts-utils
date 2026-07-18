/**
 * Maximum number of {@link Intl.DurationFormat} instances retained in the
 * cache. Bounds memory growth when many distinct locales are requested (e.g.
 * a locale derived from untrusted input). When the limit is reached, the
 * least-recently-inserted entry is evicted.
 */
const MAX_CACHED_FORMATTERS = 64

const durationFormatters = new Map<string, Intl.DurationFormat>()

function getDurationFormatter(locale: string): Intl.DurationFormat {
    let formatter = durationFormatters.get(locale)
    if (formatter === undefined) {
        try {
            formatter = new Intl.DurationFormat(locale, {
                style: "narrow",
            })
        } catch (cause) {
            throw new RangeError(
                `millisecondsToString: invalid locale "${locale}"`,
                { cause },
            )
        }
        if (durationFormatters.size >= MAX_CACHED_FORMATTERS) {
            const oldest = durationFormatters.keys().next().value
            if (oldest !== undefined) {
                durationFormatters.delete(oldest)
            }
        }
        durationFormatters.set(locale, formatter)
    }

    return formatter
}

/**
 * Converts a duration in milliseconds to a human-readable string such as
 * `"1d 4h 32m 10s 250ms"`.
 *
 * Milliseconds are shown as their own integer component; fractional inputs
 * are rounded to the nearest millisecond. Any zero-valued components are
 * omitted from the formatted output, so a zero-millisecond input produces an
 * empty string. Negative durations are formatted from their magnitude and
 * prefixed with `"-"` (e.g. `-90_000` → `"-1m 30s"`).
 *
 * @param ms - Duration in milliseconds. Must be a finite number.
 * @param locale - BCP 47 locale tag passed to `Intl.DurationFormat`. Defaults
 *   to `"en"`.
 * @returns A formatted duration string.
 * @throws {RangeError} If `ms` is not finite (`NaN`, `Infinity`, `-Infinity`)
 *   or `locale` is not a valid BCP 47 language tag.
 *
 * @example
 * ```ts
 * millisecondsToString(3_661_000)       // "1h 1m 1s"
 * millisecondsToString(90_000)          // "1m 30s"
 * millisecondsToString(5_250)           // "5s 250ms"
 * millisecondsToString(499)             // "499ms"
 * millisecondsToString(-90_000)         // "-1m 30s"
 * millisecondsToString(90_061_000, "es") // "1d 1h 1min 1s"
 * ```
 */
export default function millisecondsToString(
    ms: number,
    locale = "en",
): string {
    if (!Number.isFinite(ms)) {
        throw new RangeError(
            `millisecondsToString: "ms" must be a finite number, received ${ms}`,
        )
    }

    const totalMilliseconds = Math.round(ms)
    const magnitude = Math.abs(totalMilliseconds)

    const formatted = getDurationFormatter(locale).format({
        days: Math.floor(magnitude / 86_400_000),
        hours: Math.floor((magnitude % 86_400_000) / 3_600_000),
        minutes: Math.floor((magnitude % 3_600_000) / 60_000),
        seconds: Math.floor((magnitude % 60_000) / 1000),
        milliseconds: magnitude % 1000,
    })

    return totalMilliseconds < 0 && formatted ? `-${formatted}` : formatted
}
