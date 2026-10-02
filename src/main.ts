import { constants } from "node:os"
import process, { env, execArgv, pid, title } from "node:process"
import { dispose, type Logger } from "@logtape/logtape"
import monitorMemory from "./monitorMemory.ts"

/**
 * Upper bound for flushing log sinks before the process exits, so a hanging
 * sink cannot block shutdown.
 */
const FLUSH_TIMEOUT_MS = 3_000

/**
 * Flushes and disposes the configured logtape sinks, giving up after
 * {@link FLUSH_TIMEOUT_MS}. Never rejects: logging is best effort while the
 * process is shutting down.
 */
async function flushLogs(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        await Promise.race([
            dispose(),
            new Promise<void>((resolve) => {
                timer = setTimeout(resolve, FLUSH_TIMEOUT_MS)
            }),
        ])
    } catch {
        // Ignore sink errors: the process is exiting anyway.
    } finally {
        clearTimeout(timer)
    }
}

/**
 * A function that performs the actual application launch after process
 * lifecycle handlers have been set up by {@link main}. Use a closure to
 * capture any context needed (e.g. a logger).
 */
export type LauncherFunction = () => void

/**
 * Bootstraps an application process: logs startup information, registers
 * handlers for `SIGINT`, `SIGTERM`, `uncaughtException`, and
 * `unhandledRejection`, then delegates to the optional launcher function.
 *
 * The process title, PID, name, and `NODE_ENV` are logged at `info` level.
 * The Node.js process options (`execArgv` and `NODE_OPTIONS`) are logged at
 * `debug` level only, since they can reveal sensitive flags such as
 * `--inspect=0.0.0.0` or `--require` paths.
 *
 * Before the process exits, the configured logtape sinks are flushed and
 * disposed (for at most 3 seconds), so buffered or asynchronous sinks do not
 * lose the final messages. On `SIGINT`/`SIGTERM` the signal is logged at
 * `info` level and then re-raised, so the process ends as killed by that
 * signal (exit status 130/143), which shells and supervisors such as systemd
 * treat as a clean stop. If another listener for that signal is registered,
 * the process exits with status `128 + signal number` instead. Uncaught
 * exceptions and unhandled rejections exit with status `1`. A second signal or
 * error during the flush exits immediately.
 *
 * The three optional parameters — `launcher`, `monitorMemoryHours`, and
 * `defaultInterruptionHandler` — have distinct types and can be supplied in
 * any subset and in that order, omitting whichever are not needed:
 *
 * | Call | launcher | monitorMemoryHours | defaultInterruptionHandler |
 * |------|----------|--------------------|---------------------------|
 * | `main(name, logger)` | — | 0 | true |
 * | `main(name, logger, fn)` | fn | 0 | true |
 * | `main(name, logger, 2)` | — | 2 | true |
 * | `main(name, logger, false)` | — | 0 | false |
 * | `main(name, logger, fn, 2)` | fn | 2 | true |
 * | `main(name, logger, fn, false)` | fn | 0 | false |
 * | `main(name, logger, 2, false)` | — | 2 | false |
 * | `main(name, logger, fn, 2, false)` | fn | 2 | false |
 *
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 *
 * @example Without optional parameters:
 * ```ts
 * main("my-app", logger)
 * ```
 *
 * @example With a launcher:
 * ```ts
 * main("my-app", logger, () => startServer())
 * ```
 *
 * @example With memory monitoring every 2 hours:
 * ```ts
 * main("my-app", logger, 2)
 * main("my-app", logger, () => startServer(), 2)
 * ```
 *
 * @example Disable the built-in interruption handler:
 * ```ts
 * main("my-app", logger, false)
 * main("my-app", logger, () => startServer(), false)
 * main("my-app", logger, 2, false)
 * main("my-app", logger, () => startServer(), 2, false)
 * ```
 */
