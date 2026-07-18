/**
 * Deterministic voice → money gates.
 * ASR is probabilistic; settle only after human confirm + these floors.
 */
import { fuzzyContactMatch } from "./voiceNormalize";

/** Floors for review banners — keep lenient so ASR still opens PaymentPing */
export const VOICE_MIN_CONFIDENCE = 0.55;
export const VOICE_MIN_SHAPE = 0.55;
export const VOICE_MIN_CONTACT_SCORE = 0.7;

export type VoiceGateInput = {
  confidence: number;
  shape: number;
  amount?: number;
  recipient?: string;
  contacts: string[];
  /** Production builds refuse auto-enroll of unknown names */
  production?: boolean;
};

export type VoiceGateResult = {
  /** Safe to auto-open intent with spoken fields */
  autoIntent: boolean;
  lowConfidence: boolean;
  unknownContact: boolean;
  contactScore: number;
  reasons: string[];
};

export function evaluateVoiceGate(input: VoiceGateInput): VoiceGateResult {
  const reasons: string[] = [];
  const lowConfidence =
    input.confidence < VOICE_MIN_CONFIDENCE || input.shape < VOICE_MIN_SHAPE;
  if (input.confidence < VOICE_MIN_CONFIDENCE) {
    reasons.push(`confidence ${input.confidence.toFixed(2)} < ${VOICE_MIN_CONFIDENCE}`);
  }
  if (input.shape < VOICE_MIN_SHAPE) {
    reasons.push(`shape ${input.shape.toFixed(2)} < ${VOICE_MIN_SHAPE}`);
  }

  let contactScore = 0;
  let unknownContact = false;
  if (input.recipient) {
    const hit = fuzzyContactMatch(input.recipient, input.contacts);
    contactScore = hit?.score ?? 0;
    const exact = input.contacts.some(
      (c) => c.toLowerCase() === input.recipient!.trim().toLowerCase()
    );
    if (exact) contactScore = Math.max(contactScore, 1);
    if (!exact && contactScore < VOICE_MIN_CONTACT_SCORE) {
      unknownContact = true;
      reasons.push("recipient not a high-confidence enrolled contact");
    }
  } else {
    unknownContact = true;
    reasons.push("no recipient");
  }

  if (!input.amount || input.amount <= 0) {
    reasons.push("no amount");
  }

  const prod = input.production ?? false;
  // In production, unknown contacts never auto-intent (must type / pick enrolled)
  const autoIntent =
    Boolean(input.amount && input.recipient) &&
    !lowConfidence &&
    !(prod && unknownContact) &&
    (!unknownContact || !prod);

  return {
    autoIntent,
    lowConfidence,
    unknownContact,
    contactScore,
    reasons,
  };
}
