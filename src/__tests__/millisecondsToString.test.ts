import assert from "node:assert/strict"
import { suite, test } from "node:test"
import millisecondsToString from "../millisecondsToString.ts"

await suite("millisecondsToString", () => {
    test("seconds only", () => {
        assert.equal(millisecondsToString(5_000), "5s")
    })

    test("zero milliseconds", () => {
        assert.equal(millisecondsToString(0), "")
    })

    test("sub-second values are rounded to nearest second", () => {
        assert.equal(millisecondsToString(499), "")
        assert.equal(millisecondsToString(500), "1s")
        assert.equal(millisecondsToString(1_499), "1s")
        assert.equal(millisecondsToString(1_500), "2s")
    })

    test("minutes and seconds", () => {
        assert.equal(millisecondsToString(90_000), "1m 30s")
    })

    test("hours, minutes, and seconds", () => {
        assert.equal(millisecondsToString(3_661_000), "1h 1m 1s")
    })

    test("days, hours, minutes, and seconds", () => {
        assert.equal(millisecondsToString(90_061_000), "1d 1h 1m 1s")
    })

    test("zero-valued components are omitted", () => {
        assert.equal(millisecondsToString(3_600_000), "1h")
        assert.equal(millisecondsToString(86_400_000), "1d")
    })

    test("uses the provided German locale", () => {
        assert.equal(
            millisecondsToString(90_061_000, "de"),
            "1 T, 1h, 1 Min. und 1 Sek.",
        )
    })

    test("uses the provided Spanish locale", () => {
        assert.equal(millisecondsToString(90_061_000, "es"), "1d 1h 1min 1s")
    })
})
