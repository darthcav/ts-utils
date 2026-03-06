import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import main from "../index.ts"

describe("main", () => {
    const errorMock = mock.fn()
    const onMock = mock.fn()
    const exitMock = mock.fn()

    beforeEach(() => {
        errorMock.mock.resetCalls()
        onMock.mock.resetCalls()
        exitMock.mock.resetCalls()
        mock.method(console, "error", errorMock)
        mock.method(process, "on", onMock)
        mock.method(process, "exit", exitMock)
    })

    afterEach(() => {
        mock.restoreAll()
    })

    it("should log startup information", () => {
        main()

        const messages = errorMock.mock.calls.map((c) => c.arguments[0])
        assert.ok(messages.some((m) => /Main process launched/.test(m)))
        assert.ok(messages.some((m) => /Process name:/.test(m)))
        assert.ok(messages.some((m) => /Node\.js environment:/.test(m)))
        assert.ok(messages.some((m) => /Node\.js process options:/.test(m)))
    })

    it("should use empty fallbacks when NODE_ENV and NODE_OPTIONS are not set", () => {
        const savedEnv = process.env["NODE_ENV"]
        const savedOptions = process.env["NODE_OPTIONS"]
        delete process.env["NODE_ENV"]
        delete process.env["NODE_OPTIONS"]
        try {
            main()
            const messages = errorMock.mock.calls.map((c) => c.arguments[0])
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

    it("should register SIGINT handler", () => {
        main()

        const sigintCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGINT",
        )
        assert.ok(sigintCall, "SIGINT handler not registered")
    })

    it("should register SIGTERM handler", () => {
        main()

        const sigtermCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGTERM",
        )
        assert.ok(sigtermCall, "SIGTERM handler not registered")
    })

    it("should register uncaughtException handler", () => {
        main()

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call, "uncaughtException handler not registered")
    })

    it("should register unhandledRejection handler", () => {
        main()

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call, "unhandledRejection handler not registered")
    })

    it("should exit on SIGINT", () => {
        main()

        const sigintCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGINT",
        )
        assert.ok(sigintCall)
        const handler = sigintCall.arguments[1]
        handler("SIGINT")

        assert.ok(
            errorMock.mock.calls.some((c) =>
                /Received signal: SIGINT/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 0)
    })

    it("should exit on SIGTERM", () => {
        main()

        const sigtermCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGTERM",
        )
        assert.ok(sigtermCall)
        const handler = sigtermCall.arguments[1]
        handler("SIGTERM")

        assert.ok(
            errorMock.mock.calls.some((c) =>
                /Received signal: SIGTERM/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 0)
    })

    it("should exit on uncaughtException", () => {
        main()

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        handler(new Error("test error"), "unhandledException")

        assert.ok(
            errorMock.mock.calls.some((c) =>
                /Uncaught exception:/.test(c.arguments[0]),
            ),
        )
        assert.ok(
            errorMock.mock.calls.some((c) =>
                /Exception origin:/.test(c.arguments[0]),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    it("should exit on unhandledRejection", () => {
        main()

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        handler("some reason", Promise.resolve())

        assert.ok(
            errorMock.mock.calls.some((c) =>
                /Unhandled promise rejection/.test(c.arguments[0]),
            ),
        )
        assert.ok(
            errorMock.mock.calls.some((c) => /Reason:/.test(c.arguments[0])),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })
})
