import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import process from "node:process"
import { suite, test } from "node:test"
import { fileURLToPath } from "node:url"

const FIXTURE = fileURLToPath(new URL("./fixtures/mainApp.ts", import.meta.url))

/** Upper bound for one fixture run, so a hanging child cannot stall CI. */
const RUN_TIMEOUT_MS = 20_000

/** Windows cannot deliver catchable `SIGINT`/`SIGTERM` to a child process. */
const POSIX_ONLY =
    process.platform === "win32" && "no catchable signals on Windows"

type RunResult = {
    code: number | null
    signal: NodeJS.Signals | null
    lines: string[]
    elapsedMs: number
}

/**
 * Runs the fixture application in `mode`. `onReady` signals are sent once it
 * reports `ready`, and `onShutdown` signals once its shutdown function starts.
 */
function run(
    mode: string,
    signals: { onReady?: NodeJS.Signals; onShutdown?: NodeJS.Signals } = {},
): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const started = performance.now()
        const child = spawn(process.execPath, [FIXTURE, mode], {
            stdio: ["ignore", "pipe", "inherit"],
        })
        const guard = setTimeout(() => {
            child.kill("SIGKILL")
            reject(new Error(`fixture "${mode}" did not exit in time`))
        }, RUN_TIMEOUT_MS)
        const lines: string[] = []
        let buffered = ""
        child.stdout.setEncoding("utf-8")
        child.stdout.on("data", (chunk: string) => {
            buffered += chunk
            let newline = buffered.indexOf("\n")
            while (newline !== -1) {
                const line = buffered.slice(0, newline).trim()
                buffered = buffered.slice(newline + 1)
                lines.push(line)
                if (line === "ready" && signals.onReady) {
                    child.kill(signals.onReady)
                }
                if (
                    line.startsWith("shutdown:") &&
                    line !== "shutdown:done" &&
                    signals.onShutdown
                ) {
                    child.kill(signals.onShutdown)
                }
                newline = buffered.indexOf("\n")
            }
        })
        child.on("error", reject)
        child.on("exit", (code, signal) => {
            clearTimeout(guard)
            resolve({
                code,
                signal,
                lines,
                elapsedMs: performance.now() - started,
            })
        })
    })
}

await suite("main (real process exit)", () => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        test(`runs the shutdown function on ${signal}, then ends killed by ${signal}`, {
            skip: POSIX_ONLY,
        }, async () => {
            const result = await run("signal", { onReady: signal })
            assert.deepEqual(result.lines, [
                "ready",
                `shutdown:signal:${signal}`,
                "shutdown:done",
            ])
            assert.equal(result.signal, signal)
            assert.equal(result.code, null)
        })
    }

    test("exits with status 1 when the shutdown function fails after a signal", {
        skip: POSIX_ONLY,
    }, async () => {
        const result = await run("failing-shutdown", {
            onReady: "SIGTERM",
        })
        assert.deepEqual(result.lines, ["ready", "shutdown:signal:SIGTERM"])
        assert.equal(result.code, 1)
        assert.equal(result.signal, null)
    })

    test("stays alive for a hanging shutdown function until shutdownTimeoutMs, then exits with status 1", {
        skip: POSIX_ONLY,
    }, async () => {
        const result = await run("hanging-shutdown", {
            onReady: "SIGTERM",
        })
        assert.deepEqual(result.lines, ["ready", "shutdown:signal:SIGTERM"])
        assert.equal(result.code, 1)
        assert.ok(
            result.elapsedMs >= 500,
            `exited after ${result.elapsedMs} ms, before the 500 ms timeout`,
        )
    })

    test("a second signal during the shutdown function exits immediately", {
        skip: POSIX_ONLY,
    }, async () => {
        const result = await run("slow-shutdown", {
            onReady: "SIGTERM",
            onShutdown: "SIGINT",
        })
        assert.deepEqual(result.lines, ["ready", "shutdown:signal:SIGTERM"])
        assert.equal(result.signal, "SIGINT")
        assert.ok(
            result.elapsedMs < 10_000,
            "must not wait for the 30 s shutdown timeout",
        )
    })

    test("runs the shutdown function after an uncaught exception, then exits with status 1", async () => {
        const result = await run("uncaught-exception")
        assert.deepEqual(result.lines, [
            "ready",
            "shutdown:error:uncaughtException",
            "shutdown:done",
        ])
        assert.equal(result.code, 1)
        assert.equal(result.signal, null)
    })

    test("runs the shutdown function after a launcher failure, then exits with status 1", async () => {
        const result = await run("launcher-failure")
        assert.deepEqual(result.lines, [
            "shutdown:error:launcher",
            "shutdown:done",
        ])
        assert.equal(result.code, 1)
        assert.equal(result.signal, null)
    })
})
