import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"
import { main } from "../main.ts"

await suite("main", () => {
    const logMock = mock.fn()
    const onMock = mock.fn()
    const onceMock = mock.fn()
    const exitMock = mock.fn()

    const childLogger = { info: logMock, error: logMock } as unknown as Logger
    const logger = { getChild: () => childLogger } as unknown as Logger

    beforeEach(() => {
        logMock.mock.resetCalls()
        onMock.mock.resetCalls()
        onceMock.mock.resetCalls()
        exitMock.mock.resetCalls()
        mock.method(process, "on", onMock)
        mock.method(process, "once", onceMock)
        mock.method(process, "exit", exitMock)
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

    test("should invoke the launcher function when provided with explicit defaultInterruptionHandler", () => {
        const launcher = mock.fn()
        main("test-app", logger, true, launcher)
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
})
