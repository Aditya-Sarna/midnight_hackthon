/**
 * Low-latency, high-accuracy Web Speech helper.
 * Stitches alternatives, scores with contacts, stabilizes before commit.
 */
import {
  detectLocaleFromText,
  localeFromSpeechTag,
  speechTagForLocale,
  type UiLocale,
} from "./i18n";
import { looksLikeCreditUtterance, parseCreditUtterance } from "./creditVoice";
import { parseUtterance } from "./payments";
import { VOICE_MIN_CONFIDENCE, VOICE_MIN_SHAPE } from "./voiceGate";
import {
  findContactInTranscript,
  isAsrGarbageLabel,
  normalizeVoiceTranscript,
  paymentShapeScore,
  sanitizePersonLabel,
} from "./voiceNormalize";

export type VoiceFinal = {
  transcript: string;
  confidence: number;
  /** Payment-shape score 0–1 from normalize / stitch */
  shape: number;
  lang: string;
  uiLocale: UiLocale;
  amount?: number;
  recipient?: string;
  /** Alternate recipient hypotheses from ASR */
  recipientCandidates: string[];
  /** True when confidence/shape below settle floors */
  lowConfidence: boolean;
};

export type VoiceListenHandle = {
  stop: () => void;
};

const SPEECH_LANG_KEY = "circled:speechLang";

/** Device languages first, then a broad fallback set for multilingual use */
export function preferredSpeechLangs(): string[] {
  const fromNav = [
    ...(typeof navigator !== "undefined" ? navigator.languages ?? [] : []),
    typeof navigator !== "undefined" ? navigator.language : "",
  ].filter(Boolean) as string[];
  const stored =
    typeof localStorage !== "undefined" ? localStorage.getItem(SPEECH_LANG_KEY) : null;
  const fallbacks = [
    "en-US",
    "en-IN",
    "en-GB",
    "hi-IN",
    "es-ES",
    "es-MX",
    "fr-FR",
    "de-DE",
    "pt-BR",
    "ar-SA",
    "ja-JP",
    "zh-CN",
    "ko-KR",
    "it-IT",
    "nl-NL",
    "tr-TR",
    "ru-RU",
    "bn-IN",
    "ta-IN",
    "te-IN",
    "mr-IN",
    "gu-IN",
    "kn-IN",
    "ml-IN",
    "pa-IN",
  ];
  return [...new Set([stored, ...fromNav, ...fallbacks].filter(Boolean) as string[])];
}

export function getSpeechLang(): string {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(SPEECH_LANG_KEY);
    if (stored) return stored;
  }
  return preferredSpeechLangs()[0] || "en-US";
}

export function setSpeechLang(lang: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SPEECH_LANG_KEY, lang);
  }
}

