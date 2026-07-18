/**
 * Display-currency preference for international judges.
 * Amounts are abstract Class 0 units — we format with the chosen ISO currency,
 * not live FX conversion (privacy: server never sees currency either).
 */

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "INR"
  | "JPY"
  | "AUD"
  | "CAD"
  | "SGD"
  | "AED"
  | "CHF"
  | "BRL"
  | "MXN"
  | "KRW"
  | "NGN"
  | "ZAR"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "TRY"
  | "THB"
  | "PHP"
  | "IDR"
  | "VND"
  | "HKD"
  | "NZD";

export type CurrencyOption = {
  code: CurrencyCode;
  label: string;
  locales: string[];
};

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", locales: ["en-US"] },
  { code: "EUR", label: "Euro", locales: ["de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL"] },
  { code: "GBP", label: "British Pound", locales: ["en-GB"] },
  { code: "INR", label: "Indian Rupee", locales: ["en-IN", "hi-IN"] },
  { code: "JPY", label: "Japanese Yen", locales: ["ja-JP"] },
  { code: "AUD", label: "Australian Dollar", locales: ["en-AU"] },
  { code: "CAD", label: "Canadian Dollar", locales: ["en-CA"] },
  { code: "SGD", label: "Singapore Dollar", locales: ["en-SG"] },
  { code: "AED", label: "UAE Dirham", locales: ["ar-AE", "en-AE"] },
  { code: "CHF", label: "Swiss Franc", locales: ["de-CH", "fr-CH"] },
  { code: "BRL", label: "Brazilian Real", locales: ["pt-BR"] },
  { code: "MXN", label: "Mexican Peso", locales: ["es-MX"] },
  { code: "KRW", label: "Korean Won", locales: ["ko-KR"] },
  { code: "NGN", label: "Nigerian Naira", locales: ["en-NG"] },
  { code: "ZAR", label: "South African Rand", locales: ["en-ZA"] },
  { code: "SEK", label: "Swedish Krona", locales: ["sv-SE"] },
  { code: "NOK", label: "Norwegian Krone", locales: ["nb-NO"] },
  { code: "DKK", label: "Danish Krone", locales: ["da-DK"] },
  { code: "PLN", label: "Polish Złoty", locales: ["pl-PL"] },
  { code: "TRY", label: "Turkish Lira", locales: ["tr-TR"] },
  { code: "THB", label: "Thai Baht", locales: ["th-TH"] },
  { code: "PHP", label: "Philippine Peso", locales: ["en-PH"] },
  { code: "IDR", label: "Indonesian Rupiah", locales: ["id-ID"] },
  { code: "VND", label: "Vietnamese Dong", locales: ["vi-VN"] },
  { code: "HKD", label: "Hong Kong Dollar", locales: ["zh-HK", "en-HK"] },
  { code: "NZD", label: "New Zealand Dollar", locales: ["en-NZ"] },
];

const STORAGE_KEY = "circled_display_currency";

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "IDR"]);

const REGION_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD",
  GB: "GBP",
  IN: "INR",
  JP: "JPY",
  AU: "AUD",
  CA: "CAD",
  SG: "SGD",
  AE: "AED",
  CH: "CHF",
  BR: "BRL",
  MX: "MXN",
  KR: "KRW",
  NG: "NGN",
  ZA: "ZAR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  TR: "TRY",
  TH: "THB",
  PH: "PHP",
  ID: "IDR",
  VN: "VND",
  HK: "HKD",
  NZ: "NZD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  IE: "EUR",
  AT: "EUR",
  BE: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
};

