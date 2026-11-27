import assert from "node:assert/strict"

/**
 * Rebuilds the message of a tagged-template logger call from its arguments:
 * the template parts come first and the interpolated values follow.
 */
export function renderLog([template, ...values]: readonly unknown[]): string {
    assert.ok(Array.isArray(template), "not a tagged-template call")
    return String.raw({ raw: template }, ...values)
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
