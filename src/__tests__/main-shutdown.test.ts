import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import { noop } from "../core/noop.ts"
import { getDummyLogger } from "../loggers/getDummyLogger.ts"
// Type-only: erased at runtime, so it does not load main.ts before the mock.
import type { MainOptions, ShutdownContext } from "../node/main.ts"
import { handlerFor, renderLog, settle } from "./helpers.ts"

// LogTape's `dispose` is main()'s default `flushLogs`, and this module mock is
// the only way to observe and steer it (pending, failing, or hanging flushes).
// A real LogTape sink cannot stand in for it: LogTape serializes dispose() and
// configure(), so a flush left hanging on purpose would block later tests.
// Custom `flushLogs` functions are tested through the public option below.

/** Controls what the mocked logtape `dispose()` does in each test. */
let disposeImpl: () => Promise<void> = () => Promise.resolve()
const disposeMock = mock.fn(() => disposeImpl())

mock.module("@logtape/logtape", {
    namedExports: { dispose: disposeMock },
})

const { main } = await import("../node/main.ts")

/** Ordered record of the shutdown steps observed by the mocks. */
const steps: string[] = []

/** `main()` logs through this logger; its `error` method records a step. */
const logger = getDummyLogger()
const errorMock = mock.fn((...args: unknown[]) => {
    steps.push(`error:${renderLog(args)}`)
})

const onMock = mock.fn()
const exitMock = mock.fn((code?: number) => {
    steps.push(`exit:${code}`)
})
const killMock = mock.fn((_pid: number, signal: string) => {
    steps.push(`kill:${signal}`)
})

// Teardown functions returned by main(), run after each test so the next test
// can call main() again.
const teardowns: (() => void)[] = []

beforeEach(() => {
    steps.length = 0
    disposeImpl = () => {
        steps.push("dispose")
        return Promise.resolve()
    }
    for (const fn of [disposeMock, errorMock, onMock, exitMock, killMock]) {
        fn.mock.resetCalls()
    }
    mock.method(logger, "error", errorMock)
    mock.method(process, "on", onMock)
    mock.method(process, "off", noop)
    mock.method(process, "exit", exitMock)
    mock.method(process, "kill", killMock)
    mock.method(process, "listenerCount", () => 0)
})

afterEach(() => {
    for (const teardown of teardowns.splice(0)) {
        teardown()
    }
    mock.timers.reset()
    mock.restoreAll()
})

