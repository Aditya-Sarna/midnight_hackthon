/**
 * Voice intents for Circled Credit v1 — borrow / repay / standing.
 * Parsed before payment intents so "loan" phrases never become fake recipients.
 */
import { replaceSpokenNumbers } from "./spokenNumbers";

export type CreditVoiceIntent =
  | {
      kind: "borrow";
      loanAmount: number;
      /** If omitted, Wallet defaults to ceil(loan × 1.5) for v1 150% floor */
      collateralAmount?: number;
      cleaned: string;
    }
  | { kind: "repay"; cleaned: string }
  | { kind: "standing"; cleaned: string };

/** v1 minimum collateral for a loan amount (150%) */
export function defaultCollateralForLoan(loanAmount: number): number {
  return Math.ceil((Math.floor(loanAmount) * 3) / 2);
}

function lightClean(raw: string): string {
  let s = String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[""„«»]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[!?,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = replaceSpokenNumbers(s);
  s = s
    .replace(
      /\b(um+|uh+|please|pls|can you|could you|i want to|i wanna|i'd like to|i would like to|go ahead and|just|okay|ok|alright|so+|well|कृपया)\b/gi,
      " "
    )
    .replace(/^(hey|hi|hello|yo)\s+(circled|nyx)\s+/i, "")
    .replace(/^(circled|nyx)\s+/i, "")
    .replace(/\b(rupees?|dollars?|euros?|pounds?|inr|rs\.?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function extractAmount(s: string): number | undefined {
  const m = s.match(/\b(\d+(?:\.\d+)?)\b/);
  if (!m) return undefined;
  const n = Math.floor(Number(m[1]));
  return n > 0 ? n : undefined;
}

function extractCollateral(s: string): number | undefined {
  const patterns = [
    /\b(?:with|using|lock(?:ing)?)\s+(\d+(?:\.\d+)?)\s*(?:as\s+)?collateral\b/i,
    /\bcollateral\s+(?:of\s+)?(\d+(?:\.\d+)?)\b/i,
    /\b(\d+(?:\.\d+)?)\s+collateral\b/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const n = Math.floor(Number(m[1]));
      if (n > 0) return n;
    }
  }
  return undefined;
}

/** True when transcript looks like a credit command (not a payment). */
export function looksLikeCreditUtterance(raw: string): boolean {
  const s = lightClean(raw).toLowerCase();
  if (!s) return false;
  if (
    /\b(borrow|repay|installment|collateral|credit\s+standing|credit\s+score)\b/.test(s)
  ) {
    return true;
  }
  if (/\b(?:take|get|need|want)\s+(?:a\s+)?loan\b/.test(s)) return true;
  if (/\bloan\s+(?:me|of|for|lo|lelo|le\s*lo|do|chuka|chukaao|bhar)\b/.test(s)) return true;
  if (/\b(?:mujhe|mere)\s+.+\s+loan\b/.test(s)) return true;
  if (/\bpay\s+(?:back\s+)?(?:my\s+)?loan\b/.test(s)) return true;
  if (/\bcheck\s+(?:my\s+)?credit\b/.test(s)) return true;
  // "1000 ka loan" / "loan 1000"
  if (/\bloan\b/.test(s) && /\d/.test(s)) return true;
  return false;
}

/**
 * Parse a Circled Credit voice command.
 * Returns null if this is not a credit utterance (caller should try payment parse).
 */
export function parseCreditUtterance(raw: string): CreditVoiceIntent | null {
  if (!looksLikeCreditUtterance(raw)) return null;
  const cleaned = lightClean(raw);
  const lower = cleaned.toLowerCase();

  // Standing / check credit — no amount required
  if (
    /\b(?:credit\s+standing|credit\s+score|check\s+(?:my\s+)?credit|my\s+credit\s+standing)\b/.test(
      lower
    )
  ) {
    return { kind: "standing", cleaned };
  }

  // Repay — before borrow so "pay my loan" isn't misread as borrow
  if (
    /\b(?:repay|pay\s+back)\b/.test(lower) ||
    /\bpay\s+(?:my\s+)?(?:loan|installment)\b/.test(lower) ||
    /\bloan\s+(?:chuka|chukaao|chuka\s*do|bhar(?:\s*do)?|pay)\b/.test(lower) ||
    /\b(?:pay|bhar)\s+(?:my\s+)?installment\b/.test(lower) ||
    /\brepay\s+(?:my\s+)?loan\b/.test(lower)
  ) {
    return { kind: "repay", cleaned };
  }

  // Borrow
  const borrowCue =
    /\b(?:borrow|take\s+(?:a\s+)?loan|get\s+(?:a\s+)?loan|need\s+(?:a\s+)?loan|want\s+(?:a\s+)?loan|loan\s+me|loan\s+lo|loan\s+lelo|loan\s+le\s*lo|mujhe\s+.+\s+loan|\d+\s*(?:ka\s+)?loan|loan\s+\d+)\b/.test(
      lower
    ) || (/\bloan\b/.test(lower) && /\d/.test(lower));

  if (borrowCue) {
    // Prefer amount after "loan of/for" or "borrow"
    let loanAmount: number | undefined;
    const ordered = [
      /\bborrow\s+(\d+(?:\.\d+)?)/i,
      /\bloan\s+(?:me\s+|of\s+|for\s+|lo\s+|lelo\s+|le\s*lo\s+)?(\d+(?:\.\d+)?)/i,
      /\b(?:take|get|need|want)\s+(?:a\s+)?loan\s+(?:of\s+|for\s+)?(\d+(?:\.\d+)?)/i,
      /\b(\d+(?:\.\d+)?)\s*(?:ka\s+)?loan\b/i,
      /\bmujhe\s+(\d+(?:\.\d+)?)\s*(?:ka\s+)?loan\b/i,
    ];
    for (const re of ordered) {
      const m = cleaned.match(re);
      if (m) {
        const n = Math.floor(Number(m[1]));
        if (n > 0) {
          loanAmount = n;
          break;
        }
      }
    }
    if (!loanAmount) loanAmount = extractAmount(cleaned);
    if (!loanAmount) return null;

    const collateralAmount = extractCollateral(cleaned);
    return {
      kind: "borrow",
      loanAmount,
      ...(collateralAmount != null ? { collateralAmount } : {}),
      cleaned,
    };
  }

  return null;
}
