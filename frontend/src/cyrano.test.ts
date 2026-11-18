import { describe, expect, it } from "vitest";
import { fold, highlight, roman, searchTerms, toSeconds, toStamp } from "./cyrano";

describe("cyrano", () => {
  it("plega accents i majúscules", () => expect(fold("L’Hôtel ÇÀ")).toBe("l'hotel ca"));
  it("separa paraules i frases", () => expect(searchTerms('nas "pobre borratxo"')).toEqual(["nas", "pobre borratxo"]));
  it("ressalta ignorant accents", () => {
    expect(highlight("Aquest pobre borratxó.", ["borratxo"])).toEqual([
      { text: "Aquest pobre ", hit: false },
      { text: "borratxó", hit: true },
      { text: ".", hit: false },
    ]);
  });
  it("sense cerca no marca res", () => expect(highlight("Hola", [])).toEqual([{ text: "Hola", hit: false }]));
  it("números romans", () => expect([roman(1), roman(4), roman(9)]).toEqual(["I", "IV", "IX"]));
  it("marques de temps a segons", () => expect([toSeconds("00:03:01"), toSeconds("02:34:03")]).toEqual([181, 9243]));
  it("segons a marca de temps", () => expect([toStamp(181), toStamp(9243.9), toStamp(0)]).toEqual(["00:03:01", "02:34:03", "00:00:00"]));
});
