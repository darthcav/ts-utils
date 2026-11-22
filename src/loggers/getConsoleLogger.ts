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
 * Whether console output should use ANSI colors. `FORCE_COLOR` wins when set;
 * otherwise both stdout and stderr must support colors, since the console
 * sink writes warnings and errors to stderr.
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
 * Configures LogTape globally and returns a {@link Logger} for the given
 * category.
 *
 * Records at or above `lowestLevel` go to the console with RFC 3339
 * timestamps and full level names; the internal `logtape/meta` logger is
 * silenced.
 *
 * ANSI colors are used only when both stdout and stderr are color terminals
 * (respecting `NO_COLOR`, `NODE_DISABLE_COLORS`, and `TERM=dumb`), so
 * redirected output has no escape codes. `FORCE_COLOR` overrides this: `"0"`
 * or `"false"` disables colors, any other value enables them.
 *
 * Each call replaces the whole global LogTape configuration, so the latest
 * call wins. Applications that configure LogTape themselves should use
 * LogTape's `getLogger` instead.
 *
 * @param name - The top-level category name (typically the application name).
 * @param lowestLevel - The minimum log level to output. Defaults to `"info"`.
 * @returns A promise resolving to a logger scoped to the given category.
 */
export async function getConsoleLogger(
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
