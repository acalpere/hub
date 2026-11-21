// Corrector ortogràfic en català (Hunspell compilat a WebAssembly). Tot passa al navegador: el text no surt del dispositiu.
// El diccionari (public/dict/ca.*, de Softcatalà) es descarrega només la primera vegada que es revisa un text.
import type { Hunspell } from "hunspell-asm";

export type Issue = { word: string; index: number; suggestions: string[] };

let engine: Promise<Hunspell> | null = null;

function load(): Promise<Hunspell> {
  engine ??= (async () => {
    const [{ loadModule }, aff, dic] = await Promise.all([
      import("hunspell-asm"),
      fetch("/dict/ca.aff").then((r) => r.arrayBuffer()),
      fetch("/dict/ca.dic").then((r) => r.arrayBuffer()),
    ]);
    const factory = await loadModule();
    return factory.create(factory.mountBuffer(new Uint8Array(aff), "ca.aff"), factory.mountBuffer(new Uint8Array(dic), "ca.dic"));
  })().catch((e) => {
    engine = null; // permet tornar-ho a provar si ha fallat la descàrrega
    throw e;
  });
  return engine;
}

const KEY = "spell-ignore";

function ignored(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Afegeix una paraula al diccionari personal (noms propis, paraules antigues…): ja no es tornarà a marcar. */
export function ignoreWord(word: string) {
  const s = ignored();
  s.add(word.toLowerCase());
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* sense emmagatzematge: només val fins que es recarregui */
  }
}

const WORD = /[\p{L}\p{M}·'’-]+/gu;

/** Les paraules mal escrites d'un text, amb la posició i suggeriments. `known` són paraules vàlides extra (per ex. els noms dels personatges). */
export async function findIssues(text: string, known: string[] = []): Promise<Issue[]> {
  const h = await load();
  const skip = ignored();
  for (const k of known) for (const w of k.split(/[\s-]+/)) if (w) skip.add(w.toLowerCase());
  const ok = (w: string) => h.spell(w) || h.spell(w.replace(/’/g, "'"));
  const out: Issue[] = [];
  for (const m of text.matchAll(WORD)) {
    // Treu apòstrofs i guions de les puntes (cometes, guions de diàleg).
    const raw = m[0];
    const lead = raw.length - raw.replace(/^['’-]+/, "").length;
    const word = raw.replace(/^['’-]+|['’-]+$/g, "");
    if (!word || /\d/.test(word) || skip.has(word.toLowerCase())) continue;
    if (ok(word)) continue;
    // «dona-m'ho», «l'amor»: val si totes les parts són correctes.
    const parts = word.split(/['’-]/).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => p.length <= 1 || ok(p) || skip.has(p.toLowerCase()))) continue;
    if (word.length <= 1) continue;
    out.push({ word, index: (m.index ?? 0) + lead, suggestions: h.suggest(word).slice(0, 5) });
  }
  return out;
}
