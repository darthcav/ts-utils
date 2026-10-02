import process from "node:process"
import {
    configure,
    getAnsiColorFormatter,
    getConsoleSink,
    getLogger,
    getTextFormatter,
    type Logger,
    type LogLevel,
    type TextFormatterOptions,
} from "@logtape/logtape"

/** Formatter options shared by the colored and the plain formatter. */
const FORMATTER_OPTIONS: TextFormatterOptions = {
    timestamp: "rfc3339",
    level: "FULL",
}

/**
 * Decides whether console output should use ANSI colors.
 *
 * `FORCE_COLOR` wins when set (`"0"` or `"false"` disable colors, any other
 * value enables them). Otherwise colors are used only when both stdout and
 * stderr are terminals that support them, since the console sink writes
 * warnings and errors to stderr. `hasColors()` also honors `NO_COLOR`,
 * `NODE_DISABLE_COLORS`, and `TERM=dumb`.
 */
function useColors(): boolean {
    const force = process.env["FORCE_COLOR"]
    if (force !== undefined) {
        return force !== "0" && force !== "false"
    }
    return [process.stdout, process.stderr].every(
        (stream) => stream.isTTY === true && stream.hasColors(),
    )
}

/**
 * Configures logging and returns a {@link Logger} for the given category name.
 *
 * Records at or above `lowestLevel` are written to the console with RFC 3339
 * timestamps and full level names. The internal `logtape/meta` logger is
 * silenced.
 *
 * ANSI colors are used only when both stdout and stderr are terminals that
 * support them (respecting `NO_COLOR`, `NODE_DISABLE_COLORS`, and `TERM=dumb`),
 * so output redirected to files or pipes stays free of escape codes. Set
 * `FORCE_COLOR` to override: `"0"` or `"false"` disables colors, any other
 * value enables them. The decision is made when this function is called.
 *
 * Logging is configured with `reset: true`, so this function is safe to call
 * more than once: each call reconfigures logtape from scratch and the most
 * recent call wins. (Without it, logtape throws because logging is already
 * configured.)
 *
 * @param name - The top-level category name (typically the application name).
 * @param lowestLevel - The minimum log level to output. Defaults to `"info"`.
 * @returns A promise resolving to a logger scoped to the given category.
 */
export default async function getConsoleLogger(
    name: string,
    lowestLevel: LogLevel = "info",
): Promise<Logger> {
    await configure({
        sinks: {
            console: getConsoleSink({
                formatter: useColors()
                    ? getAnsiColorFormatter(FORMATTER_OPTIONS)
                    : getTextFormatter(FORMATTER_OPTIONS),
            }),
        },
        loggers: [
            { category: [], sinks: ["console"], lowestLevel },
            {
                category: ["logtape", "meta"],
                sinks: [],
                parentSinks: "override",
            },
        ],
        reset: true,
    })
    return getLogger([name])
}
