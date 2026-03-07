import process, { env, execArgv, pid, title } from "node:process"
import type { Logger } from "@logtape/logtape"

/**
 * A function that performs the actual application launch after process
 * lifecycle handlers have been set up by {@link main}.
 *
 * @param logger - Logger instance, forwarded from {@link main}.
 * @param args - Additional arguments forwarded from the {@link main} call.
 */
export type LauncherFunction = (logger: Logger, ...args: unknown[]) => void

/**
 * Bootstraps an application process: logs startup information, registers
 * handlers for `SIGINT`, `SIGTERM`, `uncaughtException`, and
 * `unhandledRejection`, then delegates to the optional launcher function.
 *
 * @param name - Human-readable application name used in log output.
 * @param logger - Logger instance used for all startup and lifecycle messages.
 * @param args - Optional launcher function followed by additional arguments forwarded
 *   to it. If additional arguments are provided, the first argument must be a
 *   {@link LauncherFunction}.
 *
 * @example
 * ```ts
 * import { getLogger } from "@logtape/logtape"
 * import { main } from "@darthcav/ts-utils"
 *
 * main("my-app", getLogger(["my-app"]), (logger) => {
 *     logger.info(`Application is running`)
 *     // start servers, connect to databases, etc.
 * })
 * ```
 */
export function main(
    name: string,
    logger: Logger,
    ...args: [] | [LauncherFunction, ...unknown[]]
): void {
    const [__f, ...parts] = args
    const __logger = logger.getChild(["main"])

    __logger.info(`Main process launched [${title} :: ${pid}]`)
    __logger.info(`Process name: ${name}`)
    __logger.info(`Node.js environment: ${env?.["NODE_ENV"] ?? ""}`)
    __logger.info(
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

    __f?.(logger, ...parts)
}
