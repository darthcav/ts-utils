import assert from "node:assert/strict"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"
import monitorMemory from "../monitorMemory.ts"

await suite("monitorMemory", () => {
    const logMock = mock.fn()
    const logger = { info: logMock } as unknown as Logger

    let setIntervalMock: ReturnType<typeof mock.method>

    beforeEach(() => {
        logMock.mock.resetCalls()
        setIntervalMock = mock.method(globalThis, "setInterval", (fn: () => void, _delay: number) => {
            fn()
            return 0
        })
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
        const [uptimeMsg, memoryMsg] = logMock.mock.calls.map((c) => c.arguments[0] as string)
        assert.match(uptimeMsg, /Process uptime:/)
        assert.match(memoryMsg, /Process memory/)
    })
})
