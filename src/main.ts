import process, { env, execArgv, pid, title } from "node:process"
import type { Logger } from "@logtape/logtape"
import monitorMemory from "./monitorMemory.ts"

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

    __logger.info(`Main process launched [${title} :: ${pid}]`)
    __logger.info(`Process name: ${name}`)
    __logger.info(`Node.js environment: ${env["NODE_ENV"] ?? ""}`)
    __logger.info(
        `Node.js process options: ${execArgv.concat(env["NODE_OPTIONS"] ?? []).join(" | ")}`,
    )

    if (monitorMemoryHours > 0) {
        monitorMemory(__logger, monitorMemoryHours)
    }

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
        __logger.error(
            `Uncaught exception: ${error instanceof Error ? (error.stack ?? String(error)) : String(error)}`,
        )
        __logger.error(`Exception origin: ${origin}`)
        process.exit(1)
    })

    process.on("unhandledRejection", (reason) => {
        __logger.error(
            `Unhandled promise rejection. Reason:\n${reason instanceof Error ? (reason.stack ?? String(reason)) : String(reason)}`,
        )
        process.exit(1)
    })

    launcher?.()
}
