import assert from "node:assert/strict"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"
import monitorMemory from "../monitorMemory.ts"

await suite("monitorMemory", () => {
    const logMock = mock.fn()
    const childLogger = { info: logMock } as unknown as Logger
    const getChildMock = mock.fn(
        (_subcategory: string | readonly string[]) => childLogger,
    )
    const logger = { getChild: getChildMock } as unknown as Logger

    let setIntervalMock: ReturnType<typeof mock.method>

    beforeEach(() => {
        logMock.mock.resetCalls()
        getChildMock.mock.resetCalls()
        setIntervalMock = mock.method(
            globalThis,
            "setInterval",
            (fn: () => void, _delay: number) => {
                fn()
                return 0
            },
        )
    })

    afterEach(() => {
        mock.restoreAll()
    })

    test("defaults to 24-hour interval", () => {
        monitorMemory(logger)
        const delay = setIntervalMock.mock.calls[0]?.arguments[1]
        assert.equal(delay, 24 * 60 * 60 * 1_000)
    })

    test("uses the provided hours parameter", () => {
        monitorMemory(logger, 1)
        const delay = setIntervalMock.mock.calls[0]?.arguments[1]
        assert.equal(delay, 1 * 60 * 60 * 1_000)
    })

    test("logs uptime and memory info on each tick", () => {
        monitorMemory(logger)
        assert.equal(logMock.mock.calls.length, 2)
        const messages = logMock.mock.calls.map((c) => String(c.arguments[0]))
        assert.match(messages[0] ?? "", /Process uptime:/)
        assert.match(messages[1] ?? "", /Process memory/)
    })

    test("logs through a 'monitorMemory' child of the given logger", () => {
        monitorMemory(logger)
        assert.equal(getChildMock.mock.calls.length, 1)
        assert.deepEqual(getChildMock.mock.calls[0]?.arguments[0], [
            "monitorMemory",
        ])
    })

    test("throws a RangeError on non-positive or non-finite hours", () => {
        for (const hours of [
            0,
            -1,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
        ]) {
            assert.throws(() => monitorMemory(logger, hours), RangeError)
        }
        assert.equal(setIntervalMock.mock.calls.length, 0)
    })

    test("throws a RangeError when the interval exceeds setInterval's maximum", () => {
        // Node.js would silently clamp these delays to 1 ms.
        for (const hours of [597, 1_000, Number.MAX_VALUE]) {
            assert.throws(() => monitorMemory(logger, hours), RangeError)
        }
        assert.equal(setIntervalMock.mock.calls.length, 0)
    })

    test("throws a RangeError when the interval is shorter than one minute", () => {
        for (const hours of [1e-7, 0.5 / 60, Number.MIN_VALUE]) {
            assert.throws(() => monitorMemory(logger, hours), RangeError)
        }
        assert.equal(setIntervalMock.mock.calls.length, 0)
    })

    test("accepts the boundary intervals", () => {
        monitorMemory(logger, 1 / 60)
        monitorMemory(logger, 2_147_483_647 / 3_600_000)
        const delays = setIntervalMock.mock.calls.map((c) => c.arguments[1])
        assert.equal(delays.length, 2)
        assert.ok(Math.abs((delays[0] as number) - 60_000) < 1e-6)
        assert.ok((delays[1] as number) <= 2_147_483_647)
    })
})
