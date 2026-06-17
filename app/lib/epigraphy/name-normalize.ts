// Normalize a raw nomen/cognomen string into a canonical search key.
//
// The corpus's nomen/cognomen fields are mostly already in nominative-case
// Latin, but ~2% retain editorial artifacts: lacuna markers (`[...]`,
// `[---]`, `[3]`, trailing `...`), uncertainty markers (`(?)`, trailing `?`),
// gender variant slashes (`Vibius/Vibia`, `Quiet[a/us]`), Greek letters
// (`Αὐρήλιος`), and stray Cyrillic look-alikes inside otherwise-Latin
// strings (`Philostoргus`). We strip the markers, transliterate non-Latin
// scripts to ASCII, drop diacritics, and lowercase. Slash variants are
// handled by `splitVariants` which returns multiple keys per input.

const GREEK_MAP: Record<string, string> = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "e", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "ph", χ: "ch", ψ: "ps",
  ω: "o",
};

const CYRILLIC_MAP: Record<string, string> = {
  // Visually-Latin Cyrillic letters that turn up as OCR artifacts in
  // otherwise-Latin names (e.g. "Philostoргus"). We map them to their
  // Latin look-alike rather than a phonetic transcription.
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", т: "t", у: "y", х: "x",
  // Cyrillic-only letters: phonetic fallback so they don't vanish silently.
  б: "b", г: "g", д: "d", ж: "zh", з: "z", и: "i", й: "i", л: "l",
  п: "p", ф: "f", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterateChar(ch: string): string {
  const lower = ch.toLowerCase();
  if (GREEK_MAP[lower]) return GREEK_MAP[lower];
  if (CYRILLIC_MAP[lower] !== undefined) return CYRILLIC_MAP[lower];
  return ch;
}

function transliterate(s: string): string {
  let out = "";
  for (const ch of s) out += transliterateChar(ch);
  return out;
}

// Strip bracketed lacuna fragments and uncertainty markers, but preserve
// any Latin letters inside brackets (e.g. `R[---]us` -> `Rus`,
// `Cresc[ens(?)]` -> `Crescens`). Slash variants are NOT split here —
// callers that need both halves should use `splitVariants` first.
function stripEditorial(s: string): string {
  let out = s;
  // `(?)` and `(...)`
  out = out.replace(/\([^)]*\?\s*\)/g, "");
  // Question marks (uncertainty)
  out = out.replace(/\?/g, "");
  // Ellipses
  out = out.replace(/\.{2,}/g, "");
  // Bracketed content: keep letters, drop everything else inside the brackets.
  out = out.replace(/\[([^\]]*)\]/g, (_m, inner: string) => {
    // Drop pure lacuna markers (digits, dashes, dots, whitespace only).
    if (/^[\s\-.0-9]*$/.test(inner)) return "";
    // Otherwise keep the letters from inside (slash variants left for splitVariants).
    return inner.replace(/[^A-Za-z/]/g, "");
  });
  // Unclosed brackets and stray punctuation
  out = out.replace(/[\[\]()]/g, "");
  return out;
}

export function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s) return "";
  s = stripEditorial(s);
  // Drop combining marks (Greek/Latin diacritics) before transliteration so
  // the Greek/Cyrillic maps see base letters. `\p{M}` covers all combining
  // categories — the older `[̀-ͯ]` range misses some Greek tonos marks.
  s = s.normalize("NFD").replace(/\p{M}/gu, "");
  s = transliterate(s);
  s = s.toLowerCase();
  // Collapse non-letter runs and trim
  s = s.replace(/[^a-z]+/g, " ").trim();
  return s;
}

// Expand `Vibius/Vibia`, `Quiet[a/us]`, `Valen[s/tinus]` into the set of
// concrete name forms before normalization. For inputs without slashes
// this just returns `[input]`.
function expandSlashVariants(raw: string): string[] {
  if (!raw.includes("/")) return [raw];
  // Handle bracketed slash forms like `Quiet[a/us]` => ["Quieta", "Quietus"].
  const bracketSlash = /\[([^\]]*?\/[^\]]*?)\]/;
  const m = raw.match(bracketSlash);
  if (m) {
    const before = raw.slice(0, m.index);
    const after = raw.slice((m.index ?? 0) + m[0].length);
    return m[1]
      .split("/")
      .map((part) => `${before}${part}${after}`)
      .flatMap((s) => expandSlashVariants(s));
  }
  // Plain `Vibius/Vibia` => ["Vibius", "Vibia"].
  return raw.split("/").flatMap((s) => expandSlashVariants(s));
}

// Returns the set of distinct normalized keys derivable from one raw
// nomen/cognomen string. Empty keys are filtered out. Always a unique set.
export function normalizeNameKeys(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const variant of expandSlashVariants(raw)) {
    const k = normalizeName(variant);
    if (k) seen.add(k);
  }
  return Array.from(seen);
}
