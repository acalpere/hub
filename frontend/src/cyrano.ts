// Cerca i ressaltat de Cyrano: sense accents ni majúscules, com al servidor.
export function fold(text: string): string {
  return text.toLowerCase().replace(/’/g, "'").normalize("NFD").replace(/\p{M}/gu, "");
}

/** Paraules soltes, o frases entre cometes. */
export function searchTerms(query: string): string[] {
  const terms: string[] = [];
  for (const m of query.matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = fold(m[1] ?? m[2] ?? "").trim();
    if (t) terms.push(t);
  }
  return terms;
}

export interface Piece { text: string; hit: boolean }

/** Parteix el text en trossos, marcant els que coincideixen amb la cerca (ignorant accents). */
export function highlight(text: string, terms: string[]): Piece[] {
  if (!terms.length) return [{ text, hit: false }];
  let folded = "";
  const origin: number[] = []; // posició al text original de cada caràcter del text plegat
  [...text].reduce((pos, ch) => {
    for (const f of fold(ch)) {
      folded += f;
      origin.push(pos);
    }
    return pos + ch.length;
  }, 0);
  const marks: boolean[] = Array.from({ length: text.length }, () => false);
  for (const term of terms) {
    for (let i = folded.indexOf(term); i !== -1; i = folded.indexOf(term, i + 1)) {
      const from = origin[i] ?? 0;
      const to = origin[i + term.length] ?? text.length;
      for (let k = from; k < to; k++) marks[k] = true;
    }
  }
  const pieces: Piece[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const hit = marks[i] === true;
    const last = pieces[pieces.length - 1];
    if (last && last.hit === hit) last.text += ch;
    else pieces.push({ text: ch, hit });
  }
  return pieces;
}

const ROMANS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
export const roman = (n: number): string => ROMANS[n] ?? String(n);
