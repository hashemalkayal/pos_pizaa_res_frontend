import { describe, expect, it } from "vitest";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Map<string, string> =>
  new Map(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "string" ? [[`${prefix}${key}`, value] as const] : [...flatten(value, `${prefix}${key}.`)]
    )
  );

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
/** Arabic has six plural forms; English only "one" and "other". */
const ARABIC_ONLY_PLURALS = /_(zero|two|few|many)$/;

const english = flatten(en as Tree);
const arabic = flatten(ar as Tree);

describe("locales: Arabic matches English", () => {
  it("every English text has an Arabic translation (and Arabic adds only plural forms)", () => {
    expect([...english.keys()].filter((key) => !arabic.has(key))).toEqual([]);
    expect([...arabic.keys()].filter((key) => !english.has(key) && !ARABIC_ONLY_PLURALS.test(key))).toEqual([]);
  });

  it("no Arabic text is empty", () => {
    expect([...arabic].filter(([, value]) => !value.trim()).map(([key]) => key)).toEqual([]);
  });

  it("Arabic texts use exactly the English placeholders", () => {
    const mismatches = [...arabic].flatMap(([key, value]) => {
      // An Arabic-only plural form follows the English "other" form ("{{count}}" may be written out in words).
      const englishKey = ARABIC_ONLY_PLURALS.test(key) ? key.replace(ARABIC_ONLY_PLURALS, "_other") : key;
      const reference = english.get(englishKey);
      if (reference === undefined) return [];
      const expected = placeholders(reference).filter((name) => !(name === "count" && /_(zero|one|two)$/.test(key)));
      const actual = placeholders(value).filter((name) => !(name === "count" && /_(zero|one|two)$/.test(key)));
      return expected.join() === actual.join() ? [] : [`${key}: expected {{${expected.join("}}, {{")}}} got {{${actual.join("}}, {{")}}}`];
    });
    expect(mismatches).toEqual([]);
  });
});
