import {
    configure,
    getAnsiColorFormatter,
    getConsoleSink,
    getLogger,
    type Logger,
    type LogLevel,
} from "@logtape/logtape"

/**
 * Configures logging and returns a {@link Logger} for the given category name.
 *
 * Records at or above `lowestLevel` are written to the console using an ANSI
 * color formatter with RFC 3339 timestamps. The internal `logtape/meta` logger
 * is silenced.
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
                formatter: getAnsiColorFormatter({
                    timestamp: "rfc3339",
                    level: "FULL",
                }),
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
    })
    return getLogger([name])
}
