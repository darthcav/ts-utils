/**
 * A collection of utility functions for TypeScript applications and modules.
 *
 * @packageDocumentation
 */

import { getConsoleLogger } from "./loggers/getConsoleLogger.ts"
import { getDummyLogger } from "./loggers/getDummyLogger.ts"
import { type LauncherFunction, type MainOptions, main } from "./main.ts"
import { millisecondsToString } from "./millisecondsToString.ts"
import { monitorMemory } from "./monitorMemory.ts"
import { noop } from "./noop.ts"
import { type OsRelease, osRelease } from "./osRelease.ts"
import type { Assert } from "./type-testing/Assert.ts"
import type { Equal } from "./type-testing/Equal.ts"
import type { Extends } from "./type-testing/Extends.ts"
import type { IsAny } from "./type-testing/IsAny.ts"
import type { IsNever } from "./type-testing/IsNever.ts"
import type { IsUnknown } from "./type-testing/IsUnknown.ts"
import type { Not } from "./type-testing/Not.ts"
import {
    asRuntimeObject,
    asString,
    isRuntimeObject,
    isString,
    type RuntimeObject,
    toRuntimeObjectArray,
} from "./types.ts"

export {
    type Assert,
    asRuntimeObject,
    asString,
    type Equal,
    type Extends,
    getConsoleLogger,
    getDummyLogger,
    type IsAny,
    type IsNever,
    type IsUnknown,
    isRuntimeObject,
    isString,
    type LauncherFunction,
    type MainOptions,
    main,
    millisecondsToString,
    monitorMemory,
    type Not,
    noop,
    type OsRelease,
    osRelease,
    type RuntimeObject,
    toRuntimeObjectArray,
}
