import type { Logger, LogLevel, LogRecord } from "@logtape/logtape"
import noop from "../noop.ts"

/**
 * Returns a no-op {@link Logger} useful as a placeholder in tests.
 *
 * All logging methods (`trace`, `debug`, `info`, `warn`, `warning`, `error`,
 * `fatal`) are no-ops. `getChild` and `with` return the same dummy logger
 * instance.
 *
 * @returns A logger whose methods are all no-ops.
 */
export default function getDummyLogger(): Logger {
    const logger: Logger = {
        category: [],
        parent: null,
        trace: noop as unknown as Logger["trace"],
        debug: noop as unknown as Logger["debug"],
        info: noop as unknown as Logger["info"],
        warn: noop as unknown as Logger["warn"],
        warning: noop as unknown as Logger["warning"],
        error: noop as unknown as Logger["error"],
        fatal: noop as unknown as Logger["fatal"],
        emit: (_record: Omit<LogRecord, "category">): void => {},
        getChild: () => logger,
        isEnabledFor: (_level: LogLevel): boolean => false,
        with: () => logger,
    }
    return logger
}
