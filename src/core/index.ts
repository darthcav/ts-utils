/**
 * Portable helpers: type guards and narrowing helpers, duration formatting,
 * and `noop`. They import no Node.js built-ins or packages, so they run in any
 * ES2025 runtime (`millisecondsToString` needs `Intl.DurationFormat`).
 *
 * @example
 * ```ts
 * import { asString, millisecondsToString } from "@darthcav/ts-utils/core"
 * ```
 *
 * @module core
 */

export {
    asRuntimeObject,
    asString,
    isRuntimeObject,
    isString,
    type RuntimeObject,
    toRuntimeObjectArray,
} from "./guards.ts"
export { millisecondsToString } from "./millisecondsToString.ts"
export { noop } from "./noop.ts"
