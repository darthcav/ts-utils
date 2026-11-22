/**
 * Child-process fixture for `main-process.test.ts`: a tiny application that
 * runs `main` with a shutdown function, in the mode given as first argument.
 * It reports progress on stdout, one line per event:
 *
 * - `ready` once the launcher has run;
 * - `shutdown:<reason>:<signal or source>` when the shutdown function starts;
 * - `shutdown:done` when it finishes.
 */

import process from "node:process"
import { getDummyLogger } from "../../loggers/getDummyLogger.ts"
import { main, type ShutdownContext } from "../../node/main.ts"

const mode = process.argv[2] ?? "signal"

/** Writes a line and waits until it is flushed (pipes are async on macOS). */
const report = (line: string): Promise<void> =>
    new Promise((resolve) => {
        process.stdout.write(`${line}\n`, () => resolve())
    })

const describeContext = (context: ShutdownContext): string =>
    context.reason === "signal"
        ? `signal:${context.signal}`
        : `error:${context.source}`

// Keeps the process alive like a server would, until shutdown.
const keepAlive = setInterval(() => {}, 60_000)

main("fixture-app", getDummyLogger(), {
    launcher: async () => {
        if (mode === "launcher-failure") {
            throw new Error("launcher failed")
        }
        await report("ready")
        if (mode === "uncaught-exception") {
            setTimeout(() => {
                throw new Error("uncaught")
            }, 0)
        }
    },
    shutdown: async (context) => {
        await report(`shutdown:${describeContext(context)}`)
        if (mode === "failing-shutdown") {
            throw new Error("cleanup failed")
        }
        if (mode === "hanging-shutdown" || mode === "slow-shutdown") {
            // Never settles: only `shutdownTimeoutMs` ends the wait. Nothing
            // else keeps the event loop alive once the interval is cleared.
            clearInterval(keepAlive)
            await new Promise<void>(() => {})
        }
        clearInterval(keepAlive)
        await report("shutdown:done")
    },
    shutdownTimeoutMs: mode === "slow-shutdown" ? 30_000 : 500,
})
