/**
 * Convert spoken number phrases → digits before payment parsing.
 * Covers English + common Romance / Indic ASR transcripts.
 */

const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  nought: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  // Spanish
  cero: 0,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  // French
  zéro: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  // German
  null: 0,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  // Hindi (Latin transliteration — common ASR output)
  ek: 1,
  do: 2,
  teen: 3,
  tin: 3,
  char: 4,
  chaar: 4,
  panch: 5,
  paanch: 5,
  chhe: 6,
  chhah: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  dus: 10,
  gyarah: 11,
  barah: 12,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  zwanzig: 20,
  dreißig: 30,
  dreissig: 30,
  vierzig: 40,
  fünfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
  bis: 20,
  tees: 30,
  chalis: 40,
  pachas: 50,
  saath: 60,
  sattar: 70,
  assi: 80,
  nabbe: 90,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  oitenta: 80,
};

const SCALES: Record<string, number> = {
  hundred: 100,
  hundreds: 100,
  thousand: 1000,
  thousands: 1000,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  crore: 10_000_000,
  crores: 10_000_000,
  million: 1_000_000,
  millions: 1_000_000,
  ciento: 100,
  cientos: 100,
  cien: 100,
  mil: 1000,
  millón: 1_000_000,
  millon: 1_000_000,
  cent: 100,
  cents: 100,
  mille: 1000,
  hundert: 100,
  tausend: 1000,
  sau: 100,
  hazar: 1000,
  hazaar: 1000,
  cem: 100,
  cento: 100,
};


// Hindi / Devanagari digits and common words
const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