await suite("main (log flushing on shutdown)", () => {
    for (const [event, args, exited] of [
        ["SIGINT", [], () => killMock.mock.callCount()],
        ["SIGTERM", [], () => killMock.mock.callCount()],
        [
            "uncaughtException",
            [new Error("boom"), "uncaughtException"],
            () => exitMock.mock.callCount(),
        ],
        [
            "unhandledRejection",
            [new Error("boom")],
            () => exitMock.mock.callCount(),
        ],
    ] as const) {
        test(`flushes logs before exiting on ${event}`, async () => {
            const { promise, resolve } = Promise.withResolvers<void>()
            disposeImpl = () => promise
            teardowns.push(main("test-app", logger))

            const pending = handlerFor(onMock, event)(...args)
            await new Promise(setImmediate)
            assert.equal(disposeMock.mock.callCount(), 1)
            assert.equal(exited(), 0, "must not exit before the flush ends")

            resolve()
            await pending
            assert.equal(exited(), 1)
        })
    }

    test("still exits when disposing the sinks fails", async () => {
        disposeImpl = () => Promise.reject(new Error("sink failed"))
        teardowns.push(main("test-app", logger))

        await handlerFor(onMock, "uncaughtException")(
            new Error("boom"),
            "origin",
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("gives up on a hanging flush after 3 seconds", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        disposeImpl = () => new Promise<void>(() => {})
        teardowns.push(main("test-app", logger))

        const pending = handlerFor(
            onMock,
            "unhandledRejection",
        )(new Error("boom"))
        mock.timers.tick(2_999)
        await new Promise(setImmediate)
        assert.equal(exitMock.mock.callCount(), 0)

        mock.timers.tick(1)
        await pending
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("a second event during the flush exits immediately", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        disposeImpl = () => new Promise<void>(() => {})
        teardowns.push(main("test-app", logger))

        const first = handlerFor(onMock, "SIGTERM")()
        await handlerFor(onMock, "SIGINT")()
        assert.equal(disposeMock.mock.callCount(), 1)
        assert.equal(killMock.mock.callCount(), 1)
        assert.deepEqual(killMock.mock.calls[0]?.arguments, [
            process.pid,
            "SIGINT",
        ])

        // Let the first flush time out while the process mocks are active.
        mock.timers.tick(3_000)
        await first
        assert.equal(killMock.mock.callCount(), 2)
    })

    test("honors a custom flushTimeoutMs", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        disposeImpl = () => new Promise<void>(() => {})
        teardowns.push(main("test-app", logger, { flushTimeoutMs: 500 }))

        const pending = handlerFor(onMock, "uncaughtException")(
            new Error("boom"),
            "uncaughtException",
        )
        mock.timers.tick(499)
        await new Promise(setImmediate)
        assert.equal(exitMock.mock.callCount(), 0)

        mock.timers.tick(1)
        await pending
        assert.equal(exitMock.mock.callCount(), 1)
    })

    test("a zero flushTimeoutMs does not wait for a hanging flush", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        disposeImpl = () => new Promise<void>(() => {})
        teardowns.push(main("test-app", logger, { flushTimeoutMs: 0 }))

        const pending = handlerFor(
            onMock,
            "unhandledRejection",
        )(new Error("boom"))
        mock.timers.tick(0)
        await pending
        assert.equal(exitMock.mock.callCount(), 1)
    })
})

await suite("main (shutdown function)", () => {
    const clearIntervalMock = mock.fn(() => {
        steps.push("stopMonitoring")
    })

    beforeEach(() => {
        clearIntervalMock.mock.resetCalls()
        mock.method(globalThis, "setInterval", () => ({ unref: () => {} }))
        mock.method(globalThis, "clearInterval", clearIntervalMock)
    })

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        test(`on ${signal}: stops monitoring, runs the shutdown function, flushes, then re-raises`, async () => {
            const shutdown = mock.fn(async (_context: ShutdownContext) => {
                steps.push("shutdown:start")
                await new Promise(setImmediate)
                steps.push("shutdown:end")
            })
            teardowns.push(
                main("test-app", logger, { shutdown, monitorMemoryHours: 1 }),
            )

            await handlerFor(onMock, signal)()
            assert.deepEqual(shutdown.mock.calls[0]?.arguments, [
                { reason: "signal", signal },
            ])
            assert.deepEqual(steps, [
                "stopMonitoring",
                "shutdown:start",
                "shutdown:end",
                "dispose",
                `kill:${signal}`,
            ])
        })
    }

    for (const [event, args, source] of [
        [
            "uncaughtException",
            [new Error("boom"), "uncaughtException"],
            "uncaughtException",
        ],
        ["unhandledRejection", ["reason"], "unhandledRejection"],
    ] as const) {
        test(`on ${event}: passes an error context and exits with status 1`, async () => {
            const shutdown = mock.fn((_context: ShutdownContext) => {
                steps.push("shutdown")
            })
            teardowns.push(main("test-app", logger, { shutdown }))

            await handlerFor(onMock, event)(...args)
            assert.deepEqual(shutdown.mock.calls[0]?.arguments, [
                { reason: "error", source, error: args[0] },
            ])
            assert.deepEqual(
                steps.filter((s) => !s.startsWith("error:")),
                ["shutdown", "dispose", "exit:1"],
            )
        })
    }

    test("on a launcher failure: passes an error context and exits with status 1", async () => {
        const error = new Error("startup failed")
        const shutdown = mock.fn((_context: ShutdownContext) => {
            steps.push("shutdown")
        })
        teardowns.push(
            main("test-app", logger, {
                launcher: () => Promise.reject(error),
                shutdown,
            }),
        )
        await settle()
        assert.deepEqual(shutdown.mock.calls[0]?.arguments, [
            { reason: "error", source: "launcher", error },
        ])
        assert.deepEqual(
            steps.filter((s) => !s.startsWith("error:")),
            ["shutdown", "dispose", "exit:1"],
        )
    })

    test("a rejecting shutdown function is logged, the logs are still flushed, and a signal exits with status 1", async () => {
        teardowns.push(
            main("test-app", logger, {
                shutdown: () => Promise.reject(new Error("close failed")),
            }),
        )

        await handlerFor(onMock, "SIGTERM")()
        assert.equal(steps.length, 3)
        assert.match(
            steps[0] ?? "",
            /^error:Shutdown function failed: .*close failed/,
        )
        assert.deepEqual(steps.slice(1), ["dispose", "exit:1"])
        assert.equal(killMock.mock.callCount(), 0)
    })

    test("a synchronously throwing shutdown function is handled like a rejection", async () => {
        teardowns.push(
            main("test-app", logger, {
                shutdown: () => {
                    throw new Error("sync close failed")
                },
            }),
        )

        await handlerFor(onMock, "SIGINT")()
        assert.match(steps[0] ?? "", /sync close failed/)
        assert.deepEqual(steps.slice(1), ["dispose", "exit:1"])
    })

    test("a failing shutdown function after a fatal error still exits with status 1", async () => {
        teardowns.push(
            main("test-app", logger, {
                shutdown: () => Promise.reject(new Error("close failed")),
            }),
        )

        await handlerFor(onMock, "unhandledRejection")(new Error("boom"))
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("gives up on a hanging shutdown function after shutdownTimeoutMs (10 s by default)", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        teardowns.push(
            main("test-app", logger, {
                shutdown: () => new Promise<void>(() => {}),
            }),
        )

        const pending = handlerFor(onMock, "SIGTERM")()
        mock.timers.tick(9_999)
        await new Promise(setImmediate)
        assert.deepEqual(steps, [])

        mock.timers.tick(1)
        await pending
        assert.deepEqual(steps, [
            "error:Shutdown function timed out after 10000 ms",
            "dispose",
            "exit:1",
        ])
    })

    test("honors a custom shutdownTimeoutMs", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        teardowns.push(
            main("test-app", logger, {
                shutdown: () => new Promise<void>(() => {}),
                shutdownTimeoutMs: 250,
            }),
        )

        const pending = handlerFor(onMock, "SIGTERM")()
        mock.timers.tick(249)
        await new Promise(setImmediate)
        assert.equal(exitMock.mock.callCount(), 0)

        mock.timers.tick(1)
        await pending
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("a synchronous shutdown function completes even with a zero shutdownTimeoutMs", async () => {
        const shutdown = mock.fn()
        teardowns.push(
            main("test-app", logger, { shutdown, shutdownTimeoutMs: 0 }),
        )

        await handlerFor(onMock, "SIGTERM")()
        assert.equal(shutdown.mock.callCount(), 1)
        assert.deepEqual(steps, ["dispose", "kill:SIGTERM"])
    })

    test("runs the shutdown function only once; a second event exits immediately", async () => {
        const { promise, resolve } = Promise.withResolvers<void>()
        const shutdown = mock.fn(() => promise)
        teardowns.push(main("test-app", logger, { shutdown }))

        const first = handlerFor(onMock, "SIGTERM")()
        await new Promise(setImmediate)
        await handlerFor(onMock, "SIGINT")()
        await handlerFor(onMock, "uncaughtException")(
            new Error("late"),
            "origin",
        )
        assert.equal(shutdown.mock.callCount(), 1)
        assert.deepEqual(
            steps.filter((s) => !s.startsWith("error:")),
            ["kill:SIGINT", "exit:1"],
        )

        resolve()
        await first
        assert.equal(shutdown.mock.callCount(), 1)
        assert.equal(disposeMock.mock.callCount(), 1)
    })

    test("a shutdown function rejecting after its timeout causes no unhandled rejection", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        const { promise, reject } = Promise.withResolvers<void>()
        const unhandled = mock.fn()
        const realOn = process.on.bind(process)
        teardowns.push(
            main("test-app", logger, {
                shutdown: () => promise,
                shutdownTimeoutMs: 100,
            }),
        )
        mock.restoreAll()
        realOn("unhandledRejection", unhandled)
        mock.method(process, "exit", exitMock)
        mock.method(process, "kill", killMock)
        try {
            const pending = handlerFor(onMock, "SIGTERM")()
            mock.timers.tick(100)
            await pending
            reject(new Error("too late"))
            await settle()
            assert.equal(unhandled.mock.callCount(), 0)
        } finally {
            process.off("unhandledRejection", unhandled)
        }
    })

    // Log flushing ownership

    test("a custom flushLogs replaces LogTape's dispose", async () => {
        const flushLogs = mock.fn(() => {
            steps.push("customFlush")
        })
        teardowns.push(main("test-app", logger, { flushLogs }))

        await handlerFor(onMock, "SIGTERM")()
        assert.equal(disposeMock.mock.callCount(), 0)
        assert.deepEqual(steps, ["customFlush", "kill:SIGTERM"])
    })

    test("passing noop as flushLogs skips flushing", async () => {
        teardowns.push(main("test-app", logger, { flushLogs: () => {} }))

        await handlerFor(onMock, "unhandledRejection")(new Error("boom"))
        assert.equal(disposeMock.mock.callCount(), 0)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("a failing custom flushLogs is ignored", async () => {
        teardowns.push(
            main("test-app", logger, {
                flushLogs: () => {
                    throw new Error("flush failed")
                },
            }),
        )

        await handlerFor(onMock, "SIGINT")()
        assert.deepEqual(steps, ["kill:SIGINT"])
    })

    test("a hanging custom flushLogs is bounded by flushTimeoutMs", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        teardowns.push(
            main("test-app", logger, {
                flushLogs: () => new Promise<void>(() => {}),
                flushTimeoutMs: 50,
            }),
        )

        const pending = handlerFor(onMock, "SIGINT")()
        mock.timers.tick(49)
        await new Promise(setImmediate)
        assert.equal(killMock.mock.callCount(), 0)
        mock.timers.tick(1)
        await pending
        assert.equal(killMock.mock.callCount(), 1)
    })

    test("the teardown does not run the shutdown function", () => {
        const shutdown = mock.fn()
        main("test-app", logger, { shutdown })()
        assert.equal(shutdown.mock.callCount(), 0)
        assert.equal(exitMock.mock.callCount(), 0)
    })

    // Validation

    for (const shutdownTimeoutMs of [
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        2_147_483_648,
    ]) {
        test(`rejects shutdownTimeoutMs=${shutdownTimeoutMs} before registering anything`, () => {
            assert.throws(
                () => main("test-app", logger, { shutdownTimeoutMs }),
                /RangeError: main: "shutdownTimeoutMs"/,
            )
            assert.equal(onMock.mock.callCount(), 0)
            teardowns.push(main("test-app", logger))
        })
    }

    for (const option of ["launcher", "shutdown", "flushLogs"] as const) {
        for (const value of [null, 42, "fn"]) {
            test(`rejects a non-function ${option} (${JSON.stringify(value)}) before registering anything`, () => {
                assert.throws(
                    () =>
                        main("test-app", logger, {
                            [option]: value,
                        } as unknown as MainOptions),
                    new RegExp(
                        `TypeError: main: "${option}" must be a function`,
                    ),
                )
                assert.equal(onMock.mock.callCount(), 0)
                teardowns.push(main("test-app", logger))
            })
        }
    }
})
