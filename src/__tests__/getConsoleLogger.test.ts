import assert from "node:assert/strict"
import process from "node:process"
import { afterEach, beforeEach, mock, suite, test } from "node:test"
import { getConsoleLogger } from "../loggers/getConsoleLogger.ts"

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

await suite("getConsoleLogger (ANSI colors)", () => {
    const ESC = "\x1b["
    type Terminal = { isTTY: boolean; hasColors: boolean }
    const streams = [process.stdout, process.stderr] as const
    const saved = streams.map((stream) => ({
        isTTY: Object.getOwnPropertyDescriptor(stream, "isTTY"),
        hasColors: Object.getOwnPropertyDescriptor(stream, "hasColors"),
    }))
    let savedForceColor: string | undefined

    /** Makes stdout and stderr look like (non-)color terminals. */
    const setTerminals = (stdout: Terminal, stderr: Terminal = stdout) => {
        for (const [stream, terminal] of [
            [process.stdout, stdout],
            [process.stderr, stderr],
        ] as const) {
            Object.defineProperty(stream, "isTTY", {
                value: terminal.isTTY,
                configurable: true,
            })
            Object.defineProperty(stream, "hasColors", {
                value: () => terminal.hasColors,
                configurable: true,
            })
        }
    }

    /** Logs one info and one error record and returns everything printed. */
    const capture = async (): Promise<string> => {
        const logger = await getConsoleLogger("colors-app")
        const printed: unknown[] = []
        const record = (...args: unknown[]) => {
            printed.push(...args)
        }
        mock.method(console, "info", record)
        mock.method(console, "error", record)
        logger.info`info message`
        logger.error`error message`
        mock.restoreAll()
        return printed.join("\n")
    }

    beforeEach(() => {
        savedForceColor = process.env["FORCE_COLOR"]
        delete process.env["FORCE_COLOR"]
    })

    afterEach(() => {
        mock.restoreAll()
        streams.forEach((stream, i) => {
            for (const key of ["isTTY", "hasColors"] as const) {
                const descriptor = saved[i]?.[key]
                if (descriptor) {
                    Object.defineProperty(stream, key, descriptor)
                } else {
                    delete (stream as unknown as Record<string, unknown>)[key]
                }
            }
        })
        if (savedForceColor === undefined) {
            delete process.env["FORCE_COLOR"]
        } else {
            process.env["FORCE_COLOR"] = savedForceColor
        }
    })

    test("uses colors when stdout and stderr are color terminals", async () => {
        setTerminals({ isTTY: true, hasColors: true })
        const output = await capture()
        assert.ok(output.includes(ESC))
        assert.match(output, /info message/)
    })

    test("prints plain text when output is not a terminal", async () => {
        setTerminals({ isTTY: false, hasColors: false })
        const output = await capture()
        assert.ok(!output.includes(ESC))
        assert.match(output, /INFO.*info message/)
        assert.match(output, /ERROR.*error message/)
    })

    test("prints plain text when only stdout is a terminal", async () => {
        setTerminals(
            { isTTY: true, hasColors: true },
            { isTTY: false, hasColors: false },
        )
        assert.ok(!(await capture()).includes(ESC))
    })

    test("prints plain text when the terminal has no color support (e.g. NO_COLOR)", async () => {
        setTerminals({ isTTY: true, hasColors: false })
        assert.ok(!(await capture()).includes(ESC))
    })

    for (const value of ["1", "true", ""]) {
        test(`FORCE_COLOR=${JSON.stringify(value)} enables colors without a terminal`, async () => {
            setTerminals({ isTTY: false, hasColors: false })
            process.env["FORCE_COLOR"] = value
            assert.ok((await capture()).includes(ESC))
        })
    }

    for (const value of ["0", "false"]) {
        test(`FORCE_COLOR=${value} disables colors on a color terminal`, async () => {
            setTerminals({ isTTY: true, hasColors: true })
            process.env["FORCE_COLOR"] = value
            assert.ok(!(await capture()).includes(ESC))
        })
    }
})
