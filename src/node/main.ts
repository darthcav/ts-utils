import { constants } from "node:os"
import process, { env, execArgv, pid, title } from "node:process"
import { setTimeout as delay } from "node:timers/promises"
import { dispose, type Logger } from "@logtape/logtape"
import { isValidDelay, MAX_DELAY_MS } from "./delays.ts"
import { HOURS_RANGE, isValidHours, monitorMemory } from "./monitorMemory.ts"

/** Default for {@link MainOptions.flushTimeoutMs}. */
const DEFAULT_FLUSH_TIMEOUT_MS = 3_000

/** Default for {@link MainOptions.shutdownTimeoutMs}. */
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000

/** Whether a {@link main} call has not been torn down yet. */
let active = false

/** How a task run by {@link runBounded} ended. */
type BoundedOutcome =
    | { status: "fulfilled" }
    | { status: "rejected"; reason: unknown }
    | { status: "timeout" }

/**
 * Runs a possibly asynchronous task and waits for it for at most `timeoutMs`.
 * Never rejects: a throwing or rejecting task is reported as `"rejected"`.
 * The timer stays referenced, so the process keeps running while it waits.
 */
async function runBounded(
    task: () => unknown,
    timeoutMs: number,
): Promise<BoundedOutcome> {
    const timeout = new AbortController()
    try {
        return await Promise.race([
            Promise.try(task).then(
                (): BoundedOutcome => ({ status: "fulfilled" }),
                (reason: unknown): BoundedOutcome => ({
                    status: "rejected",
                    reason,
                }),
            ),
            delay<BoundedOutcome>(
                timeoutMs,
                { status: "timeout" },
                { signal: timeout.signal },
            ),
        ])
    } finally {
        // Cancels the timer. The pending delay then rejects, but the race has
        // already handled that.
        timeout.abort()
    }
}

/**
 * Renders an error (with its stack when available) or any other value.
 * `Error.isError`, unlike `instanceof`, also recognizes errors from another
 * realm (e.g. a `node:vm` context).
 */
function describe(value: unknown): string {
    return Error.isError(value) ? (value.stack ?? String(value)) : String(value)
}

/** Names the type of `value`, telling `null` apart from objects. */
function typeName(value: unknown): string {
    return value === null ? "null" : typeof value
}

/** Throws a `RangeError` unless `value` is a valid timer delay. */
function assertTimeout(option: string, value: number): void {
    if (!isValidDelay(value)) {
        throw new RangeError(
            `main: "${option}" must be a finite number between 0 and ${MAX_DELAY_MS}, received ${value}`,
        )
    }
}

/** Throws a `TypeError` unless `value` is a function or `undefined`. */
function assertOptionalFunction(option: string, value: unknown): void {
    if (value !== undefined && typeof value !== "function") {
        throw new TypeError(
            `main: "${option}" must be a function, received ${typeName(value)}`,
        )
    }
}

/**
 * Starts the application once {@link main} has registered the process
 * handlers. Use a closure to capture any context needed (e.g. a logger). It
 * may be asynchronous; if it throws or rejects, {@link main} logs the failure
 * and shuts down with exit status `1`.
 */
export type LauncherFunction = () => void | Promise<void>

/**
 * Why {@link main} is shutting down, passed to the {@link ShutdownFunction}.
 *
 * - `reason: "signal"`: a normal stop requested with `SIGINT` or `SIGTERM`.
 * - `reason: "error"`: a fatal failure; `source` says where it came from and
 *   `error` holds the thrown value or rejection reason. The application may
 *   be in an inconsistent state, so only clean up (e.g. close connections).
 */
export type ShutdownContext =
    | {
          readonly reason: "signal"
          readonly signal: "SIGINT" | "SIGTERM"
      }
    | {
          readonly reason: "error"
          readonly source:
              | "uncaughtException"
              | "unhandledRejection"
              | "launcher"
          readonly error: unknown
      }

/**
 * Application cleanup (e.g. closing servers and database connections), run
 * once by {@link main} before the logs are flushed and the process exits. It
 * may be asynchronous; {@link main} waits at most
 * {@link MainOptions.shutdownTimeoutMs} for it.
 *
 * @param context - Why the process is shutting down.
 */