const HI_WORDS: Record<string, number> = {
  शून्य: 0,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  बीस: 20,
  तीस: 30,
  चालीस: 40,
  पचास: 50,
  साठ: 60,
  सत्तर: 70,
  अस्सी: 80,
  नब्बे: 90,
  सौ: 100,
  हजार: 1000,
  लाख: 100_000,
  करोड़: 10_000_000,
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/(\d)[,\s](?=\d{3}\b)/g, "$1") // 1,000 / 1 000
    .replace(/(\d)\s*\.\s*(\d)/g, "$1.$2")
    .replace(/[^a-z0-9àáâãäåæçèéêëìíîïñòóôõöùúûüýÿßāăąćčďēėęğģīįķļłńņōőœřśşšťūůűźżž.\u0900-\u097F-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function wordValue(w: string): number | "scale" | null {
  if (/^\d+(?:\.\d+)?$/.test(w)) return Number(w);
  if (ONES[w] != null) return ONES[w];
  if (TENS[w] != null) return TENS[w];
  if (HI_WORDS[w] != null) return HI_WORDS[w];
  if (SCALES[w] != null) return "scale";
  // Spanish 16-19
  const teensEs: Record<string, number> = {
    dieciséis: 16,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
  };
  if (teensEs[w] != null) return teensEs[w];
  // compound twenty-one style
  const hyphen = w.split("-");
  if (hyphen.length === 2 && TENS[hyphen[0]] != null && ONES[hyphen[1]] != null) {
    return TENS[hyphen[0]] + ONES[hyphen[1]];
  }
  return null;
}

/** Parse a run of number-words into a single numeric value */
export function parseSpokenNumberPhrase(words: string[]): number | null {
  if (!words.length) return null;
  let total = 0;
  let current = 0;
  let saw = false;

  for (const raw of words) {
    const w = raw.replace(/\.$/, "");
    if (w === "and" || w === "y" || w === "et" || w === "und" || w === "e") continue;

    if (/^\d+(?:\.\d+)?$/.test(w)) {
      current += Number(w);
      saw = true;
      continue;
    }

    if (SCALES[w] != null) {
      const scale = SCALES[w];
      if (current === 0) current = 1;
      current *= scale;
      if (scale >= 1000) {
        total += current;
        current = 0;
      }
      saw = true;
      continue;
    }

    const v = wordValue(w);
    if (typeof v === "number") {
      current += v;
      saw = true;
      continue;
    }
    return null;
  }

  if (!saw) return null;
  return total + current;
}

/**
 * Replace spoken number phrases in free text with digits.
 * Leaves non-number tokens (names, verbs) intact.
 */
export function replaceSpokenNumbers(text: string): string {
  let out = text;
  for (const [d, lat] of Object.entries(DEVANAGARI_DIGITS)) {
    out = out.split(d).join(lat);
  }

  // Digits already present with Indian grouping: 1,00,000
  out = out.replace(/\b(\d{1,2}),(\d{2}),(\d{3})\b/g, (_, a, b, c) => String(Number(`${a}${b}${c}`)));
  out = out.replace(/\b(\d{1,3}),(\d{3})\b/g, (_, a, b) => String(Number(`${a}${b}`)));

  const tokens = tokenize(out);
  if (!tokens.length) return out;

  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Grow the longest valid number phrase from i
    let bestLen = 0;
    let bestVal: number | null = null;
    for (let j = i + 1; j <= Math.min(tokens.length, i + 8); j++) {
      const slice = tokens.slice(i, j);
      // Must include at least one number-ish token
      if (!slice.some((t) => wordValue(t) != null || SCALES[t] != null || /^\d/.test(t))) break;
      const val = parseSpokenNumberPhrase(slice);
      if (val != null && Number.isFinite(val)) {
        bestLen = j - i;
        bestVal = val;
      } else if (bestLen === 0) {
        // first token wasn't start of a number — stop extending
        if (wordValue(slice[0]) == null && SCALES[slice[0]] == null && !/^\d/.test(slice[0])) break;
      }
    }
    if (bestLen > 0 && bestVal != null) {
      result.push(String(bestVal));
      i += bestLen;
    } else {
      // Preserve original casing from a rough rebuild — use token as-is
      result.push(tokens[i]);
      i += 1;
    }
  }

  // Rebuild using original spacing as best-effort: join with spaces
  // Then map back better by replacing phrases in the lowercased original
  return stitchReplacement(out, result);
}

function stitchReplacement(original: string, lowerTokensOut: string[]): string {
  // Prefer phrase-level replace on original for display quality
  const srcTokens = tokenize(original);
  if (srcTokens.length === lowerTokensOut.length && srcTokens.every((t, idx) => {
    const out = lowerTokensOut[idx];
    return t === out || (!Number.isNaN(Number(out)) && parseSpokenNumberPhrase([t]) === Number(out));
  })) {
    // Simple path: rebuild from original segments
  }

  // Walk original with a regex of number-word runs
  const numberWord =
    "zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|lac|lakhs|crore|crores|million|and|" +
    "uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|mil|" +
    "un|une|deux|trois|quatre|cinq|sept|huit|neuf|dix|onze|douze|vingt|trente|quarante|cinquante|soixante|cent|mille|" +
    "eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwanzig|dreißig|dreissig|vierzig|fünfzig|hundert|tausend|" +
    "ek|do|teen|tin|char|chaar|panch|paanch|chhe|saat|aath|nau|dus|bis|tees|chalis|pachas|saath|sau|hazar|hazaar|" +
    "um|uma|dois|duas|três|quatro|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|sessenta|oitenta|cem|cento|" +
    "शून्य|एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ|दस|बीस|तीस|चालीस|पचास|साठ|सत्तर|अस्सी|नब्बे|सौ|हजार|लाख|करोड़";

  const re = new RegExp(
    `\\b(?:${numberWord})(?:[\\s-]+(?:${numberWord}|\\d+(?:\\.\\d+)?))*\\b`,
    "gi"
  );

  return original.replace(re, (phrase) => {
    const words = tokenize(phrase);
    const val = parseSpokenNumberPhrase(words);
    return val != null ? String(val) : phrase;
  }).replace(/\b(\d+)\s+(\d+)\b/g, (_, a, b) => {
    // Avoid gluing "pay 5 00" wrongly — only glue if second is scale-like remnant already handled
    return `${a} ${b}`;
  });
}

/** True if string looks like it still contains spoken number words */
export function hasSpokenNumberWords(text: string): boolean {
  return /\b(twenty|thirty|hundred|thousand|lakh|five|fifty|veinte|cien|hundert|सौ|हजार)\b/i.test(
    text
  );
}