export function detectCurrency(): CurrencyCode {
  if (typeof navigator === "undefined") return "USD";
  const locales = [navigator.language, ...(navigator.languages ?? [])];
  for (const loc of locales) {
    try {
      const byLocale = CURRENCIES.find((c) =>
        c.locales.some((l) => l.toLowerCase() === loc.toLowerCase())
      );
      if (byLocale) return byLocale.code;
      const region =
        typeof Intl !== "undefined" && "Locale" in Intl
          ? new Intl.Locale(loc).maximize().region
          : loc.split("-")[1];
      if (region && REGION_CURRENCY[region.toUpperCase()]) {
        return REGION_CURRENCY[region.toUpperCase()];
      }
    } catch {
      /* ignore */
    }
  }
  return "USD";
}

export function getDisplayCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (saved && CURRENCIES.some((c) => c.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  return detectCurrency();
}

export function setDisplayCurrency(code: CurrencyCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("circled:currency", { detail: code }));
  }
}

function localeFor(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.locales[0] ?? "en-US";
}

export function formatMoney(amount: number, currency: CurrencyCode = getDisplayCurrency()): string {
  const locale = localeFor(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2,
      maximumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatMoneyParts(
  amount: number,
  currency: CurrencyCode = getDisplayCurrency()
): { symbol: string; whole: string; cents: string; formatted: string } {
  const formatted = formatMoney(amount, currency);
  const locale = localeFor(currency);
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2,
    maximumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2,
  }).formatToParts(amount);

  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency;
  const whole = parts
    .filter((p) => p.type === "integer" || p.type === "group")
    .map((p) => p.value)
    .join("");
  const cents = parts.find((p) => p.type === "fraction")?.value ?? "00";
  return { symbol, whole, cents, formatted };
}

/** Strip currency words/symbols so “pay $25 to Janhvi” / “pay 25 dollars” parse cleanly */
export function stripCurrencyTokens(utterance: string): string {
  return utterance
    .replace(/[$€£¥₹₩₦]/g, " ")
    .replace(
      /\b(usd|eur|gbp|inr|jpy|aud|cad|sgd|aed|chf|brl|mxn|krw|ngn|zar|sek|nok|dkk|pln|try|thb|php|idr|vnd|hkd|nzd)\b/gi,
      " "
    )
    .replace(
      /\b(dollars?|bucks|euros?|pounds?|sterling|rupees?|yen|yuan|won|naira|dirhams?|francs?|reais|real|pesos?|krona|kronor|kroner|zloty|lira|baht|dong|rupiah)\b/gi,
      " "
    )
    .replace(/\brs\.?(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** If the utterance names a currency, adopt it as display preference */
export function inferCurrencyFromUtterance(utterance: string): CurrencyCode | null {
  const t = utterance.toLowerCase();
  if (/\$|\busd\b|\bdollars?\b|\bbucks\b/.test(t) && !/\baud\b|\bcad\b|\bsgd\b|\bnzd\b|\bhkd\b/.test(t)) {
    if (/\baud\b|\baustralian/.test(t)) return "AUD";
    if (/\bcad\b|\bcanadian/.test(t)) return "CAD";
    if (/\bsgd\b|\bsingapore/.test(t)) return "SGD";
    if (/\bnzd\b/.test(t)) return "NZD";
    if (/\bhkd\b|\bhong kong/.test(t)) return "HKD";
    return "USD";
  }
  if (/€|\beur\b|\beuros?\b/.test(t)) return "EUR";
  if (/£|\bgbp\b|\bpounds?\b|\bsterling\b/.test(t)) return "GBP";
  if (/₹|\binr\b|\brupees?\b|\brs\.?\b/.test(t)) return "INR";
  if (/¥|\bjpy\b|\byen\b/.test(t)) return "JPY";
  if (/\bkrw\b|\bwon\b/.test(t)) return "KRW";
  if (/\bngn\b|\bnaira\b/.test(t)) return "NGN";
  if (/\baed\b|\bdirhams?\b/.test(t)) return "AED";
  if (/\bchf\b|\bfrancs?\b/.test(t)) return "CHF";
  if (/\bbrl\b|\breais\b|\breal\b/.test(t)) return "BRL";
  if (/\bmxn\b|\bpesos?\b/.test(t)) return "MXN";
  return null;
}
