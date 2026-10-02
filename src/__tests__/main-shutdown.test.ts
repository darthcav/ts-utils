import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"

/** Controls what the mocked logtape `dispose()` does in each test. */
let disposeImpl: () => Promise<void> = () => Promise.resolve()
const disposeMock = mock.fn(() => disposeImpl())

mock.module("@logtape/logtape", {
    namedExports: { dispose: disposeMock },
})

const { main } = await import("../main.ts")

await suite("main (log flushing on shutdown)", () => {
    const noop = (): void => {}
    const childLogger = {
        info: noop,
        error: noop,
        debug: noop,
        getChild: () => childLogger,
    } as unknown as Logger
    const logger = { getChild: () => childLogger } as unknown as Logger

    const onMock = mock.fn()
    const exitMock = mock.fn()
    const killMock = mock.fn()

    const handlerFor = (event: string) => {
        const call = onMock.mock.calls.find((c) => c.arguments[0] === event)
        assert.ok(call, `${event} handler not registered`)
        return call.arguments[1] as (...args: unknown[]) => Promise<void>
    }

    beforeEach(() => {
        disposeImpl = () => Promise.resolve()
        disposeMock.mock.resetCalls()
        onMock.mock.resetCalls()
        exitMock.mock.resetCalls()
        killMock.mock.resetCalls()
        mock.method(process, "on", onMock)
        mock.method(process, "off", noop)
        mock.method(process, "exit", exitMock)
        mock.method(process, "kill", killMock)
        mock.method(process, "listenerCount", () => 0)
    })

    afterEach(() => {
        mock.timers.reset()
        mock.restoreAll()
    })

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
            main("test-app", logger)

            const pending = handlerFor(event)(...args)
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
        main("test-app", logger)

        await handlerFor("uncaughtException")(new Error("boom"), "origin")
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("gives up on a hanging flush after 3 seconds", async () => {
        mock.timers.enable({ apis: ["setTimeout"] })
        disposeImpl = () => new Promise<void>(() => {})
        main("test-app", logger)

        const pending = handlerFor("unhandledRejection")(new Error("boom"))
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
        main("test-app", logger)

        const first = handlerFor("SIGTERM")()
        await handlerFor("SIGINT")()
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
})
