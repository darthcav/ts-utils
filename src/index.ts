/**
 * A collection of utility functions for TypeScript applications and modules.
 *
 * @packageDocumentation
 */

import getConsoleLogger from "./loggers/getConsoleLogger.ts"
import getDummyLogger from "./loggers/getDummyLogger.ts"
import { type LauncherFunction, main } from "./main.ts"
import millisecondsToString from "./millisecondsToString.ts"
import monitorMemory from "./monitorMemory.ts"
import noop from "./noop.ts"
import { linuxRelease, type OsRelease, windowsRelease } from "./os-utils.ts"
import type { RuntimeObject } from "./types.ts"

export {
    getConsoleLogger,
    getDummyLogger,
    type LauncherFunction,
    linuxRelease,
    main,
    millisecondsToString,
    monitorMemory,
    noop,
    type OsRelease,
    type RuntimeObject,
    windowsRelease,
}
