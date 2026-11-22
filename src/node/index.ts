/**
 * Node.js process utilities: application bootstrap and shutdown (`main`),
 * memory monitoring, and OS release information.
 *
 * @example
 * ```ts
 * import { main, osRelease } from "@darthcav/ts-utils/node"
 * ```
 *
 * @module node
 */

export {
    type LauncherFunction,
    type MainOptions,
    main,
    type ShutdownContext,
    type ShutdownFunction,
} from "./main.ts"
export { monitorMemory } from "./monitorMemory.ts"
export { type OsRelease, osRelease } from "./osRelease.ts"
