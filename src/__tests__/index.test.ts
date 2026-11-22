import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { suite, test } from "node:test"
import { fileURLToPath } from "node:url"
import * as core from "../core/index.ts"
import * as api from "../index.ts"
import * as loggers from "../loggers/index.ts"
import * as node from "../node/index.ts"
import type { Assert } from "../type-testing/Assert.ts"
import type { Equal } from "../type-testing/Equal.ts"
import * as typeTesting from "../type-testing/index.ts"

// Type-only exports are erased at runtime, so they are pinned at type level.
type _RootRuntimeObject = Assert<Equal<api.RuntimeObject, core.RuntimeObject>>
type _RootTypeGuard = Assert<
    Equal<api.TypeGuard<string>, core.TypeGuard<string>>
>
type _RootMainOptions = Assert<Equal<api.MainOptions, node.MainOptions>>
type _RootLauncher = Assert<Equal<api.LauncherFunction, node.LauncherFunction>>
type _RootShutdownContext = Assert<
    Equal<api.ShutdownContext, node.ShutdownContext>
>
type _RootShutdownFunction = Assert<
    Equal<api.ShutdownFunction, node.ShutdownFunction>
>
type _RootOsRelease = Assert<Equal<api.OsRelease, node.OsRelease>>
type _RootAssert = Assert<Equal<api.Assert<true>, typeTesting.Assert<true>>>
type _RootEqual = Assert<Equal<api.Equal<1, 1>, typeTesting.Equal<1, 1>>>
type _RootExtends = Assert<
    Equal<api.Extends<1, number>, typeTesting.Extends<1, number>>
>
type _RootNot = Assert<Equal<api.Not<false>, typeTesting.Not<false>>>
type _RootIsAny = Assert<Equal<api.IsAny<1>, typeTesting.IsAny<1>>>
type _RootIsNever = Assert<Equal<api.IsNever<1>, typeTesting.IsNever<1>>>
type _RootIsUnknown = Assert<Equal<api.IsUnknown<1>, typeTesting.IsUnknown<1>>>

/** Sorted runtime export names of a module namespace. */
const keysOf = (namespace: object): string[] => Object.keys(namespace).sort()

const CORE_EXPORTS = [
    "asArrayOf",
    "asBoolean",
    "asFiniteNumber",
    "asRuntimeObject",
    "asString",
    "filterByGuard",
    "isArrayOf",
    "isBoolean",
    "isFiniteNumber",
    "isRuntimeObject",
    "isString",
    "millisecondsToString",
    "noop",
    "toRuntimeObjectArray",
]
const NODE_EXPORTS = ["main", "monitorMemory", "osRelease"]
const LOGGERS_EXPORTS = ["getConsoleLogger", "getDummyLogger"]

await suite("public API", () => {
    for (const [name, namespace, expected] of [
        ["core", core, CORE_EXPORTS],
        ["node", node, NODE_EXPORTS],
        ["loggers", loggers, LOGGERS_EXPORTS],
        ["type-testing", typeTesting, []],
        ["root", api, [...CORE_EXPORTS, ...NODE_EXPORTS, ...LOGGERS_EXPORTS]],
    ] as const) {
        test(`the ${name} entry point exports exactly the documented runtime values`, () => {
            assert.deepEqual(keysOf(namespace), [...expected].sort())
        })

        test(`the ${name} entry point has no default export`, () => {
            assert.ok(!("default" in namespace))
        })

        test(`every runtime export of the ${name} entry point is a function`, () => {
            for (const [key, value] of Object.entries(namespace)) {
                assert.equal(typeof value, "function", key)
            }
        })
    }

    test("the root entry point re-exports the subpath values themselves", () => {
        const root = new Map(Object.entries(api))
        for (const namespace of [core, node, loggers]) {
            for (const [key, value] of Object.entries(namespace)) {
                assert.equal(root.get(key), value, key)
            }
        }
    })
})

await suite("portable core entry point", () => {
    const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

    /** Matches value (non-type) static imports and re-exports. */
    const VALUE_IMPORT =
        /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm

    /** Collects the runtime import graph of a source module. */
    const runtimeImports = (
        file: string,
        seen = new Set<string>(),
    ): Set<string> => {
        for (const [, specifier = ""] of readFileSync(file, "utf-8").matchAll(
            VALUE_IMPORT,
        )) {
            if (specifier.startsWith(".")) {
                const target = resolve(dirname(file), specifier)
                if (!seen.has(target)) {
                    seen.add(target)
                    runtimeImports(target, seen)
                }
            } else {
                seen.add(specifier)
            }
        }
        return seen
    }

    test("the import scan finds bare specifiers (sanity check)", () => {
        const graph = runtimeImports(resolve(srcDir, "node/index.ts"))
        assert.ok(graph.has("node:process"))
        assert.ok(graph.has("@logtape/logtape"))
    })

    test("imports no Node.js built-ins or packages at runtime", () => {
        const external = [
            ...runtimeImports(resolve(srcDir, "core/index.ts")),
        ].filter((specifier) => !specifier.startsWith(srcDir))
        assert.deepEqual(external, [])
    })
})
