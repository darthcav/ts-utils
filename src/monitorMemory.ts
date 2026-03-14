import { memoryUsage, uptime } from "node:process"
import type { Logger } from "@logtape/logtape"
import millisecondsToString from "./millisecondsToString.ts"

/**
 * Starts a periodic interval that logs process uptime and memory usage.
 *
 * Memory figures are reported in bytes as returned by Node.js
 * {@link https://nodejs.org/api/process.html#processmemoryusage | process.memoryUsage()}.
 *
 * @param logger - Logger instance used to emit the memory reports.
 * @param hours - Interval between reports in hours. Defaults to `24`.
 *
 * @example
 * ```ts
 * import { getConsoleLogger, monitorMemory } from "@darthcav/ts-utils"
 *
 * monitorMemory(getConsoleLogger())     // every 24 hours
 * monitorMemory(getConsoleLogger(), 1)  // every hour
 * ```
 */
export default function monitorMemory(
    logger: Logger,
    hours: number = 24,
): void {
    const delay = 60 * 60 * 1_000 * hours
    setInterval(() => {
        const { rss, heapTotal, heapUsed, external } = memoryUsage()
        logger.info(`Process uptime: ${millisecondsToString(uptime() * 1_000)}`)
        logger.info(
            `Process memory - Resident set size: ${rss} | Heap total: ${heapTotal} | Heap used: ${heapUsed} | External: ${external}`,
        )
    }, delay)
}
