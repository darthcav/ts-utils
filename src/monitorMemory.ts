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
 * Starts a periodic interval that logs process uptime and memory usage.
 *
 * Memory figures are reported in bytes as returned by Node.js
 * {@link https://nodejs.org/api/process.html#processmemoryusage | process.memoryUsage()}.
 * Reports are emitted through a `"monitorMemory"` child category of the given
 * logger.
 *
 * @param logger - Logger whose `"monitorMemory"` child emits the memory
 *   reports.
 * @param hours - Interval between reports in hours. Must be a finite number
 *   between `1 / 60` (one minute) and about `596.5` (2³¹ − 1 ms, the longest
 *   delay `setInterval` supports). Defaults to `24`.
 * @throws {RangeError} If `hours` is not finite or the resulting interval is
 *   shorter than one minute or longer than 2³¹ − 1 milliseconds.
 *
 * @example
 * ```ts
 * import { getConsoleLogger, monitorMemory } from "@darthcav/ts-utils"
 *
 * const logger = await getConsoleLogger("my-app")
 *
 * monitorMemory(logger)     // every 24 hours
 * monitorMemory(logger, 1)  // every hour
 * ```
 */
export function monitorMemory(logger: Logger, hours: number = 24): void {
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

    setInterval(() => {
        const { rss, heapTotal, heapUsed, external } = memoryUsage()
        __logger.info(
            `Process uptime: ${millisecondsToString(uptime() * 1_000)}`,
        )
        __logger.info(
            `Process memory - Resident set size: ${rss} | Heap total: ${heapTotal} | Heap used: ${heapUsed} | External: ${external}`,
        )
    }, delay)
}
