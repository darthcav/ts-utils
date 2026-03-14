/**
 * A collection of utility functions for TypeScript applications and modules.
 *
 * @packageDocumentation
 */

import getConsoleLogger from "./loggers/getConsoleLogger.ts"
import getDummyLogger from "./loggers/getDummyLogger.ts"
import { type LauncherFunction, main } from "./main.ts"

export { getConsoleLogger, getDummyLogger, type LauncherFunction, main }
