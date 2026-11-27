import assert from "node:assert/strict"
import { suite, test } from "node:test"
import { parseOsRelease, parsePlistStrings } from "../node/releaseParsers.ts"

/** Wraps `<key>`/value entries in a property list document. */
const plist = (entries: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n${entries}\n</dict>\n</plist>\n`

await suite("parseOsRelease", () => {
    test("skips comments, blank lines, and lines without '='", () => {
        assert.deepEqual(
            {
                ...parseOsRelease(
                    "# NAME=Commented\n\n   # ID=indented-comment\nGARBAGE\nNAME=Real\r\n",
                ),
            },
            { NAME: "Real" },
        )
    })

    test("unquotes double- and single-quoted values", () => {
        const raw = parseOsRelease(
            [
                'PRETTY_NAME="Ubuntu 24.04 LTS"',
                "ID_LIKE='debian'",
                'HOME_URL="https://example.com/a\\"b\\\\c\\$d\\`e"',
                "SINGLE='no \\escapes'",
                'UNBALANCED="open',
                "PLAIN=value",
            ].join("\n"),
        )
        assert.deepEqual(
            { ...raw },
            {
                PRETTY_NAME: "Ubuntu 24.04 LTS",
                ID_LIKE: "debian",
                HOME_URL: 'https://example.com/a"b\\c$d`e',
                SINGLE: "no \\escapes",
                UNBALANCED: '"open',
                PLAIN: "value",
            },
        )
    })

    test("skips keys that are not upper-case variable names", () => {
        const raw = parseOsRelease(
            [
                "__proto__=polluted",
                "constructor=polluted",
                "lower=skipped",
                "1ID=skipped",
                "BAD-KEY=skipped",
                "ID=ubuntu",
            ].join("\n"),
        )
        assert.equal(Object.getPrototypeOf(raw), null)
        assert.deepEqual(Object.keys(raw), ["ID"])
    })
})

await suite("parsePlistStrings", () => {
    test("returns the string entries", () => {
        const raw = parsePlistStrings(
            plist(`\t<key>ProductName</key>\n\t<string>macOS</string>
\t<key>ProductVersion</key>\n\t<string> 15.1 </string>`),
        )
        assert.equal(Object.getPrototypeOf(raw), null)
        assert.deepEqual(
            { ...raw },
            { ProductName: "macOS", ProductVersion: "15.1" },
        )
    })

    test("decodes XML character references in keys and values", () => {
        const raw = parsePlistStrings(
            plist(`<key>ProductCopyright</key>
<string>&#169; 1983&#x2013;2024 Apple &amp; Co &lt;Inc&gt; &quot;A&quot; &apos;B&apos; &bogus; &#x110000;</string>
<key>Product&#78;ame</key>
<string>macOS</string>`),
        )
        assert.deepEqual(
            { ...raw },
            {
                ProductCopyright: `© 1983–2024 Apple & Co <Inc> "A" 'B' &bogus; &#x110000;`,
                ProductName: "macOS",
            },
        )
    })

    test("skips non-string values and keys that are not identifiers", () => {
        const raw = parsePlistStrings(
            plist(`<key>ProductVersion</key>
<string>15.1</string>
<key>SomeFlag</key>
<true/>
<key>SomeNumber</key>
<integer>3</integer>
<key>__proto__</key>
<string>polluted</string>
<key>constructor</key>
<string>kept as data</string>
<key>has space</key>
<string>skipped</string>`),
        )
        assert.equal(Object.getPrototypeOf(raw), null)
        assert.deepEqual(
            { ...raw },
            { ProductVersion: "15.1", constructor: "kept as data" },
        )
        assert.equal(({} as Record<string, unknown>)["polluted"], undefined)
    })
})