export type ShutdownFunction = (
    context: ShutdownContext,
) => void | Promise<void>

/** Options for {@link main}, all optional. */
export type MainOptions = {
    /** Starts the application (see {@link LauncherFunction}). */
    launcher?: LauncherFunction
    /**
     * Application cleanup, run once on shutdown (see {@link ShutdownFunction}).
     * If it throws, rejects, or exceeds {@link MainOptions.shutdownTimeoutMs},
     * the failure is logged and the process exits with status `1`.
     */
    shutdown?: ShutdownFunction
    /**
     * Maximum wait in milliseconds for {@link MainOptions.shutdown}, between
     * `0` and 2³¹ − 1. Defaults to `10000`.
     */
    shutdownTimeoutMs?: number
    /**
     * When greater than `0`, logs the memory usage every `monitorMemoryHours`
     * hours via {@link monitorMemory}. Must be `0` or an interval that
     * {@link monitorMemory} accepts (one minute to 2³¹ − 1 ms). Defaults to
     * `0` (disabled).
     */
    monitorMemoryHours?: number
    /**
     * When `true` (default), registers `SIGINT` and `SIGTERM` handlers that
     * run the shutdown sequence and stop the process. Set to `false` when the
     * application handles these signals itself.
     */
    defaultInterruptionHandler?: boolean
    /**
     * Flushes the log sinks before the process exits; errors are ignored.
     * Defaults to LogTape's `dispose`, which flushes the sinks configured
     * through the `@logtape/logtape` copy this package uses. Pass another
     * function (e.g. the `dispose` of the application's own LogTape copy), or
     * `noop` to skip flushing.
     */
    flushLogs?: () => void | Promise<void>
    /**
     * Maximum wait in milliseconds for {@link MainOptions.flushLogs}, between
     * `0` and 2³¹ − 1. Defaults to `3000`.
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
 * On `SIGINT`/`SIGTERM`, an uncaught exception, an unhandled rejection, or a
 * launcher failure, `main` runs a shutdown sequence once:
 *
 * 1. The cause is logged (signals at `info`, failures at `error` level) and
 *    the memory monitoring stops.
 * 2. The {@link MainOptions.shutdown} function, if any, runs for at most
 *    `shutdownTimeoutMs` (10 seconds by default). A failure or timeout is
 *    logged at `error` level.
 * 3. The logs are flushed with {@link MainOptions.flushLogs} for at most
 *    `flushTimeoutMs` (3 seconds by default), so asynchronous sinks keep the
 *    final messages.
 * 4. The process exits. A signal is re-raised, so the process ends as killed
 *    by it (exit status 130/143), which shells and supervisors such as
 *    systemd treat as a clean stop; if another listener for that signal
 *    exists, it exits with status `128 + signal number` instead. Fatal
 *    failures, and a failed or timed-out shutdown function, exit with
 *    status `1`.
 *
 * A second signal or fatal failure during the sequence exits immediately.
 *
 * Only one `main` call can be active at a time: calling it again before
 * running the returned teardown function throws.
 *
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param options - Optional {@link MainOptions}.
 * @returns A teardown function that removes the process handlers registered
 *   by this call and stops the memory monitoring, allowing `main` to be called
 *   again (e.g. in tests). It neither runs the shutdown function nor exits
 *   the process; calling it more than once is harmless.
 * @throws {TypeError} If `options` is not an object, or `launcher`,
 *   `shutdown`, or `flushLogs` is not a function.
 * @throws {Error} If another `main` call is still active.
 * @throws {RangeError} If `monitorMemoryHours`, `shutdownTimeoutMs`, or
 *   `flushTimeoutMs` is out of range. Nothing is logged or registered in that
 *   case.
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
 * @example With graceful shutdown of the application's resources:
 * ```ts
 * let server: Server | undefined
 * main("my-app", logger, {
 *     launcher: async () => {
 *         await connectToDatabase()
 *         server = startServer()
 *     },
 *     shutdown: async () => {
 *         await server?.close()
 *         await disconnectFromDatabase()
 *     },
 *     shutdownTimeoutMs: 15_000,
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
            `main: "options" must be a MainOptions object, received ${typeName(options)}`,
        )
    }
    const {
        launcher,
        shutdown,
        shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
        monitorMemoryHours = 0,
        defaultInterruptionHandler = true,
        flushLogs = dispose,
        flushTimeoutMs = DEFAULT_FLUSH_TIMEOUT_MS,
    } = options ?? {}

    assertOptionalFunction("launcher", launcher)
    assertOptionalFunction("shutdown", shutdown)
    assertOptionalFunction("flushLogs", flushLogs)
    if (monitorMemoryHours !== 0 && !isValidHours(monitorMemoryHours)) {
        throw new RangeError(
            `main: "monitorMemoryHours" must be 0 (disabled) or a finite number ${HOURS_RANGE}, received ${monitorMemoryHours}`,
        )
    }
    assertTimeout("shutdownTimeoutMs", shutdownTimeoutMs)
    assertTimeout("flushTimeoutMs", flushTimeoutMs)
    if (active) {
        throw new Error(
            "main: already active; call the teardown function returned by the previous main() call first",
        )
    }

    const __logger = logger.getChild(["main"])

    __logger.info`Main process launched [${title} :: ${pid}]`
    __logger.info`Process name: ${name}`
    __logger.info`Node.js environment: ${env["NODE_ENV"] ?? ""}`
    __logger.debug`Node.js process options: ${execArgv.concat(env["NODE_OPTIONS"] ?? []).join(" | ")}`

    const stopMonitoring =
        monitorMemoryHours > 0
            ? monitorMemory(__logger, monitorMemoryHours)
            : undefined

    // A second signal or failure during the shutdown sequence exits at once.
    let shuttingDown = false

    /** Runs the shutdown sequence, then `exit` (or status `1` on failure). */
    const shutDown = async (
        context: ShutdownContext,
        exit: () => void,
    ): Promise<void> => {
        if (shuttingDown) {
            exit()
            return
        }
        shuttingDown = true
        stopMonitoring?.()

        let cleanupFailed = false
        if (shutdown !== undefined) {
            const outcome = await runBounded(
                () => shutdown(context),
                shutdownTimeoutMs,
            )
            cleanupFailed = outcome.status !== "fulfilled"
            if (outcome.status === "rejected") {
                __logger.error`Shutdown function failed: ${describe(outcome.reason)}`
            } else if (outcome.status === "timeout") {
                __logger.error`Shutdown function timed out after ${shutdownTimeoutMs} ms`
            }
        }

        // Best effort: flush failures and timeouts are ignored.
        await runBounded(flushLogs, flushTimeoutMs)

        if (cleanupFailed) {
            process.exit(1)
        } else {
            exit()
        }
    }

    const removeListeners: (() => void)[] = []

    if (defaultInterruptionHandler) {
        for (const signal of ["SIGINT", "SIGTERM"] as const) {
            const onSignal = (): Promise<void> => {
                __logger.info`Process interrupted. Received signal: ${signal}`
                return shutDown({ reason: "signal", signal }, () => {
                    // Re-raise the signal so the process ends as killed by it,
                    // unless another listener would intercept it.
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

    /** Runs the shutdown sequence for a fatal failure, then exits with `1`. */
    const fail = (
        source: Extract<ShutdownContext, { reason: "error" }>["source"],
        error: unknown,
    ): Promise<void> =>
        shutDown({ reason: "error", source, error }, () => process.exit(1))

    const onUncaughtException = (
        error: Error,
        origin: NodeJS.UncaughtExceptionOrigin,
    ): Promise<void> => {
        __logger.error`Uncaught exception: ${describe(error)}`
        __logger.error`Exception origin: ${origin}`
        return fail("uncaughtException", error)
    }
    process.on("uncaughtException", onUncaughtException)
    removeListeners.push(() =>
        process.off("uncaughtException", onUncaughtException),
    )

    const onUnhandledRejection = (reason: unknown): Promise<void> => {
        __logger.error`Unhandled promise rejection. Reason:\n${describe(reason)}`
        return fail("unhandledRejection", reason)
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
        return fail("launcher", error)
    }
    if (launcher !== undefined) {
        Promise.try(launcher).catch(onLauncherFailure)
    }

    return teardown
}
