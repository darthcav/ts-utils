import assert from "node:assert/strict"

/**
 * Rebuilds the message of a tagged-template logger call from its arguments:
 * the template parts come first and the interpolated values follow.
 */
export function renderLog([template, ...values]: readonly unknown[]): string {
    assert.ok(Array.isArray(template), "not a tagged-template call")
    return String.raw({ raw: template }, ...values)
}

/**
 * Returns the handler that a mocked `process.on` registered for `event`;
 * fails the test when there is none.
 */
export function handlerFor(
    on: { mock: { calls: readonly { arguments: readonly unknown[] }[] } },
    event: string,
): (...args: unknown[]) => Promise<void> {
    const call = on.mock.calls.find((c) => c.arguments[0] === event)
    assert.ok(call, `${event} handler not registered`)
    return call.arguments[1] as (...args: unknown[]) => Promise<void>
}

/** Lets pending promise chains (e.g. the shutdown sequence) run. */
export async function settle(turns = 10): Promise<void> {
    for (let i = 0; i < turns; i++) {
        await new Promise(setImmediate)
    }
}

/** Mocked file system: path → content, or an error code to throw. */
export type MockedFiles = Record<string, string | { code: string }>

/**
 * Builds a `readFileSync` replacement that serves `getFiles()`; a missing
 * path throws `ENOENT`.
 */
export function fakeReadFileSync(
    getFiles: () => MockedFiles,
): (path: string) => string {
    return (path) => {
        const entry = getFiles()[path]
        if (typeof entry === "string") {
            return entry
        }
        const code = entry?.code ?? "ENOENT"
        throw Object.assign(new Error(`${code}: ${path}`), { code })
    }
}
