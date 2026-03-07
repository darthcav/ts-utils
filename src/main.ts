import process, { env, execArgv, pid, title } from "node:process"
import type { Logger } from "@logtape/logtape"

/**
 * A function that performs the actual application launch after process
 * lifecycle handlers have been set up by {@link main}.
 *
 * @param name - Application name, forwarded from {@link main}.
 * @param logger - Logger instance, forwarded from {@link main}.
 * @param parts - Additional arguments forwarded from the {@link main} call.
 */
export type LauncherFunction = (
    name: string,
    logger: Logger,
    ...parts: unknown[]
) => void

/**
 * Bootstraps an application process: logs startup information, registers
 * handlers for `SIGINT`, `SIGTERM`, `uncaughtException`, and
 * `unhandledRejection`, then delegates to the optional launcher function.
 *
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param __f - Optional launcher function called after setup, receiving `name`,
 *   `logger`, and any additional arguments passed after `__f`.
 *
 * @example
 * ```ts
 * import { getLogger } from "@logtape/logtape"
 * import { main } from "ts-utils"
 *
 * main("my-app", getLogger(["my-app"]), (name, logger) => {
 *     logger.info(`${name} is running`)
 *     // start servers, connect to databases, etc.
 * })
 * ```
 */
export function main(
    name: string,
    logger: Logger,
    ...[__f, ...parts]: [LauncherFunction?, ...unknown[]]
): void {
    const __logger = logger.getChild(["main"])

    __logger.error(`Main process launched [${title} :: ${pid}]`)
    __logger.error(`Process name: ${name}`)
    __logger.error(`Node.js environment: ${env?.["NODE_ENV"] ?? ""}`)
    __logger.error(
        `Node.js process options: ${execArgv.concat(env?.["NODE_OPTIONS"] ?? []).join(" | ")}`,
    )

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, (signal) => {
            __logger.error(`Received signal: ${signal}`)
            process.exit(0)
        })
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

    __f?.(name, logger, ...parts)
}
