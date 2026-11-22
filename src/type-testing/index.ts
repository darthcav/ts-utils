/**
 * Type-level testing helpers. They are types only and add no code at runtime.
 *
 * @example
 * ```ts
 * import type { Assert, Equal } from "@darthcav/ts-utils/type-testing"
 * ```
 *
 * @module type-testing
 */

export type { Assert } from "./Assert.ts"
export type { Equal } from "./Equal.ts"
export type { Extends } from "./Extends.ts"
export type { IsAny } from "./IsAny.ts"
export type { IsNever } from "./IsNever.ts"
export type { IsUnknown } from "./IsUnknown.ts"
export type { Not } from "./Not.ts"