export function speechRecognitionAvailable(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

type Stitched = {
  raw: string;
  display: string;
  confidence: number;
  isFinal: boolean;
  amount?: number;
  recipient?: string;
  shape: number;
};

function scoreHypothesis(
  text: string,
  confidence: number,
  contacts: string[]
): { display: string; amount?: number; recipient?: string; shape: number; score: number } {
  const { display, parse } = normalizeVoiceTranscript(text);
  // Credit commands are not payment-shaped — boost so ASR stitch prefers them
  if (looksLikeCreditUtterance(text) || looksLikeCreditUtterance(parse)) {
    const credit = parseCreditUtterance(text) ?? parseCreditUtterance(parse);
    const shape = credit ? 0.92 : 0.75;
    const score =
      shape * 0.72 + Math.min(1, Math.max(0, confidence)) * 0.28 + (credit ? 0.1 : 0);
    return {
      display: credit?.cleaned || display,
      amount: credit?.kind === "borrow" ? credit.loanAmount : undefined,
      recipient: undefined,
      shape,
      score,
    };
  }
  const parsed = parseUtterance(parse, { contacts });
  const contactHit = Boolean(
    parsed.recipient &&
      contacts.some((c) => c.toLowerCase() === parsed.recipient!.toLowerCase())
  ) || Boolean(findContactInTranscript(parse, contacts));
  const shape = paymentShapeScore(parse, parsed, contactHit);
  // Prefer engine confidence only as a tie-breaker once shape is good
  const score = shape * 0.72 + Math.min(1, Math.max(0, confidence)) * 0.28 + (contactHit ? 0.08 : 0);
  return {
    display: parsed.cleaned || display,
    amount: parsed.amount,
    recipient: parsed.recipient,
    shape,
    score,
  };
}

/**
 * For each result index, pick the best alternative (contact + parse aware),
 * then stitch segments. Also try swapping only the last segment's alts.
 */
export function stitchBestTranscript(
  results: SpeechRecognitionResultList,
  contacts: string[] = []
): Stitched {
  if (!results.length) {
    return { raw: "", display: "", confidence: 0, isFinal: false, shape: 0 };
  }

  const pickRow = (row: SpeechRecognitionResult) => {
    let best = {
      text: "",
      confidence: 0,
      score: -1,
      display: "",
      amount: undefined as number | undefined,
      recipient: undefined as string | undefined,
      shape: 0,
    };
    for (let a = 0; a < row.length; a++) {
      const alt = row[a];
      const text = String(alt.transcript || "").trim();
      if (!text) continue;
      const conf = typeof alt.confidence === "number" && alt.confidence > 0 ? alt.confidence : 0.55;
      const hyp = scoreHypothesis(text, conf, contacts);
      if (hyp.score > best.score) {
        best = {
          text,
          confidence: conf,
          score: hyp.score,
          display: hyp.display,
          amount: hyp.amount,
          recipient: hyp.recipient,
          shape: hyp.shape,
        };
      }
    }
    return best;
  };

  // Baseline: best alt per row, concatenated
  const parts: ReturnType<typeof pickRow>[] = [];
  let allFinal = true;
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    if (!row.isFinal) allFinal = false;
    parts.push(pickRow(row));
  }

  const joinRaw = parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
  const avgConf =
    parts.reduce((s, p) => s + p.confidence, 0) / Math.max(1, parts.length);
  let best = {
    ...scoreHypothesis(joinRaw, avgConf, contacts),
    raw: joinRaw,
    confidence: avgConf,
    isFinal: allFinal,
  };

  // Explore last-row alternatives against frozen prefix (big accuracy win)
  if (results.length >= 1) {
    const last = results[results.length - 1];
    const prefix = parts
      .slice(0, -1)
      .map((p) => p.text)
      .join(" ")
      .trim();
    for (let a = 0; a < last.length; a++) {
      const altText = String(last[a].transcript || "").trim();
      if (!altText) continue;
      const conf =
        typeof last[a].confidence === "number" && last[a].confidence > 0
          ? last[a].confidence
          : 0.55;
      const raw = `${prefix} ${altText}`.replace(/\s+/g, " ").trim();
      const hyp = scoreHypothesis(raw, conf, contacts);
      const score = hyp.score;
      if (score > best.score) {
        best = {
          ...hyp,
          raw,
          confidence: conf,
          isFinal: allFinal,
        };
      }
    }
  }

  return {
    raw: best.raw,
    display: best.display,
    confidence: best.confidence,
    isFinal: best.isFinal,
    amount: best.amount,
    recipient: best.recipient,
    shape: best.shape,
  };
}

