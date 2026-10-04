import { constants } from "node:os"
import process, { env, execArgv, pid, title } from "node:process"
import { dispose, type Logger } from "@logtape/logtape"
import { monitorMemory } from "./monitorMemory.ts"

/**
 * Default upper bound for flushing log sinks before the process exits, so a
 * hanging sink cannot block shutdown.
 */
const DEFAULT_FLUSH_TIMEOUT_MS = 3_000

/**
 * Longest delay `setTimeout` supports (2³¹ − 1 ms). Node.js silently replaces
 * larger delays with 1 ms.
 */
const MAX_FLUSH_TIMEOUT_MS = 2_147_483_647

/** Whether a {@link main} call is active, i.e. not yet torn down. */
let active = false

/**
 * Flushes and disposes the configured logtape sinks, giving up after
 * `timeoutMs`. Never rejects: logging is best effort while the process is
 * shutting down.
 */
async function flushLogs(timeoutMs: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        await Promise.race([
            dispose(),
            new Promise<void>((resolve) => {
                timer = setTimeout(resolve, timeoutMs)
            }),
        ])
    } catch {
        // Ignore sink errors: the process is exiting anyway.
    } finally {
        clearTimeout(timer)
    }
}

/** Renders an error (with its stack when available) or any other value. */
function describe(value: unknown): string {
    return value instanceof Error
        ? (value.stack ?? String(value))
        : String(value)
}

/**
 * A function that performs the actual application launch after process
 * lifecycle handlers have been set up by {@link main}. Use a closure to
 * capture any context needed (e.g. a logger).
 *
 * It may be asynchronous: if it throws or its promise rejects, {@link main}
 * logs the failure and exits the process with status `1`.
 */
export type LauncherFunction = () => void | Promise<void>

/**
 * Options for {@link main}. All of them are optional.
 */
export type MainOptions = {
    /**
     * Function invoked after all process handlers are registered. Use a
     * closure to capture any context needed (e.g. a logger).
     */
    launcher?: LauncherFunction
    /**
     * When greater than `0`, starts periodic memory logging every
     * `monitorMemoryHours` hours via {@link monitorMemory} (which validates
     * the value). Must be `0` or a positive finite number; negative values
     * and `NaN` throw. Defaults to `0` (disabled).
     */
    monitorMemoryHours?: number
    /**
     * When `true` (default), registers `SIGINT` and `SIGTERM` handlers that
     * log, flush the logs, and stop the process. Set to `false` when the
     * application manages its own graceful shutdown (e.g. closing servers or
     * database connections).
     */
    defaultInterruptionHandler?: boolean
    /**
     * Maximum time in milliseconds to wait for the logtape sinks to flush
     * before the process exits. Must be between `0` and 2³¹ − 1. Defaults to
     * `3000`.
     */
    flushTimeoutMs?: number
}

/**
 * Bootstraps an application process: logs startup information, optionally
 * registers handlers for `SIGINT` and `SIGTERM` (see
 * {@link MainOptions.defaultInterruptionHandler}), always registers handlers
 * for `uncaughtException` and `unhandledRejection`, optionally starts memory
 * monitoring, then runs the optional launcher function.
 *
 * The process title, PID, name, and `NODE_ENV` are logged at `info` level.
 * The Node.js process options (`execArgv` and `NODE_OPTIONS`) are logged at
 * `debug` level only, since they can reveal sensitive flags such as
 * `--inspect=0.0.0.0` or `--require` paths.
 *
 * Before the process exits, the configured logtape sinks are flushed and
 * disposed (for at most `flushTimeoutMs`, 3 seconds by default), so buffered
 * or asynchronous sinks do not lose the final messages. On `SIGINT`/`SIGTERM`
 * the signal is logged at `info` level and then re-raised, so the process ends
 * as killed by that signal (exit status 130/143), which shells and
 * supervisors such as systemd treat as a clean stop. If another listener for
 * that signal is registered, the process exits with status
 * `128 + signal number` instead. Uncaught exceptions, unhandled rejections,
 * and launcher failures exit with status `1`. A second signal or error during
 * the flush exits immediately.
 *
 * Only one `main` call can be active at a time: calling it again before
 * running the returned teardown function throws, instead of registering a
 * second set of handlers.
 *
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param options - Optional {@link MainOptions}.
 * @returns A teardown function that removes the process handlers registered
 *   by this call and stops the memory monitoring, allowing `main` to be called
 *   again (e.g. in tests). It does not exit the process; calling it more than
 *   once is harmless.
 * @throws {TypeError} If `options` is not an object.
 * @throws {Error} If another `main` call is still active.
 * @throws {RangeError} If `monitorMemoryHours` or `flushTimeoutMs` is out of
 *   range. Nothing is registered in that case.
 *
 * @example Without options:
 * ```ts
 * main("my-app", logger)
 * ```
 *
 * @example With an async launcher and memory monitoring every 2 hours:
 * ```ts
 * main("my-app", logger, {
 *     launcher: async () => {
 *         await connectToDatabase()
 *         startServer()
 *     },
 *     monitorMemoryHours: 2,
 * })
 * ```
 *
 * @example Managing graceful shutdown in the application:
 * ```ts
 * let server: Server | undefined
 * const teardown = main("my-app", logger, {
 *     launcher: () => {
 *         server = startServer()
 *     },
 *     defaultInterruptionHandler: false,
 * })
 * process.once("SIGTERM", async () => {
 *     await server?.close()
 *     teardown()
 * })
 * ```
 */
