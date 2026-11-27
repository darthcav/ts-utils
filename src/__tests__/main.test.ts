import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import { runInNewContext } from "node:vm"
import { getDummyLogger } from "../loggers/getDummyLogger.ts"
import {
    type LauncherFunction,
    type MainOptions,
    main,
    type ShutdownContext,
    type ShutdownFunction,
} from "../node/main.ts"
import type { Assert } from "../type-testing/Assert.ts"
import type { Equal } from "../type-testing/Equal.ts"
import { handlerFor, renderLog, settle } from "./helpers.ts"

type _LauncherFunctionShape = Assert<
    Equal<LauncherFunction, () => void | Promise<void>>
>
type _ShutdownFunctionShape = Assert<
    Equal<ShutdownFunction, (context: ShutdownContext) => void | Promise<void>>
>
type _ShutdownContextShape = Assert<
    Equal<
        ShutdownContext,
        | { readonly reason: "signal"; readonly signal: "SIGINT" | "SIGTERM" }
        | {
              readonly reason: "error"
              readonly source:
                  | "uncaughtException"
                  | "unhandledRejection"
                  | "launcher"
              readonly error: unknown
          }
    >
>
type _MainReturnType = Assert<Equal<ReturnType<typeof main>, () => void>>
type _MainOptionsShape = Assert<
    Equal<
        MainOptions,
        {
            launcher?: LauncherFunction
            shutdown?: ShutdownFunction
            shutdownTimeoutMs?: number
            monitorMemoryHours?: number
            defaultInterruptionHandler?: boolean
            flushLogs?: () => void | Promise<void>
            flushTimeoutMs?: number
        }
    >
>

