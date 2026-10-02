import assert from "node:assert/strict"
import { suite, test } from "node:test"
import type { Logger } from "@logtape/logtape"
import type { Assert, Equal } from "asserttt"
import getDummyLogger from "../loggers/getDummyLogger.ts"

type _ReturnsLoggerSynchronously = Assert<
    Equal<ReturnType<typeof getDummyLogger>, Logger>
>

await suite("getDummyLogger", () => {
    test("returns a logger synchronously", () => {
        const logger = getDummyLogger()
        assert.ok(!(logger instanceof Promise))
        assert.deepEqual(logger.category, [])
        assert.equal(logger.parent, null)
    })

    test("accepts every logging-method overload without throwing", async () => {
        const logger = getDummyLogger()
        const error = new Error("boom")
        for (const method of [
            "trace",
            "debug",
            "info",
            "warn",
            "warning",
            "error",
            "fatal",
        ] as const) {
            logger[method]`tagged ${1} template`
            logger[method]("message {value}", { value: 1 })
            logger[method]("lazy", () => ({ value: 1 }))
            logger[method]({ value: 1 })
            logger[method]((l) => l`callback`)
            await logger[method]("async lazy", async () => ({ value: 1 }))
        }
        logger.error(error)
        logger.error("message", error)
        logger.warn(error, { value: 1 })
        logger.emit({
            level: "info",
            message: ["emitted"],
            rawMessage: "emitted",
            timestamp: Date.now(),
            properties: {},
        })
    })

    test("async-properties overloads return a settled promise", async () => {
        const result = getDummyLogger().info("async", async () => ({}))
        assert.ok(result instanceof Promise)
        assert.equal(await result, undefined)
    })

    test("reports every level as disabled", () => {
        const logger = getDummyLogger()
        for (const level of [
            "trace",
            "debug",
            "info",
            "warning",
            "error",
            "fatal",
        ] as const) {
            assert.equal(logger.isEnabledFor(level), false)
        }
    })

    test("getChild and with return the same instance", () => {
        const logger = getDummyLogger()
        assert.equal(logger.getChild("child"), logger)
        assert.equal(logger.getChild(["a", "b"]), logger)
        assert.equal(logger.with({ requestId: 1 }), logger)
    })

    test("returns a new instance on every call", () => {
        assert.notEqual(getDummyLogger(), getDummyLogger())
    })
})
