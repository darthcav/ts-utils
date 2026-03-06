import process, { env, execArgv, pid, title } from "node:process"
import pkg from "../package.json" with { type: "json" }

/**
 * Initializes the process by logging startup information and registering
 * signal handlers for graceful shutdown and error handling.
 *
 * @remarks
 * Registers handlers for:
 * - `SIGINT` — graceful shutdown on Ctrl+C
 * - `SIGTERM` — graceful shutdown on kill/Docker/Kubernetes
 * - `uncaughtException` — logs and exits on unhandled exceptions
 * - `unhandledRejection` — logs and exits on unhandled promise rejections
 *
 * All diagnostic output is written to `stderr` via `console.error`.
 *
 * @example
 * ```ts
 * import main from "./index.ts"
 *
 * main()
 * ```
 */
export default function main(): void {
    // Log process startup information
    console.error(`Main process launched [${title} :: ${pid}]`)
    console.error(`Process name: ${pkg.name}`)
    console.error(`Node.js environment: ${env?.["NODE_ENV"] ?? ""}`)
    console.error(
        `Node.js process options: ${execArgv.concat(env?.["NODE_OPTIONS"] ?? []).join(" | ")}`,
    )

    // Handle SIGINT (Ctrl+C) and SIGTERM (kill/Docker/k8s) for graceful shutdown
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, (signal) => {
            console.error(`Received signal: ${signal}`)
            process.exit(0)
        })
    }

    // Handle uncaught exceptions to prevent silent failures
    process.on("uncaughtException", (error, origin) => {
        console.error(`Uncaught exception: ${error}`)
        console.error(`Exception origin: ${origin}`)
        process.exit(1)
    })

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, p) => {
        console.error(
            `Unhandled promise rejection at promise: ${JSON.stringify(p)}`,
        )
        console.error(`Reason:\n${reason}`)
        process.exit(1)
    })
}