export function main(
    name: string,
    logger: Logger,
    options?: MainOptions,
): () => void {
    // Rejects the positional arguments removed in 0.11.0 (e.g. a launcher
    // function) from untyped callers, instead of silently ignoring them.
    if (
        options !== undefined &&
        (typeof options !== "object" || options === null)
    ) {
        throw new TypeError(
            `main: "options" must be a MainOptions object, received ${options === null ? "null" : typeof options}`,
        )
    }
    const {
        launcher,
        monitorMemoryHours = 0,
        defaultInterruptionHandler = true,
        flushTimeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
    } = options ?? {}

    // Positive values are validated further by `monitorMemory`.
    if (!Number.isFinite(monitorMemoryHours) || monitorMemoryHours < 0) {
        throw new RangeError(
            `main: "monitorMemoryHours" must be 0 (disabled) or a positive finite number, received ${monitorMemoryHours}`,
        )
    }
    if (
        !Number.isFinite(flushTimeoutMs) ||
        flushTimeoutMs < 0 ||
        flushTimeoutMs > MAX_FLUSH_TIMEOUT_MS
    ) {
        throw new RangeError(
            `main: "flushTimeoutMs" must be a finite number between 0 and ${MAX_FLUSH_TIMEOUT_MS}, received ${flushTimeoutMs}`,
        )
    }
    if (active) {
        throw new Error(
            "main: already active; call the teardown function returned by the previous main() call first",
        )
    }

    const __logger = logger.getChild(["main"])

    __logger.info`Main process launched [${title} :: ${pid}]`
    __logger.info`Process name: ${name}`
    __logger.info`Node.js environment: ${env["NODE_ENV"] ?? ""}`
    // Process options can reveal sensitive flags (e.g. `--inspect=0.0.0.0`
    // or `--require` paths), so they are only logged at debug level.
    __logger.debug`Node.js process options: ${execArgv.concat(env["NODE_OPTIONS"] ?? []).join(" | ")}`

    // Started before any handler is registered: it throws on invalid hours.
    const stopMonitoring =
        monitorMemoryHours > 0
            ? monitorMemory(__logger, monitorMemoryHours)
            : undefined

    // Set once a shutdown starts: a second signal or error while the logs are
    // being flushed exits immediately instead of waiting again.
    let shuttingDown = false
    const exitAfterFlush = async (exit: () => void): Promise<void> => {
        if (!shuttingDown) {
            shuttingDown = true
            await flushLogs(flushTimeoutMs)
        }
        exit()
    }

    const removeListeners: (() => void)[] = []

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
            removeListeners.push(() => process.off(signal, onSignal))
        }
    }

    const onUncaughtException = (
        error: Error,
        origin: NodeJS.UncaughtExceptionOrigin,
    ): Promise<void> => {
        __logger.error`Uncaught exception: ${describe(error)}`
        __logger.error`Exception origin: ${origin}`
        return exitAfterFlush(() => process.exit(1))
    }
    process.on("uncaughtException", onUncaughtException)
    removeListeners.push(() =>
        process.off("uncaughtException", onUncaughtException),
    )

    const onUnhandledRejection = (reason: unknown): Promise<void> => {
        __logger.error`Unhandled promise rejection. Reason:\n${describe(reason)}`
        return exitAfterFlush(() => process.exit(1))
    }
    process.on("unhandledRejection", onUnhandledRejection)
    removeListeners.push(() =>
        process.off("unhandledRejection", onUnhandledRejection),
    )

    active = true
    let tornDown = false
    const teardown = (): void => {
        if (tornDown) {
            return
        }
        tornDown = true
        stopMonitoring?.()
        for (const remove of removeListeners) {
            remove()
        }
        active = false
    }

    const onLauncherFailure = (error: unknown): Promise<void> => {
        __logger.error`Launcher failed: ${describe(error)}`
        return exitAfterFlush(() => process.exit(1))
    }
    try {
        const result = launcher?.()
        if (result !== undefined) {
            Promise.resolve(result).catch(onLauncherFailure)
        }
    } catch (error) {
        void onLauncherFailure(error)
    }

    return teardown
}
