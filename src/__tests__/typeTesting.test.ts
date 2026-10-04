// biome-ignore-all lint/suspicious/noExplicitAny: the helpers must be tested against `any`
import assert from "node:assert/strict"
import { suite, test } from "node:test"
import type {
    Assert,
    Equal,
    Extends,
    IsAny,
    IsNever,
    IsUnknown,
    Not,
} from "../index.ts"
import * as api from "../index.ts"

// Assert accepts only `true`
type _AssertTrue = Assert<true>
// @ts-expect-error -- `false` does not satisfy the constraint
type _AssertFalse = Assert<false>
// @ts-expect-error -- an undecided `boolean` does not satisfy the constraint
type _AssertBoolean = Assert<boolean>
type _AssertIsTrue = Assert<Equal<Assert<true>, true>>

// Equal: identical types
type _EqualPrimitive = Assert<Equal<string, string>>
type _EqualObject = Assert<
    Equal<{ a: string; b?: number }, { a: string; b?: number }>
>
type _EqualUnionOrder = Assert<Equal<"a" | "b", "b" | "a">>
type _EqualFunction = Assert<
    Equal<(x: number) => string, (y: number) => string>
>
type _EqualAny = Assert<Equal<any, any>>
type _EqualNever = Assert<Equal<never, never>>
type _EqualUnknown = Assert<Equal<unknown, unknown>>

// Equal: different types
type _NotEqualPrimitive = Assert<Not<Equal<string, number>>>
type _NotEqualLiteral = Assert<Not<Equal<"a", string>>>
type _NotEqualUnion = Assert<Not<Equal<string, string | undefined>>>
type _NotEqualAnyLeft = Assert<Not<Equal<any, string>>>
type _NotEqualAnyRight = Assert<Not<Equal<string, any>>>
type _NotEqualAnyUnknown = Assert<Not<Equal<any, unknown>>>
type _NotEqualNever = Assert<Not<Equal<never, string>>>
type _NotEqualReadonly = Assert<
    Not<Equal<{ readonly a: string }, { a: string }>>
>
type _NotEqualOptional = Assert<Not<Equal<{ a?: string }, { a: string }>>>
type _NotEqualIntersection = Assert<
    Not<Equal<{ a: 1 } & { b: 2 }, { a: 1; b: 2 }>>
>
// @ts-expect-error -- `string` is not `number`
type _EqualFails = Assert<Equal<string, number>>

// Extends
type _ExtendsLiteral = Assert<Extends<"a", string>>
type _ExtendsSame = Assert<Extends<string, string>>
type _ExtendsObject = Assert<Extends<{ a: string; b: number }, { a: string }>>
type _ExtendsAny = Assert<Extends<any, string>>
type _ExtendsNever = Assert<Extends<never, string>>
type _NotExtendsWider = Assert<Not<Extends<string, "a">>>
type _NotExtendsUnion = Assert<Not<Extends<string | number, string>>>
type _ExtendsIsBoolean = Assert<Equal<Extends<string | number, string>, false>>

// Not
type _NotTrue = Assert<Equal<Not<true>, false>>
type _NotFalse = Assert<Equal<Not<false>, true>>
type _NotBoolean = Assert<Equal<Not<boolean>, boolean>>

// IsAny
type _IsAnyAny = Assert<IsAny<any>>
type _IsAnyUnknown = Assert<Not<IsAny<unknown>>>
type _IsAnyNever = Assert<Not<IsAny<never>>>
type _IsAnyString = Assert<Not<IsAny<string>>>
type _IsAnyJsonParse = Assert<IsAny<ReturnType<typeof JSON.parse>>>

// IsNever
type _IsNeverNever = Assert<IsNever<never>>
type _IsNeverExhausted = Assert<IsNever<Exclude<"a" | "b", string>>>
type _IsNeverAny = Assert<Not<IsNever<any>>>
type _IsNeverUnknown = Assert<Not<IsNever<unknown>>>
type _IsNeverUndefined = Assert<Not<IsNever<undefined>>>

// IsUnknown
type _IsUnknownUnknown = Assert<IsUnknown<unknown>>
type _IsUnknownAny = Assert<Not<IsUnknown<any>>>
type _IsUnknownNever = Assert<Not<IsUnknown<never>>>
type _IsUnknownObject = Assert<Not<IsUnknown<object>>>
type _IsUnknownUnion = Assert<Not<IsUnknown<string | undefined>>>

await suite("type-testing", () => {
    test("helpers are type-only and have no runtime exports", () => {
        for (const name of [
            "Assert",
            "Equal",
            "Extends",
            "IsAny",
            "IsNever",
            "IsUnknown",
            "Not",
        ]) {
            assert.ok(!(name in api), name)
        }
    })

    test("assertions can be declared inside test bodies", () => {
        const value: unknown = JSON.parse('{"a":1}')
        type _Value = Assert<IsUnknown<typeof value>>
        assert.deepEqual(value, { a: 1 })
    })
})
