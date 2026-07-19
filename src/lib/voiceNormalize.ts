/**
 * ASR cleanup for payment voice commands — fillers, homophones, punctuation.
 */
import { replaceSpokenNumbers } from "./spokenNumbers";

const FILLERS =
  /\b(um+|uh+|erm+|hmm+|like|you know|please|pls|can you|could you|would you|i want to|i wanna|i'd like to|i would like to|go ahead and|just|kind of|kinda|sort of|actually|basically|okay|ok|alright|right|so+|well)\b/gi;

const FILLERS_MULTI =
  /\b(por favor|s'il te plaît|s'il vous plaît|bitte|per favore|por favor|कृपया|please send|please pay|can you pay|can you send|bhej dijiye|bhej dijie|bhej digiye|bhej do|bhej dena|bhej denge|bhejo|bhejde|send karo|transfer karo|paise bhejo|rupees bhejo|kar do|de do|kar dena)\b/gi;

/** Trailing Hinglish/Hindi “please send” that ASR glues onto the recipient name */
export const HINGLISH_NAME_TRAILERS =
  /\s+(?:bhej(?:\s*(?:di(?:jiye|jie|giye)|do|dena|denge|de))?|bhejo|bhejde|kar(?:\s*do|\s*dena)?|de\s*do|send(?:\s+karo)?|transfer(?:\s+karo)?|please|pls|now|thanks|thank\s*you)\b.*$/i;

const ASR_GARBAGE_NAME =
  /\b(bhej|dijiye|dijie|digiye|bhejo|bhejde|karo|dena|denge|please|rupees?|dollars?|paise)\b/i;

/** Common speech-engine mishears around payment phrasing */
const HOMOPHONES: Array<[RegExp, string]> = [
  [/\btoo\b/gi, "to"],
  [/\b(\d+(?:\.\d+)?)\s+two\s+(?=[A-Za-z\u0900-\u097F])/gi, "$1 to "],
  [/\bfor\b(?=\s+\d)/gi, ""],
  [/\brupee\b/gi, "rupees"],
  [/\bbucks?\b/gi, "dollars"],
  [/\bpai\b/gi, "pay"],
  [/\bpayto\b/gi, "pay to"],
  [/\bsendto\b/gi, "send to"],
  [/\btransferto\b/gi, "transfer to"],
  [/\b(?:bhej(?:o|e)?|bhej\s*do|bhej\s*di(?:jiye|jie)?|भेजो|भेज\s*दीजिए|भेज\s*दो)\b/gi, "pay"],
  [/\b(?:rs|rupees?)\s*(?=\d)/gi, ""],
  [/\bko\b/gi, "to"],
];

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Normalize for fuzzy name compare — keeps unicode letters */
export function normalizePersonKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Strip ASR junk so "Deepak bhej dijiye" → "Deepak" */
export function sanitizePersonLabel(raw: string): string {
  let s = String(raw || "")
    .replace(HINGLISH_NAME_TRAILERS, "")
    .replace(FILLERS_MULTI, " ")
    .replace(/\b(?:pay|send|transfer|bhej(?:o|e)?|भेजो|दीजिए)\b/gi, " ")
    .replace(/^[.\-]+\s*/, "")
    .replace(/[."']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Keep at most first two alphabetic tokens (first + last name)
  const parts = s.split(/\s+/).filter((p) => /[\p{L}]{2,}/u.test(p) && !ASR_GARBAGE_NAME.test(p));
  if (parts.length === 0) return "";
  return parts.slice(0, 2).join(" ");
}

/** True if a contact label is clearly ASR garbage and should be dropped */
export function isAsrGarbageLabel(label: string): boolean {
  const t = String(label || "").trim();
  if (!t) return true;
  if (ASR_GARBAGE_NAME.test(t)) return true;
  if (t.split(/\s+/).length > 3) return true;
  const cleaned = sanitizePersonLabel(t);
  return !cleaned || cleaned.length < 2;
}

function personWords(label: string): string[] {
  return sanitizePersonLabel(label)
    .split(/\s+/)
    .map(normalizePersonKey)
    .filter((w) => w.length >= 2);
}

export function fuzzyContactMatch(
  candidate: string,
  contacts: string[]
): { label: string; score: number } | null {
  if (!candidate?.trim() || !contacts.length) return null;
  const want = normalizePersonKey(sanitizePersonLabel(candidate) || candidate);
  if (!want || want.length < 2) return null;

  let best: { label: string; score: number } | null = null;
  for (const label of contacts) {
    if (isAsrGarbageLabel(label)) continue;
    const words = personWords(label);
    if (!words.length) continue;
    const primary = words[0];

    if (primary === want || words.some((w) => w === want)) {
      return { label: sanitizePersonLabel(label) || label, score: 1 };
    }

    // Prefix / containment only when lengths are close (blocks deepa ⊂ deepakbhejdijiye)
    for (const have of words) {
      const ratio = Math.min(have.length, want.length) / Math.max(have.length, want.length);
      if (ratio < 0.72) continue;
      if (have.startsWith(want) || want.startsWith(have) || have.includes(want) || want.includes(have)) {
        const score = 0.8 + ratio * 0.15;
        if (!best || score > best.score) {
          best = { label: sanitizePersonLabel(label) || label, score };
        }
        continue;
      }
      const dist = levenshtein(want, have);
      const maxLen = Math.max(want.length, have.length);
      const score = 1 - dist / maxLen;
      const allowed = maxLen <= 4 ? 1 : maxLen <= 8 ? 2 : 3;
      if (dist <= allowed && score >= 0.72) {
        if (!best || score > best.score) {
          best = { label: sanitizePersonLabel(label) || label, score };
        }
      }
    }
  }
  return best && best.score >= 0.72 ? best : null;
}

/** Find which contact name appears (fuzzy) inside a transcript */
export function findContactInTranscript(
  transcript: string,
  contacts: string[]
): { label: string; score: number } | null {
  if (!contacts.length) return null;
  const cleanContacts = contacts.filter((c) => !isAsrGarbageLabel(c));
  const key = normalizePersonKey(transcript);
  let best: { label: string; score: number } | null = null;

  for (const label of cleanContacts) {
    const words = personWords(label);
    const primary = words[0];
    if (!primary || primary.length < 2) continue;
    // Require full primary name as substring of transcript key (not short fragments)
    if (key.includes(primary) && primary.length >= 3) {
      const score = 0.95;
      const clean = sanitizePersonLabel(label) || label;
      if (!best || score > best.score) best = { label: clean, score };
      continue;
    }
    const tokens = transcript.split(/\s+/);
    for (const tok of tokens) {
      if (tok.length < 2 || /^\d+$/.test(tok)) continue;
      if (/^(pay|send|to|for|the|a|an|rupees?|rs|inr)$/i.test(tok)) continue;
      const m = fuzzyContactMatch(tok, [label]);
      if (m && (!best || m.score > best.score)) best = m;
    }
  }
  return best;
}

/**
 * Clean a raw ASR transcript into something parseable.
 * Returns both display text (light cleanup) and parse text (aggressive).
 */
export function normalizeVoiceTranscript(raw: string): {
  display: string;
  parse: string;
} {
  let s = String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[""„«»]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[…]+/g, " ")
    .replace(/[.]{2,}/g, " ")
    .replace(/[!?]+/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let display = s.replace(FILLERS, " ").replace(FILLERS_MULTI, " ").replace(/\s+/g, " ").trim();

  let parse = display;
  for (const [re, rep] of HOMOPHONES) {
    parse = parse.replace(re, rep);
  }
  parse = parse
    .replace(FILLERS, " ")
    .replace(FILLERS_MULTI, " ")
    .replace(HINGLISH_NAME_TRAILERS, " ")
    .replace(/\b(rupees?|dollars?|euros?|pounds?|inr)\b/gi, " ")
    .replace(/\brs\.?(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  parse = replaceSpokenNumbers(parse);
  display = replaceSpokenNumbers(display);

  parse = parse.replace(/^(hey|hi|hello|yo|ok|okay)\s+(circle|circled|nyx|pay)\s+/i, "");
  parse = parse.replace(/^(circle|circled|nyx)\s+/i, "");
  parse = parse.replace(FILLERS_MULTI, " ").replace(HINGLISH_NAME_TRAILERS, " ").replace(/\s+/g, " ").trim();

  return {
    display: display.replace(/\s+/g, " ").trim(),
    parse: parse.replace(/\s+/g, " ").trim(),
  };
}

/** Score how payment-shaped a transcript is (0–1) */
export function paymentShapeScore(
  text: string,
  parsed: { amount?: number; recipient?: string },
  contactHit: boolean
): number {
  let s = 0;
  if (parsed.amount && parsed.amount > 0) s += 0.45;
  if (parsed.recipient && parsed.recipient.length >= 2) s += 0.35;
  if (contactHit) s += 0.2;
  if (/\b(pay|send|transfer|pagar|payer|भेजो|envoyer)\b/i.test(text)) s += 0.05;
  return Math.min(1, s);
}
