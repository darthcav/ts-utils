/**
 * LogTape logger helpers: a configured console logger and a no-op logger for
 * tests.
 *
 * @example
 * ```ts
 * import { getConsoleLogger } from "@darthcav/ts-utils/loggers"
 * ```
 *
 * @module loggers
 */

export { getConsoleLogger } from "./getConsoleLogger.ts"
export { getDummyLogger } from "./getDummyLogger.ts"
