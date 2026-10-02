import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"
import type { Assert, Equal } from "asserttt"
import { type LauncherFunction, type MainOptions, main } from "../main.ts"

type _LauncherFunctionShape = Assert<
    Equal<LauncherFunction, () => void | Promise<void>>
>
type _MainReturnType = Assert<Equal<ReturnType<typeof main>, () => void>>
type _MainOptionsShape = Assert<
    Equal<
        MainOptions,
        {
            launcher?: LauncherFunction
            monitorMemoryHours?: number
            defaultInterruptionHandler?: boolean
            flushTimeoutMs?: number
        }
    >
>

await suite("main", () => {
    const logMock = mock.fn()
    const onMock = mock.fn()
    const onceMock = mock.fn()
    const exitMock = mock.fn()
    const setIntervalMock = mock.fn((_fn: () => void, _delay: number) => ({
        unref: () => {},
    }))
    const killMock = mock.fn()
    const offMock = mock.fn()
    let otherSignalListeners = 0
    const listenerCountMock = mock.fn(() => otherSignalListeners)
    // Forwards to `logMock` so existing assertions see every message, while
    // letting tests check which messages were logged at `info` level.
    const infoMock = mock.fn((...args: unknown[]) => logMock(...args))

    const debugMock = mock.fn()
    const childLogger: Logger = {
        info: infoMock,
        error: logMock,
        debug: debugMock,
        getChild: () => childLogger,
    } as unknown as Logger
    const logger = { getChild: () => childLogger } as unknown as Logger

    // Log calls use logtape's tagged-template form, so a mocked call receives
    // the template-string parts as `arguments[0]` and the interpolated values
    // as the remaining arguments. Reconstruct the rendered message for
    // assertions.
    const render = (call: { arguments: readonly unknown[] }): string => {
        const [template, ...values] = call.arguments
        if (Array.isArray(template)) {
            return template.reduce(
                (acc: string, part: string, i: number) =>
                    acc + part + (i < values.length ? String(values[i]) : ""),
                "",
            )
        }
        return String(template)
    }

    beforeEach(() => {
        logMock.mock.resetCalls()
        debugMock.mock.resetCalls()
        onMock.mock.resetCalls()
        onceMock.mock.resetCalls()
        exitMock.mock.resetCalls()
        setIntervalMock.mock.resetCalls()
        killMock.mock.resetCalls()
        offMock.mock.resetCalls()
        listenerCountMock.mock.resetCalls()
        infoMock.mock.resetCalls()
        otherSignalListeners = 0
        mock.method(process, "on", onMock)
        mock.method(process, "off", offMock)
        mock.method(process, "kill", killMock)
        mock.method(process, "listenerCount", listenerCountMock)
        mock.method(process, "once", onceMock)
        mock.method(process, "exit", exitMock)
        mock.method(globalThis, "setInterval", setIntervalMock)
    })

    // Teardown functions returned by main(), run after each test so the next
    // test can call main() again.
    const teardowns: (() => void)[] = []

    /** Lets the asynchronous log flush and exit path run. */
    const settle = async (): Promise<void> => {
        for (let i = 0; i < 10; i++) {
            await new Promise(setImmediate)
        }
    }

    afterEach(() => {
        for (const teardown of teardowns.splice(0)) {
            teardown()
        }
        mock.restoreAll()
    })

    test("should log startup information", () => {
        teardowns.push(main("test-app", logger))

        const messages = logMock.mock.calls.map(render)
        assert.ok(messages.some((m) => /Main process launched/.test(m)))
        assert.ok(messages.some((m) => /Process name:/.test(m)))
        assert.ok(messages.some((m) => /Node\.js environment:/.test(m)))
    })

    test("should log process options at debug level only", () => {
        const savedOptions = process.env["NODE_OPTIONS"]
        process.env["NODE_OPTIONS"] = "--inspect=0.0.0.0:9229"
        try {
            teardowns.push(main("test-app", logger))
            const infoMessages = logMock.mock.calls.map(render)
            assert.ok(
                !infoMessages.some((m) => /process options|--inspect/.test(m)),
            )
            const debugMessages = debugMock.mock.calls.map(render)
            assert.ok(
                debugMessages.some((m) =>
                    /Node\.js process options:.*--inspect=0\.0\.0\.0:9229/.test(
                        m,
                    ),
                ),
            )
        } finally {
            if (savedOptions === undefined) {
                delete process.env["NODE_OPTIONS"]
            } else {
                process.env["NODE_OPTIONS"] = savedOptions
            }
        }
    })

    test("should use empty fallbacks when NODE_ENV and NODE_OPTIONS are not set", () => {
        const savedEnv = process.env["NODE_ENV"]
        const savedOptions = process.env["NODE_OPTIONS"]
        delete process.env["NODE_ENV"]
        delete process.env["NODE_OPTIONS"]
        try {
            teardowns.push(main("test-app", logger))
            const messages = logMock.mock.calls.map(render)
            assert.ok(messages.some((m) => /Node\.js environment: $/.test(m)))
            const debugMessages = debugMock.mock.calls.map(render)
            assert.ok(
                debugMessages.some((m) => /Node\.js process options:/.test(m)),
            )
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
        teardowns.push(main("test-app", logger))

        const sigintCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGINT",
        )
        assert.ok(sigintCall, "SIGINT handler not registered")
    })

    test("should register SIGTERM handler", () => {
        teardowns.push(main("test-app", logger))

        const sigtermCall = onMock.mock.calls.find(
            (c) => c.arguments[0] === "SIGTERM",
        )
        assert.ok(sigtermCall, "SIGTERM handler not registered")
    })

    test("should not register SIGINT or SIGTERM handlers when defaultInterruptionHandler is false", () => {
        teardowns.push(main("test-app", logger, false))

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
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call, "uncaughtException handler not registered")
    })

    test("should register unhandledRejection handler", () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call, "unhandledRejection handler not registered")
    })

    const signalHandler = (signal: "SIGINT" | "SIGTERM") => {
        const call = onMock.mock.calls.find((c) => c.arguments[0] === signal)
        assert.ok(call, `${signal} handler not registered`)
        return call.arguments[1] as () => Promise<void>
    }

    for (const [signal, status] of [
        ["SIGINT", 130],
        ["SIGTERM", 143],
    ] as const) {
        test(`should log ${signal} at info level and re-raise it`, async () => {
            teardowns.push(main("test-app", logger))
            const handler = signalHandler(signal)
            await handler()

            assert.ok(
                infoMock.mock.calls.some((c) =>
                    new RegExp(`Received signal: ${signal}`).test(render(c)),
                ),
            )
            assert.deepEqual(offMock.mock.calls[0]?.arguments, [
                signal,
                handler,
            ])
            assert.equal(killMock.mock.callCount(), 1)
            assert.deepEqual(killMock.mock.calls[0]?.arguments, [
                process.pid,
                signal,
            ])
            assert.equal(exitMock.mock.callCount(), 0)
        })

        test(`should exit with status ${status} on ${signal} when other listeners exist`, async () => {
            otherSignalListeners = 1
            teardowns.push(main("test-app", logger))
            await signalHandler(signal)()

            assert.equal(killMock.mock.callCount(), 0)
            assert.equal(exitMock.mock.callCount(), 1)
            assert.equal(exitMock.mock.calls[0]?.arguments[0], status)
        })
    }

    test("should exit on uncaughtException with an Error and log its stack", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("test error")
        await handler(error, "unhandledException")

        assert.ok(
            logMock.mock.calls.some(
                (c) =>
                    /Uncaught exception:/.test(render(c)) &&
                    render(c).includes(error.stack ?? error.message),
            ),
        )
        assert.ok(
            logMock.mock.calls.some((c) => /Exception origin:/.test(render(c))),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("logs errors via a tagged template so brace characters are preserved verbatim", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error('Unexpected token in JSON: {"key":"value"}')
        await handler(error, "uncaughtException")

        // logtape parses '{...}' in a plain string argument as a placeholder and
        // replaces it with null. The tagged-template form passes the message
        // parts as an array and the interpolated value separately, so brace
        // content survives. Assert both: the call uses the array (template)
        // shape, and the braces are carried by the interpolated value.
        const errorCall = logMock.mock.calls.find(
            (c) =>
                Array.isArray(c.arguments[0]) &&
                /Uncaught exception:/.test(String(c.arguments[0][0])),
        )
        assert.ok(
            errorCall,
            "error should be logged via a tagged template, not a pre-interpolated string",
        )
        assert.ok(
            errorCall.arguments
                .slice(1)
                .some((v) => String(v).includes('{"key":"value"}')),
            "brace content must be preserved in the interpolated value",
        )
    })

    test("should exit on uncaughtException with an Error and no stack", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("test error")
        delete error.stack
        await handler(error, "unhandledException")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Uncaught exception: Error: test error/.test(render(c)),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on uncaughtException with a non-Error value", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "uncaughtException",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        await handler("something went wrong", "unhandledException")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Uncaught exception: something went wrong/.test(render(c)),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should invoke the launcher function when provided", () => {
        const launcher = mock.fn()
        teardowns.push(main("test-app", logger, launcher))
        assert.equal(launcher.mock.callCount(), 1)
        assert.equal(launcher.mock.calls[0]?.arguments.length, 0)
    })

    test("should exit on unhandledRejection with an Error reason and no stack", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("rejection error")
        delete error.stack
        await handler(error)

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Unhandled promise rejection\. Reason:[\s\S]*Error: rejection error/.test(
                    render(c),
                ),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on unhandledRejection with a non-Error reason", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        await handler("some reason")

        assert.ok(
            logMock.mock.calls.some((c) =>
                /Unhandled promise rejection\. Reason:/.test(render(c)),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("should exit on unhandledRejection with an Error reason and log its stack", async () => {
        teardowns.push(main("test-app", logger))

        const call = onMock.mock.calls.find(
            (c) => c.arguments[0] === "unhandledRejection",
        )
        assert.ok(call)
        const handler = call.arguments[1]
        const error = new Error("rejection error")
        await handler(error)

        assert.ok(
            logMock.mock.calls.some(
                (c) =>
                    /Unhandled promise rejection\. Reason:/.test(render(c)) &&
                    render(c).includes(error.stack ?? error.message),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    // Deprecated positional forms: monitorMemoryHours combinations

    test("should not start memory monitoring when monitorMemoryHours is 0 (default)", () => {
        teardowns.push(main("test-app", logger))
        assert.equal(setIntervalMock.mock.callCount(), 0)
    })

    test("should start memory monitoring with only monitorMemoryHours", () => {
        teardowns.push(main("test-app", logger, 2))
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            2 * 60 * 60 * 1_000,
        )
    })

    test("should start memory monitoring with launcher and monitorMemoryHours", () => {
        teardowns.push(main("test-app", logger, mock.fn(), 2))
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            2 * 60 * 60 * 1_000,
        )
    })

    test("should start memory monitoring with monitorMemoryHours and defaultInterruptionHandler", () => {
        teardowns.push(main("test-app", logger, 3, false))
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
        teardowns.push(main("test-app", logger, launcher, 4, true))
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            4 * 60 * 60 * 1_000,
        )
        assert.equal(launcher.mock.callCount(), 1)
    })

    // Deprecated positional forms: defaultInterruptionHandler combinations

    test("should disable interruption handler with only defaultInterruptionHandler=false", () => {
        teardowns.push(main("test-app", logger, false))
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
        teardowns.push(main("test-app", logger, launcher, false))
        assert.equal(
            onMock.mock.calls.find((c) => c.arguments[0] === "SIGINT"),
            undefined,
        )
        assert.equal(launcher.mock.callCount(), 1)
    })

    // Options object

    test("accepts an options object", () => {
        const launcher = mock.fn()
        teardowns.push(
            main("test-app", logger, {
                launcher,
                monitorMemoryHours: 2,
                defaultInterruptionHandler: false,
            }),
        )
        assert.equal(launcher.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            2 * 60 * 60 * 1_000,
        )
        const events = onMock.mock.calls.map((c) => c.arguments[0])
        assert.deepEqual(events, ["uncaughtException", "unhandledRejection"])
    })

    test("applies the defaults for an empty options object", () => {
        teardowns.push(main("test-app", logger, {}))
        assert.equal(setIntervalMock.mock.callCount(), 0)
        const events = onMock.mock.calls.map((c) => c.arguments[0])
        assert.deepEqual(events, [
            "SIGINT",
            "SIGTERM",
            "uncaughtException",
            "unhandledRejection",
        ])
    })

    test("the options object and the deprecated positional form behave alike", () => {
        const launcher = mock.fn()
        const positional = main("test-app", logger, launcher, 3, false)
        const positionalEvents = onMock.mock.calls.map((c) => c.arguments[0])
        const positionalDelay = setIntervalMock.mock.calls[0]?.arguments[1]
        positional()
        onMock.mock.resetCalls()
        setIntervalMock.mock.resetCalls()

        teardowns.push(
            main("test-app", logger, {
                launcher,
                monitorMemoryHours: 3,
                defaultInterruptionHandler: false,
            }),
        )
        assert.deepEqual(
            onMock.mock.calls.map((c) => c.arguments[0]),
            positionalEvents,
        )
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            positionalDelay,
        )
        assert.equal(launcher.mock.callCount(), 2)
    })

    for (const flushTimeoutMs of [
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        2_147_483_648,
    ]) {
        test(`rejects flushTimeoutMs=${flushTimeoutMs} before registering anything`, () => {
            assert.throws(
                () => main("test-app", logger, { flushTimeoutMs }),
                RangeError,
            )
            assert.equal(onMock.mock.callCount(), 0)
            assert.equal(logMock.mock.callCount(), 0)
            // Not left active: a valid call still works.
            teardowns.push(main("test-app", logger))
        })
    }

    test("rejects invalid monitorMemoryHours before registering any handler", () => {
        assert.throws(
            () => main("test-app", logger, { monitorMemoryHours: 1_000 }),
            RangeError,
        )
        assert.equal(onMock.mock.callCount(), 0)
        teardowns.push(main("test-app", logger))
    })

    // Lifecycle

    test("throws when called again while a previous call is active", () => {
        teardowns.push(main("test-app", logger))
        const registered = onMock.mock.callCount()
        assert.throws(() => main("test-app", logger), /already active/)
        assert.equal(onMock.mock.callCount(), registered)
    })

    test("can be called again after the teardown", () => {
        const teardown = main("test-app", logger)
        teardown()
        teardowns.push(main("test-app", logger))
    })

    test("the teardown removes every registered handler and stops monitoring", () => {
        const clearIntervalMock = mock.method(
            globalThis,
            "clearInterval",
            () => {},
        )
        const teardown = main("test-app", logger, { monitorMemoryHours: 1 })
        const registered = onMock.mock.calls.map((c) => c.arguments)
        assert.equal(registered.length, 4)

        teardown()
        const removed = offMock.mock.calls.map((c) => c.arguments)
        assert.deepEqual(removed, registered)
        assert.equal(clearIntervalMock.mock.callCount(), 1)
        assert.equal(
            clearIntervalMock.mock.calls[0]?.arguments[0],
            setIntervalMock.mock.calls[0]?.result,
        )
    })

    test("calling the teardown more than once is harmless", () => {
        const teardown = main("test-app", logger)
        teardown()
        const removed = offMock.mock.callCount()
        teardown()
        assert.equal(offMock.mock.callCount(), removed)
        // A second teardown must not deactivate a newer main() call.
        teardowns.push(main("test-app", logger))
        teardown()
        assert.throws(() => main("test-app", logger), /already active/)
    })

    test("the teardown does not exit the process", () => {
        main("test-app", logger)()
        assert.equal(exitMock.mock.callCount(), 0)
        assert.equal(killMock.mock.callCount(), 0)
    })

    // Launchers

    test("runs an async launcher without waiting or exiting", async () => {
        const { promise, resolve } = Promise.withResolvers<void>()
        const launcher = mock.fn(() => promise)
        teardowns.push(main("test-app", logger, { launcher }))
        assert.equal(launcher.mock.callCount(), 1)
        resolve()
        await settle()
        assert.equal(exitMock.mock.callCount(), 0)
    })

    test("logs a rejected async launcher and exits with status 1", async () => {
        const error = new Error("startup failed")
        teardowns.push(
            main("test-app", logger, {
                launcher: () => Promise.reject(error),
            }),
        )
        await settle()
        assert.ok(
            logMock.mock.calls.some(
                (c) =>
                    /Launcher failed:/.test(render(c)) &&
                    render(c).includes(error.stack ?? error.message),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })

    test("logs a throwing launcher and exits with status 1 instead of throwing", async () => {
        let teardown: (() => void) | undefined
        assert.doesNotThrow(() => {
            teardown = main("test-app", logger, {
                launcher: () => {
                    throw new Error("sync failure")
                },
            })
        })
        assert.ok(teardown)
        teardowns.push(teardown)
        await settle()
        assert.ok(
            logMock.mock.calls.some((c) =>
                /Launcher failed: Error: sync failure/.test(render(c)),
            ),
        )
        assert.equal(exitMock.mock.callCount(), 1)
        assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
    })
})
