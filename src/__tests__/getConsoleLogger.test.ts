import assert from "node:assert/strict"
import { suite, test } from "node:test"
import getConsoleLogger from "../loggers/getConsoleLogger.ts"

await suite("getConsoleLogger", () => {
    test("returns a logger for the given category", async () => {
        const logger = await getConsoleLogger("test-app")
        assert.ok(logger)
        assert.equal(typeof logger.info, "function")
    })

    test("can be called more than once without throwing", async () => {
        // logtape's configure() throws if logging is already configured;
        // getConsoleLogger passes reset:true so repeated calls reconfigure
        // cleanly instead of rejecting.
        const first = await getConsoleLogger("app-a")
        const second = await getConsoleLogger("app-b", "debug")
        assert.ok(first)
        assert.ok(second)
    })
})