export function startVoiceListen(handlers: {
  onInterim?: (text: string, uiLocale: UiLocale) => void;
  onFinal: (result: VoiceFinal) => void;
  onError?: (reason: string) => void;
  timeoutMs?: number;
  lang?: string;
  /** Known contact labels — strongly improves name accuracy */
  contacts?: string[];
}): VoiceListenHandle {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    handlers.onError?.("unavailable");
    return { stop: () => undefined };
  }

  const contacts = handlers.contacts ?? [];
  let lang = handlers.lang || getSpeechLang();
  const rec = new SR();
  let stopped = false;
  let finalized = false;
  let lastHeard: Stitched = {
    raw: "",
    display: "",
    confidence: 0,
    isFinal: false,
    shape: 0,
  };
  let switchedLang = false;
  let endRestarts = 0;
  let stableTimer: number | undefined;
  let silenceTimer: number | undefined;
  let lastStableKey = "";

  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 8;
  // Short commands: non-continuous is usually more accurate on Chrome
  rec.continuous = false;

  const clearTimers = () => {
    if (stableTimer != null) window.clearTimeout(stableTimer);
    if (silenceTimer != null) window.clearTimeout(silenceTimer);
    stableTimer = undefined;
    silenceTimer = undefined;
  };

  const finish = (stitched: Stitched) => {
    if (finalized || stopped) return;
    finalized = true;
    stopped = true;
    clearTimers();
    window.clearTimeout(hardTimer);
    try {
      rec.stop();
    } catch {
      /* ignore */
    }

    const textForParse = stitched.display || stitched.raw;
    const parsed = parseUtterance(textForParse, { contacts });
    const amount = parsed.amount ?? stitched.amount;
    const recipientRaw = parsed.recipient ?? stitched.recipient;
    const recipient = recipientRaw
      ? sanitizePersonLabel(recipientRaw) || recipientRaw
      : undefined;
    const uiLocale = detectLocaleFromText(stitched.raw || textForParse, lang);
    const speechTag = speechTagForLocale(uiLocale);
    setSpeechLang(speechTag);

    const recipientCandidates = [
      ...new Set(
        [recipient, stitched.recipient, ...(contacts || [])]
          .filter(Boolean)
          .map((r) => sanitizePersonLabel(String(r).trim()) || String(r).trim())
          .filter((r) => r.length > 0 && !isAsrGarbageLabel(r))
      ),
    ].slice(0, 5);

    const lowConfidence =
      stitched.confidence < VOICE_MIN_CONFIDENCE || stitched.shape < VOICE_MIN_SHAPE;

    handlers.onFinal({
      transcript: parsed.cleaned || stitched.display || stitched.raw,
      confidence: stitched.confidence,
      shape: stitched.shape,
      lang: speechTag,
      uiLocale,
      amount,
      recipient,
      recipientCandidates,
      lowConfidence,
    });
  };

  const scheduleStableCommit = (stitched: Stitched) => {
    if (!(stitched.amount && stitched.recipient)) return;
    const key = `${stitched.amount}|${stitched.recipient.toLowerCase()}`;
    if (key !== lastStableKey) {
      lastStableKey = key;
      if (stableTimer != null) window.clearTimeout(stableTimer);
      // Wait for ASR to settle — avoids locking bad interim text
      const wait = stitched.isFinal ? 120 : stitched.confidence >= 0.75 ? 380 : 560;
      stableTimer = window.setTimeout(() => {
        if (finalized) return;
        // Re-check lastHeard still matches
        if (
          lastHeard.amount === stitched.amount &&
          lastHeard.recipient?.toLowerCase() === stitched.recipient?.toLowerCase()
        ) {
          finish(lastHeard);
        }
      }, wait);
    }
  };

  const scheduleSilenceFinalize = () => {
    if (silenceTimer != null) window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      if (finalized) return;
      if (lastHeard.amount && lastHeard.recipient && lastHeard.shape >= 0.45) {
        finish(lastHeard);
      }
    }, 720);
  };

  const hardTimer = window.setTimeout(() => {
    if (finalized) return;
    if (lastHeard.raw) {
      finish(lastHeard);
      return;
    }
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, handlers.timeoutMs ?? 12_000);

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    if (finalized) return;
    const stitched = stitchBestTranscript(ev.results, contacts);
    if (!stitched.raw && !stitched.display) return;
    lastHeard = stitched;

    const heardLocale = detectLocaleFromText(stitched.raw, lang);
    handlers.onInterim?.(stitched.display || stitched.raw, heardLocale);

    // Hot-switch engine language only on strong non-Latin script mismatch
    const engineLocale = localeFromSpeechTag(lang);
    if (
      !switchedLang &&
      !stitched.isFinal &&
      heardLocale !== engineLocale &&
      /[\u0900-\u0D7F\u0600-\u06FF\u3040-\u30FF\uAC00-\uD7AF\u4E00-\u9FFF\u0400-\u04FF]/.test(
        stitched.raw
      )
    ) {
      switchedLang = true;
      lang = speechTagForLocale(heardLocale);
      try {
        rec.stop();
        rec.lang = lang;
        window.setTimeout(() => {
          if (!finalized && !stopped) {
            try {
              rec.start();
            } catch {
              /* ignore */
            }
          }
        }, 60);
      } catch {
        /* ignore */
      }
      return;
    }

    if (stitched.amount && stitched.recipient) {
      scheduleStableCommit(stitched);
      scheduleSilenceFinalize();
    }

    // Engine-final: commit quickly once amount + name parse
    if (stitched.isFinal && stitched.amount && stitched.recipient && stitched.shape >= 0.45) {
      if (stableTimer != null) window.clearTimeout(stableTimer);
      stableTimer = window.setTimeout(() => finish(stitched), 80);
      return;
    }

    if (stitched.isFinal && stitched.raw) {
      // Final but incomplete — still emit after a short beat (user may have trailed off)
      scheduleSilenceFinalize();
    }
  };

  rec.onerror = (ev: Event & { error?: string }) => {
    if (finalized) return;
    const err = ev.error || "error";
    if (err === "aborted") {
      return;
    }
    if (err === "no-speech") {
      clearTimers();
      window.clearTimeout(hardTimer);
      if (lastHeard.raw) {
        finish(lastHeard);
        return;
      }
      handlers.onError?.(err);
      return;
    }
    clearTimers();
    window.clearTimeout(hardTimer);
    handlers.onError?.(err);
  };

  rec.onend = () => {
    // Chrome ends after a phrase when continuous=false — finalize if we have a parse
    if (finalized || stopped) return;
    if (lastHeard.amount && lastHeard.recipient) {
      finish(lastHeard);
      return;
    }
    if (lastHeard.raw && endRestarts < 1) {
      // One restart to catch a delayed continuation (user still speaking)
      endRestarts += 1;
      try {
        rec.start();
        return;
      } catch {
        /* fall through */
      }
    }
    if (lastHeard.raw) finish(lastHeard);
  };

  try {
    rec.start();
  } catch {
    window.clearTimeout(hardTimer);
    handlers.onError?.("start_failed");
  }

  return {
    stop: () => {
      stopped = true;
      clearTimers();
      window.clearTimeout(hardTimer);
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
