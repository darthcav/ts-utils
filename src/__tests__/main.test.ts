import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"
import type { Assert, Equal } from "asserttt"
import { type LauncherFunction, main } from "../main.ts"

type _LauncherFunctionShape = Assert<Equal<LauncherFunction, () => void>>
type _MainReturnType = Assert<Equal<ReturnType<typeof main>, void>>

await suite("main", () => {
    const logMock = mock.fn()
    const onMock = mock.fn()
    const onceMock = mock.fn()
    const exitMock = mock.fn()
    const setIntervalMock = mock.fn()

    const childLogger = { info: logMock, error: logMock } as unknown as Logger
    const logger = { getChild: () => childLogger } as unknown as Logger

    beforeEach(() => {
        logMock.mock.resetCalls()
        onMock.mock.resetCalls()
        onceMock.mock.resetCalls()
        exitMock.mock.resetCalls()
        setIntervalMock.mock.resetCalls()
        mock.method(process, "on", onMock)
        mock.method(process, "once", onceMock)
        mock.method(process, "exit", exitMock)
        mock.method(globalThis, "setInterval", setIntervalMock)
    })

    afterEach(() => {
        mock.restoreAll()
    })

    test("should log startup information", () => {
        main("test-app", logger)

        const messages = logMock.mock.calls.map((c) => c.arguments[0])
        assert.ok(messages.some((m) => /Main process launched/.test(m)))
        assert.ok(messages.some((m) => /Process name:/.test(m)))
        assert.ok(messages.some((m) => /Node\.js environment:/.test(m)))
        assert.ok(messages.some((m) => /Node\.js process options:/.test(m)))
    })

    test("should use empty fallbacks when NODE_ENV and NODE_OPTIONS are not set", () => {
        const savedEnv = process.env["NODE_ENV"]
        const savedOptions = process.env["NODE_OPTIONS"]
        delete process.env["NODE_ENV"]
        delete process.env["NODE_OPTIONS"]
        try {
            main("test-app", logger)
            const messages = logMock.mock.calls.map((c) => c.arguments[0])
            assert.ok(messages.some((m) => /Node\.js environment: $/.test(m)))
            assert.ok(messages.some((m) => /Node\.js process options:/.test(m)))
        } finally {
            if (savedEnv !== undefined) {
                process.env["NODE_ENV"] = savedEnv
            }
            if (savedOptions !== undefined) {
                process.env["NODE_OPTIONS"] = savedOptions
            }
        }
    })

    test("should register SIGINT handler", () => {
        main("test-app", logger)

        const sigintCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGINT",
        )
        assert.ok(sigintCall, "SIGINT handler not registered")
    })

    test("should register SIGTERM handler", () => {
        main("test-app", logger)

        const sigtermCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGTERM",
        )
        assert.ok(sigtermCall, "SIGTERM handler not registered")
    })

    test("should not register SIGINT or SIGTERM handlers when defaultInterruptionHandler is false", () => {
        main("test-app", logger, false)

        const sigintCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGINT",
        )
        const sigtermCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGTERM",
        )
        assert.equal(
            sigintCall,
            undefined,
            "SIGINT handler should not be registered",
        )
        assert.equal(
            sigtermCall,
            undefined,
            "SIGTERM handler should not be registered",
        )
    })

    test("should register uncaughtException handler", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call, "uncaughtException handler not registered")
    })

    test("should register unhandledRejection handler", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call, "unhandledRejection handler not registered")
    })

    test("should exit on SIGINT", () => {
        main("test-app", logger)

        const sigintCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGINT",
        )
        assert.ok(sigintCall)
        const handler = sigintCall.arguments[1]
        handler("SIGINT")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Received signal: SIGINT/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 0)
    })

    test("should exit on SIGTERM", () => {
        main("test-app", logger)

        const sigtermCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGTERM",
        )
        assert.ok(sigtermCall)
        const handler = sigtermCall.arguments[1]
        handler("SIGTERM")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Received signal: SIGTERM/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 0)
    })

    test("should exit on uncaughtException with an Error and log its stack", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("test error")
        handler(error, "unhandledException")

        assert.ok(
            logMock.mock.calls.some(
                (c) =>
                    /Uncaught exception:/.test(c.arguments[0]) &&
                    c.arguments[0].includes(error.stack ?? error.message),
            ),
        )
        assert.ok(
            logMock.mock.calls.some((c) =>
                /Exception origin:/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on uncaughtException with an Error and no stack", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("test error")
        delete error.stack
        handler(error, "unhandledException")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Uncaught exception: Error: test error/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on uncaughtException with a non-Error value", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        handler("something went wrong", "unhandledException")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Uncaught exception: something went wrong/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should invoke the launcher function when provided", () => {
        const launcher = mock.fn()
        main("test-app", logger, launcher)
        assert.equal(launcher.mock.callCount(), 1)
        assert.equal(launcher.mock.calls[0]?.arguments.length, 0)
    })

    test("should exit on unhandledRejection with an Error reason and no stack", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("rejection error")
        delete error.stack
        handler(error)

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Unhandled promise rejection\. Reason:[\s\S]*Error: rejection error/.test(
                    c.arguments[0],
                ),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on unhandledRejection with a non-Error reason", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        handler("some reason")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Unhandled promise rejection\. Reason:/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on unhandledRejection with an Error reason and log its stack", () => {
        main("test-app", logger)

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("rejection error")
        handler(error)

        assert.ok(
            logMock.mock.calls.some(
                (c) =>
                    /Unhandled promise rejection\. Reason:/.test(
                        c.arguments[0],
                    ) && c.arguments[0].includes(error.stack ?? error.message),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    // monitorMemoryHours overload combinations

    test("should not start memory monitoring when monitorMemoryHours is 0 (default)", () => {
        main("test-app", logger)
        assert.equal(setIntervalMock.mock.callCount(), 0)
    })

    test("should start memory monitoring with only monitorMemoryHours", () => {
        main("test-app", logger, 2)
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            2 * 60 * 60 * 1_000,
        )
    })

    test("should start memory monitoring with launcher and monitorMemoryHours", () => {
        main("test-app", logger, mock.fn(), 2)
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            2 * 60 * 60 * 1_000,
        )
    })

    test("should start memory monitoring with monitorMemoryHours and defaultInterruptionHandler", () => {
        main("test-app", logger, 3, false)
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            3 * 60 * 60 * 1_000,
        )
        assert.equal(
            onMock.mock.calls.find((c) => c.arguments[0] === "SIGINT"),
            undefined,
        )
    })

    test("should start memory monitoring with all three optional parameters", () => {
        const launcher = mock.fn()
        main("test-app", logger, launcher, 4, true)
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            4 * 60 * 60 * 1_000,
        )
        assert.equal(launcher.mock.callCount(), 1)
    })

    // defaultInterruptionHandler overload combinations

    test("should disable interruption handler with only defaultInterruptionHandler=false", () => {
        main("test-app", logger, false)
        assert.equal(
            onMock.mock.calls.find((c) => c.arguments[0] === "SIGINT"),
            undefined,
        )
        assert.equal(
            onMock.mock.calls.find((c) => c.arguments[0] === "SIGTERM"),
            undefined,
        )
    })

    test("should disable interruption handler with launcher and defaultInterruptionHandler=false", () => {
        const launcher = mock.fn()
        main("test-app", logger, launcher, false)
        assert.equal(
            onMock.mock.calls.find((c) => c.arguments[0] === "SIGINT"),
            undefined,
        )
        assert.equal(launcher.mock.callCount(), 1)
    })
})