await suite("main", () => {
    const logMock = mock.fn()
    const onMock = mock.fn()
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

    // `getChild` returns the same dummy logger, so the spies installed on it
    // also see the calls main() makes through its "main" child logger.
    const logger = getDummyLogger()

    const render = (call: { arguments: readonly unknown[] }): string =>
        renderLog(call.arguments)

    beforeEach(() => {
        for (const fn of [
            logMock,
            infoMock,
            debugMock,
            onMock,
            exitMock,
            setIntervalMock,
            killMock,
            offMock,
            listenerCountMock,
        ]) {
            fn.mock.resetCalls()
        }
        otherSignalListeners = 0
        mock.method(logger, "info", infoMock)
        mock.method(logger, "error", logMock)
        mock.method(logger, "debug", debugMock)
        mock.method(process, "on", onMock)
        mock.method(process, "off", offMock)
        mock.method(process, "kill", killMock)
        mock.method(process, "listenerCount", listenerCountMock)
        mock.method(process, "exit", exitMock)
        mock.method(globalThis, "setInterval", setIntervalMock)
    })

    // Teardown functions returned by main(), run after each test so the next
    // test can call main() again.
    const teardowns: (() => void)[] = []

    afterEach(() => {
        for (const teardown of teardowns.splice(0)) {
            teardown()
        }
        mock.restoreAll()
    })

    /** Asserts that main() logged nothing, at any level. */
    const assertNothingLogged = (): void => {
        assert.equal(logMock.mock.callCount(), 0)
        assert.equal(debugMock.mock.callCount(), 0)
    }

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

    const ALL_EVENTS = [
        "SIGINT",
        "SIGTERM",
        "uncaughtException",
        "unhandledRejection",
    ]
    for (const [label, options, expected] of [
        ["no options", undefined, ALL_EVENTS],
        ["an empty options object", {}, ALL_EVENTS],
        [
            "defaultInterruptionHandler: false",
            { defaultInterruptionHandler: false },
            ["uncaughtException", "unhandledRejection"],
        ],
    ] as const) {
        test(`registers exactly the expected handlers with ${label}`, () => {
            teardowns.push(main("test-app", logger, options))
            assert.deepEqual(
                onMock.mock.calls.map((c) => c.arguments[0]),
                expected,
            )
        })
    }

    for (const [signal, status] of [
        ["SIGINT", 130],
        ["SIGTERM", 143],
    ] as const) {
        test(`should log ${signal} at info level and re-raise it`, async () => {
            teardowns.push(main("test-app", logger))
            const handler = handlerFor(onMock, signal)
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
            await handlerFor(onMock, signal)()

            assert.equal(killMock.mock.callCount(), 0)
            assert.equal(exitMock.mock.callCount(), 1)
            assert.equal(exitMock.mock.calls[0]?.arguments[0], status)
        })
    }

    // Fatal failures

    /** The stack of an error, which the test requires to exist. */
    const stackOf = (value: unknown): string => {
        assert.ok(Error.isError(value) && value.stack !== undefined)
        return value.stack
    }

    /** An error whose stack was removed. */
    const stacklessError = (): Error => {
        const error = new Error("boom")
        delete error.stack
        return error
    }

    const FAILURE_VALUES: readonly (readonly [
        label: string,
        make: () => unknown,
        rendered: (value: unknown) => string,
    ])[] = [
        ["an Error, with its stack", () => new Error("boom"), stackOf],
        ["an Error without a stack", stacklessError, () => "Error: boom"],
        ["a non-Error value", () => "something went wrong", String],
        [
            "an Error from another realm, with its stack",
            () => runInNewContext('new Error("boom")'),
            stackOf,
        ],
    ]

    for (const [event, prefix, argsFor] of [
        [
            "uncaughtException",
            "Uncaught exception: ",
            (value: unknown) => [value, "uncaughtException"],
        ],
        [
            "unhandledRejection",
            "Unhandled promise rejection. Reason:\n",
            (value: unknown) => [value],
        ],
    ] as const) {
        for (const [label, make, rendered] of FAILURE_VALUES) {
            test(`on ${event}, logs ${label} and exits with status 1`, async () => {
                const value = make()
                teardowns.push(main("test-app", logger))
                await handlerFor(onMock, event)(...argsFor(value))

                const messages = logMock.mock.calls.map(render)
                assert.ok(
                    messages.includes(prefix + rendered(value)),
                    `logged: ${JSON.stringify(messages)}`,
                )
                if (event === "uncaughtException") {
                    assert.ok(
                        messages.includes(
                            "Exception origin: uncaughtException",
                        ),
                    )
                }
                assert.equal(exitMock.mock.callCount(), 1)
                assert.equal(exitMock.mock.calls[0]?.arguments[0], 1)
            })
        }
    }

    test("logs errors via a tagged template so brace characters are preserved verbatim", async () => {
        teardowns.push(main("test-app", logger))

        const error = new Error('Unexpected token in JSON: {"key":"value"}')
        await handlerFor(onMock, "uncaughtException")(
            error,
            "uncaughtException",
        )

        // logtape would replace '{...}' in a plain string with null; the
        // tagged-template form keeps the braces in the interpolated value.
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

    test("should invoke the launcher function when provided", () => {
        const launcher = mock.fn()
        teardowns.push(main("test-app", logger, { launcher }))
        assert.equal(launcher.mock.callCount(), 1)
        assert.equal(launcher.mock.calls[0]?.arguments.length, 0)
    })

    // Memory monitoring

    test("should not start memory monitoring when monitorMemoryHours is 0 (default)", () => {
        teardowns.push(main("test-app", logger))
        assert.equal(setIntervalMock.mock.callCount(), 0)
    })

    test("should start memory monitoring every monitorMemoryHours hours", () => {
        teardowns.push(main("test-app", logger, { monitorMemoryHours: 2 }))
        assert.equal(setIntervalMock.mock.callCount(), 1)
        assert.equal(
            setIntervalMock.mock.calls[0]?.arguments[1],
            2 * 60 * 60 * 1_000,
        )
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
    })

    test("applies the defaults for an empty options object", () => {
        teardowns.push(main("test-app", logger, {}))
        assert.equal(setIntervalMock.mock.callCount(), 0)
    })

    // Untyped callers still using the positional forms removed in 0.11.0.
    for (const [label, legacy] of [
        ["a launcher function", () => {}],
        ["a monitorMemoryHours number", 2],
        ["a defaultInterruptionHandler boolean", false],
        ["null", null],
    ] as const) {
        test(`rejects ${label} instead of an options object`, () => {
            assert.throws(
                () =>
                    main("test-app", logger, legacy as unknown as MainOptions),
                TypeError,
            )
            assert.equal(onMock.mock.callCount(), 0)
            assertNothingLogged()
            teardowns.push(main("test-app", logger))
        })
    }

    for (const flushTimeoutMs of [
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        2_147_483_648,
    ]) {
        test(`rejects flushTimeoutMs=${flushTimeoutMs} before logging or registering anything`, () => {
            assert.throws(
                () => main("test-app", logger, { flushTimeoutMs }),
                RangeError,
            )
            assert.equal(onMock.mock.callCount(), 0)
            assertNothingLogged()
            // Not left active: a valid call still works.
            teardowns.push(main("test-app", logger))
        })
    }

    for (const monitorMemoryHours of [
        1_000,
        0.01,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ]) {
        test(`rejects monitorMemoryHours=${monitorMemoryHours} before logging or registering anything`, () => {
            assert.throws(
                () => main("test-app", logger, { monitorMemoryHours }),
                {
                    name: "RangeError",
                    message: new RegExp(
                        `^main: "monitorMemoryHours" must be 0 \\(disabled\\) or a finite number between .+, received ${monitorMemoryHours}$`,
                    ),
                },
            )
            assert.equal(onMock.mock.callCount(), 0)
            assert.equal(setIntervalMock.mock.callCount(), 0)
            assertNothingLogged()
            teardowns.push(main("test-app", logger))
        })
    }

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
