import { isFiniteNumber } from "../core/guards.ts"

/**
 * Longest delay `setTimeout` and `setInterval` support (2³¹ − 1 ms, about
 * 596.5 hours). Node.js silently replaces larger delays with 1 ms.
 */
export const MAX_DELAY_MS = 2_147_483_647

/**
 * Whether `ms` is a finite timer delay between `minMs` and
 * {@link MAX_DELAY_MS}. Internal: not re-exported by the `node` entry point.
 */
export function isValidDelay(ms: unknown, minMs = 0): ms is number {
    return isFiniteNumber(ms) && ms >= minMs && ms <= MAX_DELAY_MS
}