export function main(name: string, logger: Logger): void
export function main(
    name: string,
    logger: Logger,
    launcher: LauncherFunction,
): void
export function main(
    name: string,
    logger: Logger,
    monitorMemoryHours: number,
): void
export function main(
    name: string,
    logger: Logger,
    defaultInterruptionHandler: boolean,
): void
export function main(
    name: string,
    logger: Logger,
    launcher: LauncherFunction,
    monitorMemoryHours: number,
): void
export function main(
    name: string,
    logger: Logger,
    launcher: LauncherFunction,
    defaultInterruptionHandler: boolean,
): void
export function main(
    name: string,
    logger: Logger,
    monitorMemoryHours: number,
    defaultInterruptionHandler: boolean,
): void
/**
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param launcher - Optional function invoked after all process handlers are
 *   registered. Use a closure to capture any context needed (e.g. a logger).
 * @param monitorMemoryHours - When greater than `0`, starts periodic memory
 *   logging every `monitorMemoryHours` hours via {@link monitorMemory}.
 *   Defaults to `0` (disabled).
 * @param defaultInterruptionHandler - When `true` (default), registers `SIGINT`
 *   and `SIGTERM` handlers that log and exit cleanly. Set to `false` when the
 *   application manages its own graceful shutdown (e.g. closing servers or
 *   database connections).
 */
export function main(
    name: string,
    logger: Logger,
    launcher: LauncherFunction,
    monitorMemoryHours: number,
    defaultInterruptionHandler: boolean,
): void
export function main(
    name: string,
    logger: Logger,
    arg3?: LauncherFunction | number | boolean,
    arg4?: number | boolean,
    arg5?: boolean,
): void {
    let launcher: LauncherFunction | undefined
    let monitorMemoryHours = 0
    let defaultInterruptionHandler = true

    if (typeof arg3 === "function") {
        launcher = arg3
        if (typeof arg4 === "number") {
            monitorMemoryHours = arg4
            if (typeof arg5 === "boolean") {
                defaultInterruptionHandler = arg5
            }
        } else if (typeof arg4 === "boolean") {
            defaultInterruptionHandler = arg4
        }
    } else if (typeof arg3 === "number") {
        monitorMemoryHours = arg3
        if (typeof arg4 === "boolean") {
            defaultInterruptionHandler = arg4
        }
    } else if (typeof arg3 === "boolean") {
        defaultInterruptionHandler = arg3
    }

    const __logger = logger.getChild(["main"])

    __logger.info`Main process launched [${title} :: ${pid}]`
    __logger.info`Process name: ${name}`
    __logger.info`Node.js environment: ${env["NODE_ENV"] ?? ""}`
    // Process options can reveal sensitive flags (e.g. `--inspect=0.0.0.0`
    // or `--require` paths), so they are only logged at debug level.
    __logger.debug`Node.js process options: ${execArgv.concat(env["NODE_OPTIONS"] ?? []).join(" | ")}`

    if (monitorMemoryHours > 0) {
        monitorMemory(__logger, monitorMemoryHours)
    }

    // Set once a shutdown starts: a second signal or error while the logs are
    // being flushed exits immediately instead of waiting again.
    let shuttingDown = false
    const exitAfterFlush = async (exit: () => void): Promise<void> => {
        if (!shuttingDown) {
            shuttingDown = true
            await flushLogs()
        }
        exit()
    }

    if (defaultInterruptionHandler) {
        for (const signal of ["SIGINT", "SIGTERM"] as const) {
            const onSignal = (): Promise<void> => {
                __logger.info`Process interrupted. Received signal: ${signal}`
                return exitAfterFlush(() => {
                    // Re-raise the signal with its default disposition so the
                    // process ends as killed by it. Exit with the conventional
                    // status instead if another listener would intercept it.
                    process.off(signal, onSignal)
                    if (process.listenerCount(signal) === 0) {
                        process.kill(pid, signal)
                    } else {
                        process.exit(128 + constants.signals[signal])
                    }
                })
            }
            process.on(signal, onSignal)
        }
    }

    process.on("uncaughtException", (error, origin) => {
        __logger.error`Uncaught exception: ${error instanceof Error ? (error.stack ?? String(error)) : String(error)}`
        __logger.error`Exception origin: ${origin}`
        return exitAfterFlush(() => process.exit(1))
    })

    process.on("unhandledRejection", (reason) => {
        __logger.error`Unhandled promise rejection. Reason:\n${reason instanceof Error ? (reason.stack ?? String(reason)) : String(reason)}`
        return exitAfterFlush(() => process.exit(1))
    })

    launcher?.()
}
