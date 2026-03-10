import process, { env, execArgv, pid, title } from "node:process"
import type { Logger } from "@logtape/logtape"

/**
 * A function that performs the actual application launch after process
 * lifecycle handlers have been set up by {@link main}.
 *
 * @param logger - Logger instance, forwarded from {@link main}.
 */
export type LauncherFunction = (logger: Logger) => void

/**
 * Bootstraps an application process: logs startup information, registers
 * handlers for `SIGINT`, `SIGTERM`, `uncaughtException`, and
 * `unhandledRejection`, then delegates to the optional launcher function.
 *
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param launcher - Optional function invoked after all process handlers are
 *   registered. Use a closure to capture any additional context needed.
 *
 * @example Without a launcher:
 * ```ts
 * import { getLogger } from "@logtape/logtape"
 * import { main } from "@darthcav/ts-utils"
 *
 * main("my-app", getLogger(["my-app"]))
 * ```
 *
 * @example With a launcher:
 * ```ts
 * main("my-app", getLogger(["my-app"]), (logger) => {
 *     logger.info(`Application is running`)
 *     // start servers, connect to databases, etc.
 * })
 * ```
 *
 * @example Disable the built-in interruption handler to manage shutdown yourself:
 * ```ts
 * main("my-app", getLogger(["my-app"]), false, (logger) => {
 *     const server = createServer(...)
 *     process.on("SIGTERM", () => server.close(() => process.exit(0)))
 * })
 * ```
 */
export function main(
    name: string,
    logger: Logger,
    launcher?: LauncherFunction,
): void

/**
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param defaultInterruptionHandler - When `true` (default), registers `SIGINT`
 *   and `SIGTERM` handlers that log and exit cleanly. Set to `false` when the
 *   application manages its own graceful shutdown (e.g. closing servers or
 *   database connections). Can be omitted entirely — pass the launcher directly
 *   as the third argument to use the default (`true`).
 * @param launcher - Optional function invoked after all process handlers are
 *   registered. Use a closure to capture any additional context needed.
 */
export function main(
    name: string,
    logger: Logger,
    defaultInterruptionHandler: boolean,
    launcher?: LauncherFunction,
): void
export function main(
    name: string,
    logger: Logger,
    defaultInterruptionHandlerOrLauncher?: boolean | LauncherFunction,
    launcher?: LauncherFunction,
): void {
    let defaultInterruptionHandler = true
    let __f: LauncherFunction | undefined

    if (typeof defaultInterruptionHandlerOrLauncher === "boolean") {
        defaultInterruptionHandler = defaultInterruptionHandlerOrLauncher
        __f = launcher
    } else {
        __f = defaultInterruptionHandlerOrLauncher
    }

    const __logger = logger.getChild(["main"])

    __logger.info(`Main process launched [${title} :: ${pid}]`)
    __logger.info(`Process name: ${name}`)
    __logger.info(`Node.js environment: ${env?.["NODE_ENV"] ?? ""}`)
    __logger.info(
        `Node.js process options: ${execArgv.concat(env?.["NODE_OPTIONS"] ?? []).join(" | ")}`,
    )

    if (defaultInterruptionHandler) {
        for (const signal of ["SIGINT", "SIGTERM"] as const) {
            process.on(signal, (signal) => {
                __logger.error(
                    `Process interrupted. Received signal: ${signal}`,
                )
                process.exit(0)
            })
        }
    }

    process.on("uncaughtException", (error, origin) => {
        __logger.error(`Uncaught exception: ${error}`)
        __logger.error(`Exception origin: ${origin}`)
        process.exit(1)
    })

    process.on("unhandledRejection", (reason, p) => {
        __logger.error(
            `Unhandled promise rejection at promise: ${JSON.stringify(p)}`,
        )
        __logger.error(`Reason:\n${reason}`)
        process.exit(1)
    })

    __f?.(logger)
}
