/** Join class strings, dropping falsy values — the NativeWind analog of the
 *  web's `cn` (without twMerge; NativeWind has no conflicting-utility
 *  precedence to resolve). Used to compose a static base with a variant map and
 *  an optional caller-supplied className. Every class string must still appear as
 *  a literal somewhere in the source so Tailwind's content scanner emits it. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
