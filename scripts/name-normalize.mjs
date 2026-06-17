// Mirror of src/lib/name-normalize.ts for Node-side index building.
// Keep the two files in sync.

const GREEK_MAP = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "e", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "ph", χ: "ch", ψ: "ps",
  ω: "o",
};

const CYRILLIC_MAP = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", т: "t", у: "y", х: "x",
  б: "b", г: "g", д: "d", ж: "zh", з: "z", и: "i", й: "i", л: "l",
  п: "p", ф: "f", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterateChar(ch) {
  const lower = ch.toLowerCase();
  if (GREEK_MAP[lower]) return GREEK_MAP[lower];
  if (CYRILLIC_MAP[lower] !== undefined) return CYRILLIC_MAP[lower];
  return ch;
}

function transliterate(s) {
  let out = "";
  for (const ch of s) out += transliterateChar(ch);
  return out;
}

function stripEditorial(s) {
  let out = s;
  out = out.replace(/\([^)]*\?\s*\)/g, "");
  out = out.replace(/\?/g, "");
  out = out.replace(/\.{2,}/g, "");
  out = out.replace(/\[([^\]]*)\]/g, (_m, inner) => {
    if (/^[\s\-.0-9]*$/.test(inner)) return "";
    return inner.replace(/[^A-Za-z/]/g, "");
  });
  out = out.replace(/[\[\]()]/g, "");
  return out;
}

export function normalizeName(raw) {
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
  s = s.replace(/[^a-z]+/g, " ").trim();
  return s;
}

function expandSlashVariants(raw) {
  if (!raw.includes("/")) return [raw];
  const bracketSlash = /\[([^\]]*?\/[^\]]*?)\]/;
  const m = raw.match(bracketSlash);
  if (m) {
    const before = raw.slice(0, m.index);
    const after = raw.slice(m.index + m[0].length);
    return m[1]
      .split("/")
      .map((part) => `${before}${part}${after}`)
      .flatMap((s) => expandSlashVariants(s));
  }
  return raw.split("/").flatMap((s) => expandSlashVariants(s));
}

export function normalizeNameKeys(raw) {
  if (!raw) return [];
  const seen = new Set();
  for (const variant of expandSlashVariants(raw)) {
    const k = normalizeName(variant);
    if (k) seen.add(k);
  }
  return Array.from(seen);
}
