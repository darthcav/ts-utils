/**
 * A collection of utility functions for TypeScript applications and modules.
 *
 * @packageDocumentation
 */

import {
    asRuntimeObject,
    asString,
    isRuntimeObject,
    isString,
    type RuntimeObject,
    toRuntimeObjectArray,
} from "./core/guards.ts"
import { millisecondsToString } from "./core/millisecondsToString.ts"
import { noop } from "./core/noop.ts"
import { getConsoleLogger } from "./loggers/getConsoleLogger.ts"
import { getDummyLogger } from "./loggers/getDummyLogger.ts"
import { type LauncherFunction, type MainOptions, main } from "./node/main.ts"
import { monitorMemory } from "./node/monitorMemory.ts"
import { type OsRelease, osRelease } from "./node/osRelease.ts"
import type { Assert } from "./type-testing/Assert.ts"
import type { Equal } from "./type-testing/Equal.ts"
import type { Extends } from "./type-testing/Extends.ts"
import type { IsAny } from "./type-testing/IsAny.ts"
import type { IsNever } from "./type-testing/IsNever.ts"
import type { IsUnknown } from "./type-testing/IsUnknown.ts"
import type { Not } from "./type-testing/Not.ts"

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
