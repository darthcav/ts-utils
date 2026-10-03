import { memoryUsage, uptime } from "node:process"
import type { Logger } from "@logtape/logtape"
import { millisecondsToString } from "./millisecondsToString.ts"

/** Shortest allowed reporting interval: one minute. */
const MIN_DELAY_MS = 60 * 1_000

/**
 * Longest delay `setInterval` supports (2³¹ − 1 ms, about 596.5 hours). Node.js
 * silently replaces larger delays with 1 ms, which would flood the logs.
 */
const MAX_DELAY_MS = 2_147_483_647

/**
 * Starts a periodic interval that logs process uptime and memory usage, and
 * returns a function that stops it.
 *
 * Memory figures are reported in bytes as returned by Node.js
 * {@link https://nodejs.org/api/process.html#processmemoryusage | process.memoryUsage()}.
 * Reports are emitted through a `"monitorMemory"` child category of the given
 * logger as two `info` records whose figures are also attached as structured
 * properties, so sinks and formatters that keep properties (e.g. JSON Lines)
 * can query them:
 *
 * - `"Process uptime: <duration>"` with `uptime` (the duration formatted by
 *   `millisecondsToString`) and `uptimeMs` (integer milliseconds).
 * - `"Process memory - Resident set size: {rss} | Heap total: {heapTotal} |
 *   Heap used: {heapUsed} | External: {external}"` with `rss`, `heapTotal`,
 *   `heapUsed`, and `external`.
 *
 * The interval timer is unreferenced, so monitoring alone does not keep the
 * process alive.
 *
 * @param logger - Logger whose `"monitorMemory"` child emits the memory
 *   reports.
 * @param hours - Interval between reports in hours. Must be a finite number
 *   between `1 / 60` (one minute) and about `596.5` (2³¹ − 1 ms, the longest
 *   delay `setInterval` supports). Defaults to `24`.
 * @returns A function that stops the monitoring. Calling it more than once is
 *   harmless.
 * @throws {RangeError} If `hours` is not finite or the resulting interval is
 *   shorter than one minute or longer than 2³¹ − 1 milliseconds.
 *
 * @example
 * ```ts
 * import { getConsoleLogger, monitorMemory } from "@darthcav/ts-utils"
 *
 * const logger = await getConsoleLogger("my-app")
 *
 * monitorMemory(logger)                  // every 24 hours
 * const stop = monitorMemory(logger, 1)  // every hour
 * // ...
 * stop()
 * ```
 */
export function monitorMemory(logger: Logger, hours: number = 24): () => void {
    const delay = 60 * 60 * 1_000 * hours
    if (
        !Number.isFinite(delay) ||
        delay < MIN_DELAY_MS ||
        delay > MAX_DELAY_MS
    ) {
        throw new RangeError(
            `monitorMemory: "hours" must be a finite number between ${MIN_DELAY_MS / 3_600_000} and ${MAX_DELAY_MS / 3_600_000} (1 minute to 2^31 - 1 ms), received ${hours}`,
        )
    }
    const __logger = logger.getChild(["monitorMemory"])

    const timer = setInterval(() => {
        const uptimeMs = Math.round(uptime() * 1_000)
        const formattedUptime = millisecondsToString(uptimeMs)
        const { rss, heapTotal, heapUsed, external } = memoryUsage()
        // The duration goes into the message text itself: as a `{uptime}`
        // placeholder, text formatters would render the string quoted. It is
        // safe to embed because "en" durations never contain `{` or `}`.
        __logger.info(`Process uptime: ${formattedUptime}`, {
            uptime: formattedUptime,
            uptimeMs,
        })
        __logger.info(
            "Process memory - Resident set size: {rss} | Heap total: {heapTotal} | Heap used: {heapUsed} | External: {external}",
            { rss, heapTotal, heapUsed, external },
        )
    }, delay)
    // Monitoring alone must not keep the process alive.
    timer.unref()

    return () => clearInterval(timer)
}
