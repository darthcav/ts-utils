import type { Logger, LogLevel, LogRecord } from "@logtape/logtape"

/**
 * Already-settled promise returned by every logging method. It satisfies the
 * overloads that return `Promise<void>` (asynchronous lazy properties), just as
 * a real logtape logger does for a disabled level.
 */
const settled: Promise<void> = Promise.resolve()

/** A logging method that accepts every logtape overload and does nothing. */
const log = (..._args: readonly unknown[]): Promise<void> => settled

/**
 * Returns a no-op {@link Logger} useful as a placeholder in tests.
 *
 * All logging methods (`trace`, `debug`, `info`, `warn`, `warning`, `error`,
 * `fatal`) are no-ops; the ones logtape types as returning a promise return an
 * already-settled one. `isEnabledFor` always returns `false`. `getChild` and
 * `with` return the same dummy logger instance.
 *
 * Each call returns a new instance, so mocking a method on one (e.g. with
 * `mock.method(logger, "info")`) does not affect others.
 *
 * @returns A logger whose methods are all no-ops.
 *
 * @example
 * ```ts
 * import { getDummyLogger, main } from "@darthcav/ts-utils"
 *
 * main("test-app", getDummyLogger())
 * ```
 */
export default function getDummyLogger(): Logger {
    const logger: Logger = {
        category: [],
        parent: null,
        trace: log,
        debug: log,
        info: log,
        warn: log,
        warning: log,
        error: log,
        fatal: log,
        emit: (_record: Omit<LogRecord, "category">): void => {},
        getChild: () => logger,
        isEnabledFor: (_level: LogLevel): boolean => false,
        with: () => logger,
    }
    return logger
}
