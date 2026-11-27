import { memoryUsage, uptime } from "node:process"
import type { Logger } from "@logtape/logtape"
import { isFiniteNumber } from "../core/guards.ts"
import { millisecondsToString } from "../core/millisecondsToString.ts"
import { isValidDelay, MAX_DELAY_MS } from "./delays.ts"

/** Shortest allowed reporting interval: one minute. */
const MIN_DELAY_MS = 60 * 1_000

/** One hour in milliseconds. */
const HOUR_MS = 60 * 60 * 1_000

/**
 * The valid range of a reporting interval in hours, for error messages.
 * Internal, like {@link isValidHours}.
 */
export const HOURS_RANGE: string = `between ${MIN_DELAY_MS / HOUR_MS} and ${MAX_DELAY_MS / HOUR_MS} (1 minute to 2^31 - 1 ms)`

/**
 * Whether `hours` is a valid reporting interval ({@link HOURS_RANGE}).
 * Internal: {@link main} uses it too, but the `node` entry point does not
 * re-export it.
 */
export function isValidHours(hours: unknown): hours is number {
    return isFiniteNumber(hours) && isValidDelay(hours * HOUR_MS, MIN_DELAY_MS)
}

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
 * @param hours - Interval between reports in hours, from `1 / 60` (one
 *   minute) to about `596.5` (2³¹ − 1 ms). Defaults to `24`.
 * @returns A function that stops the monitoring. Calling it more than once is
 *   harmless.
 * @throws {RangeError} If `hours` is not finite or out of that range.
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
    if (!isValidHours(hours)) {
        throw new RangeError(
            `monitorMemory: "hours" must be a finite number ${HOURS_RANGE}, received ${hours}`,
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
    }, hours * HOUR_MS)
    timer.unref()

    return () => clearInterval(timer)
}
