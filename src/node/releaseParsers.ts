// Parsers for the OS release files read by `osRelease()`. Internal: the `node`
// entry point does not re-export them, so they are tested directly.

/**
 * Valid os-release keys: shell-compatible, upper-case variable names. This
 * also rules out keys such as `__proto__` or `constructor`.
 */
const OS_RELEASE_KEY = /^[A-Z][A-Z0-9_]*$/

/** A `<key>…</key>` followed by a `<string>…</string>` value in a plist. */
const PLIST_STRING_ENTRY = /<key>([^<]*)<\/key>\s*<string>([^<]*)<\/string>/g

/** Valid plist keys to copy; this also rules out keys such as `__proto__`. */
const PLIST_KEY = /^[A-Za-z][A-Za-z0-9_]*$/

/** The predefined XML entities. */
const XML_ENTITIES: ReadonlyMap<string, string> = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["gt", ">"],
    ["lt", "<"],
    ["quot", '"'],
])

/** Decodes the predefined and numeric character references of XML text. */
function decodeXml(text: string): string {
    return text.replace(
        /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-z]+));/g,
        (
            match: string,
            hex: string | undefined,
            decimal: string | undefined,
            // Set when neither `hex` nor `decimal` is: one group always matches.
            name: string,
        ) => {
            const codePoint =
                hex !== undefined
                    ? Number.parseInt(hex, 16)
                    : decimal !== undefined
                      ? Number.parseInt(decimal, 10)
                      : undefined
            if (codePoint === undefined) {
                return XML_ENTITIES.get(name) ?? match
            }
            return codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : match
        },
    )
}

/**
 * Removes one level of shell-style quoting from an os-release value. Double
 * quotes allow the `\\`, `\"`, `` \` `` and `\$` escapes; single quotes are
 * literal.
 */
function unquote(value: string): string {
    if (value.length >= 2) {
        const quote = value[0]
        if (quote === '"' && value.endsWith('"')) {
            return value.slice(1, -1).replace(/\\([\\"`$])/g, "$1")
        }
        if (quote === "'" && value.endsWith("'")) {
            return value.slice(1, -1)
        }
    }
    return value
}

/**
 * Parses os-release content into a null-prototype record, skipping blank
 * lines, comments, lines without `=`, and invalid keys.
 */
export function parseOsRelease(content: string): Record<string, string> {
    const raw: Record<string, string> = Object.create(null)
    for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed === "" || trimmed.startsWith("#")) {
            continue
        }
        const eq = trimmed.indexOf("=")
        if (eq === -1) {
            continue
        }
        const key = trimmed.substring(0, eq).trim()
        if (!OS_RELEASE_KEY.test(key)) {
            continue
        }
        raw[key] = unquote(trimmed.substring(eq + 1).trim())
    }
    return raw
}

/**
 * Parses the `<string>` entries of an XML property list into a
 * null-prototype record, skipping other value types and invalid keys.
 */
export function parsePlistStrings(content: string): Record<string, string> {
    const raw: Record<string, string> = Object.create(null)
    for (const [, rawKey = "", value = ""] of content.matchAll(
        PLIST_STRING_ENTRY,
    )) {
        const key = decodeXml(rawKey.trim())
        if (PLIST_KEY.test(key)) {
            raw[key] = decodeXml(value.trim())
        }
    }
    return raw
}
