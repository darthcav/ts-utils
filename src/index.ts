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
import {
    type LinuxRelease,
    linuxRelease,
    type WindowsRelease,
    windowsRelease,
} from "./os-utils.ts"

export {
    getConsoleLogger,
    getDummyLogger,
    type LauncherFunction,
    type LinuxRelease,
    linuxRelease,
    main,
    millisecondsToString,
    monitorMemory,
    noop,
    type WindowsRelease,
    windowsRelease,
}
