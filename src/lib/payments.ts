/**
 * Client-side payment proving — Class 0 witnesses never leave the device.
 */
import { commit, makeProof, randomNonce, sha256, signMessage } from "./crypto";
import { compactBalanceCommit, randomOpeningHex } from "./compactCommit";
import type { ContactRecord, DeviceVaultState } from "./deviceVault";
import { evaluatePolicy } from "./policy";
import {
  inferCurrencyFromUtterance,
  setDisplayCurrency,
  stripCurrencyTokens,
} from "./currency";
import {
  findContactInTranscript,
  fuzzyContactMatch,
  HINGLISH_NAME_TRAILERS,
  isAsrGarbageLabel,
  normalizePersonKey,
  normalizeVoiceTranscript,
  sanitizePersonLabel,
} from "./voiceNormalize";

export type PendingIntent = {
  amount: number;
  recipientLabel: string;
  category: string;
  intentCommitment: string;
  intentNonce: string;
  recipientAddress: string;
  recipientPubkey: string;
  requiresSecondaryConfirm: boolean;
  policyWitness: { templatesChecked: string[]; countersNext: Record<string, number> };
  recipientProof: Awaited<ReturnType<typeof makeProof>>;
  policyProof: Awaited<ReturnType<typeof makeProof>>;
  spendProof: Awaited<ReturnType<typeof makeProof>>;
  oldBalanceCommitment: string;
  newBalanceCommitment: string;
  newBalanceNonce: string;
  newBalanceOpening: string;
  oldBalanceOpening: string;
  newPolicyCommitment: string;
  newPolicyNonce: string;
  spendNullifier: string;
  balanceWitness: {
    oldBalance: number;
    amount: number;
    oldOpening: string;
    newOpening: string;
  };
};

export function findContact(vault: DeviceVaultState, label: string): ContactRecord | undefined {
  const want = normalizePersonKey(label);
  if (!want) return undefined;
  const fuzzy = fuzzyContactMatch(
    label,
    vault.contacts.map((c) => c.label)
  );
  if (fuzzy) {
    return vault.contacts.find((c) => c.label === fuzzy.label);
  }
  return vault.contacts.find((c) => {
    const n = normalizePersonKey(c.label);
    return n === want || n.includes(want) || want.includes(n);
  });
}

/** Multilingual pay verbs + “to” particles */
const PAY_VERBS =
  "pay|send|transfer|enviar|envía|envia|pagar|paga|payer|envoyer|bezahlen|schicken|überweisen|pagare|invia|manda|отправь|переведи|भेजो|भेजिए|भेज|भुगतान|दो|bhejo|bhej|支払|払って|送金|转账|付款|보내|이체";
const TO_PARTICLES = "to|for|a|para|à|au|an|für|per|ко|को|के लिए|に|へ|给|에게|한테";

function cleanRecipient(raw: string): string {
  return sanitizePersonLabel(
    raw
      .replace(/^(?:the|my|a|an|el|la|le|un|une|der|die|das|[.\-]+)\s+/i, "")
      .replace(HINGLISH_NAME_TRAILERS, "")
  );
}

/** Prefer the person token; strip glued Hinglish verbs; fuzzy to enrolled contacts */
function resolveRecipient(
  raw: string | undefined,
  contacts?: string[]
): string | undefined {
  if (!raw) return undefined;
  const cleaned = cleanRecipient(raw);
  if (!cleaned || isAsrGarbageLabel(cleaned)) return undefined;
  const usable = (contacts ?? []).filter((c) => !isAsrGarbageLabel(c));
  if (usable.length) {
    const hit = fuzzyContactMatch(cleaned, usable);
    if (hit) return hit.label;
    const parts = cleaned.split(/\s+/).filter(Boolean);
    for (let n = Math.min(2, parts.length); n >= 1; n--) {
      const slice = parts.slice(0, n).join(" ");
      const m = fuzzyContactMatch(slice, usable);
      if (m) return m.label;
    }
  }
  return cleaned;
}

/** Amount glued to currency words beats stray digits elsewhere in the ASR string */
function extractCurrencyAmount(text: string): number | undefined {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|inr|₹|dollars?|euros?|pounds?)/i,
    /(?:rupees?|rs\.?|inr|₹|dollars?|euros?|pounds?)\s*(\d+(?:\.\d+)?)/i,
    /(?:rs\.?|₹)\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0 && Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

type ParseOpts = { contacts?: string[] };

/**
 * Parse a payment utterance. Applies ASR cleanup + spoken-number conversion,
 * then pattern extraction, then optional contact fuzzy resolution.
 */
export function parseUtterance(
  utterance: string,
  opts?: ParseOpts
): { amount?: number; recipient?: string; cleaned?: string } {
  const inferred = inferCurrencyFromUtterance(utterance);
  if (inferred) setDisplayCurrency(inferred);

  const { display, parse } = normalizeVoiceTranscript(utterance);
  // Keep a currency-aware copy for amount (before stripping "rupees")
  const withCurrency = parse.replace(/,/g, "").replace(/\s+/g, " ").trim();
  const currencyAmount = extractCurrencyAmount(utterance) ?? extractCurrencyAmount(withCurrency);

  const original = stripCurrencyTokens(withCurrency)
    .replace(/\s+/g, " ")
    .trim();
  if (!original) return { cleaned: display };

  const contacts = opts?.contacts;

  // Contact-first: if a known contact is in the text, extract amount around it
  if (contacts?.length) {
    const hit =
      findContactInTranscript(original, contacts) ||
      findContactInTranscript(utterance, contacts);
    if (hit) {
      const withoutName = original
        .split(/\s+/)
        .filter((tok) => {
          const m = fuzzyContactMatch(tok.replace(/[^\p{L}\p{N}]/gu, ""), [hit.label]);
          return !(m && m.score >= 0.62);
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const digit =
        withoutName.match(/(?:^|\s)(\d+(?:\.\d+)?)\b/)?.[1] ||
        original.match(/(\d+(?:\.\d+)?)/)?.[1];
      const amt = currencyAmount ?? (digit ? Number(digit) : undefined);
      if (amt && amt > 0) {
        return {
          amount: amt,
          recipient: hit.label,
          cleaned: display,
        };
      }
    }
  }

  const patterns: Array<() => { amount?: number; recipient?: string } | null> = [
    () => {
      const m = original.match(
        new RegExp(
          `^(?:${PAY_VERBS})\\s+(\\d+(?:\\.\\d+)?)\\s*(?:(?:${TO_PARTICLES})\\s+)?(.+)$`,
          "i"
        )
      );
      return m ? { amount: Number(m[1]), recipient: m[2] } : null;
    },
    () => {
      const m = original.match(
        new RegExp(`^(?:${PAY_VERBS})\\s+(.+?)\\s+(\\d+(?:\\.\\d+)?)$`, "i")
      );
      return m ? { amount: Number(m[2]), recipient: m[1] } : null;
    },
    () => {
      // "Deepa to 1000" / "Deepa 1000" after ko→to normalize
      const m = original.match(
        new RegExp(`^([\\p{L}][\\p{L}\\s.'-]{1,40}?)\\s+(?:${TO_PARTICLES}\\s+)?(\\d+(?:\\.\\d+)?)$`, "iu")
      );
      if (!m) return null;
      const name = cleanRecipient(m[1]);
      if (!name || /^(?:pay|send|transfer)$/i.test(name)) return null;
      return { amount: Number(m[2]), recipient: name };
    },
    () => {
      const m = original.match(
        new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(?:${TO_PARTICLES})\\s+(.+)$`, "i")
      );
      return m ? { amount: Number(m[1]), recipient: m[2] } : null;
    },
    () => {
      // "Janhvi 500" / "to Janhvi 500"
      const m = original.match(
        new RegExp(`^(?:${TO_PARTICLES}\\s+)?(.+?)\\s+(\\d+(?:\\.\\d+)?)$`, "i")
      );
      if (!m) return null;
      const name = cleanRecipient(m[1]);
      if (!name || /^(?:pay|send|transfer)$/i.test(name)) return null;
      if (!/[a-zA-Z\u0900-\u097F]/.test(name)) return null;
      return { amount: Number(m[2]), recipient: name };
    },
    () => {
      const m = original.match(/^(\d+(?:\.\d+)?)\s+([^\d].+)$/);
      return m ? { amount: Number(m[1]), recipient: m[2] } : null;
    },
    () => {
      // Last-resort: first number + remaining alpha tokens as name
      const m = original.match(/(\d+(?:\.\d+)?)/);
      if (!m) return null;
      const amount = Number(m[1]);
      const rest = cleanRecipient(
        original
          .replace(m[0], " ")
          .replace(new RegExp(`\\b(?:${PAY_VERBS}|${TO_PARTICLES})\\b`, "gi"), " ")
          .replace(/\s+/g, " ")
          .trim()
      );
      if (!rest || rest.length < 2) return null;
      return { amount, recipient: rest };
    },
  ];

  for (const tryPat of patterns) {
    const hit = tryPat();
    if (!hit?.amount || !hit.recipient) continue;
    if (!(hit.amount > 0) || !Number.isFinite(hit.amount)) continue;
    const recipient = resolveRecipient(hit.recipient, contacts);
    if (!recipient) continue;
    const amount = currencyAmount && currencyAmount > 0 ? currencyAmount : hit.amount;
    return { amount, recipient, cleaned: display };
  }

  return { cleaned: display };
}

export async function buildIntent(
  vaultIn: DeviceVaultState,
  input: {
    utterance?: string;
    amount?: number;
    recipient?: string;
    category?: string;
    kycRoot: string;
  }
): Promise<{ ok: true; pending: PendingIntent } | { ok: false; reason: string; policyFailed?: boolean }> {
  const { ensureCompactBalanceWitness } = await import("./deviceVault");
  let vault: DeviceVaultState;
  try {
    vault = await ensureCompactBalanceWitness(vaultIn);
  } catch {
    vault = vaultIn;
  }

  let amount = input.amount;
  let recipient = input.recipient;
  if (input.utterance) {
    const parsed = parseUtterance(input.utterance, {
      contacts: vault.contacts.map((c) => c.label),
    });
    amount = amount ?? parsed.amount;
    recipient = recipient ?? parsed.recipient;
  }
  if (!amount || !recipient) {
    return { ok: false, reason: "Could not parse amount and recipient" };
  }

  const contact = findContact(vault, recipient);
  if (!contact) {
    return { ok: false, reason: `No enrolled contact for ${recipient}` };
  }

  if (vault.balance < amount) {
    return { ok: false, reason: "Insufficient private balance" };
  }

  const category = input.category || "general";
  const policyResult = evaluatePolicy(vault.policy, {
    amount,
    category,
    timestamp: Date.now(),
  });
  if (!policyResult.ok) {
    return {
      ok: false,
      reason: policyResult.reason ?? "Policy failed",
      policyFailed: true,
    };
  }

  const intentNonce = randomNonce();
  const intentCommitment = await commit(`${amount}|${contact.address}`, intentNonce);

  const recipientProof = await makeProof(
    "prove_recipient_valid",
    {
      kyc_registry_root: input.kycRoot,
      membership: "1",
      signature_bound: "1",
      contact_commitment: await sha256(contact.address),
      contract: "contracts/nyxpay.compact",
    },
    await sha256(`${contact.leaf}|${contact.enrollmentSig}|${contact.address}`)
  );

  const newBalance = vault.balance - amount;
  const newBalanceNonce = randomNonce();
  const oldOpening = vault.balanceOpening || randomOpeningHex();
  const newBalanceOpening = randomOpeningHex();
  // Public commitment + Compact commitment share the same opening for enterprise vaults
  const newBalanceCommitment = await compactBalanceCommit(newBalance, newBalanceOpening);
  const newPolicyNonce = randomNonce();
  const newPolicyCommitment = await commit(
    JSON.stringify({
      active: vault.policy.active,
      counters: policyResult.updatedCounters,
    }),
    newPolicyNonce
  );

  const policyProof = await makeProof(
    "prove_policy_update",
    {
      old_policy_commitment: vault.policy.commitment,
      new_policy_commitment: newPolicyCommitment,
      templates_active: vault.policy.active.join(","),
      contract: "contracts/nyxpay.compact#prove_policy_update",
      // amount is a Compact private witness — never a public input
    },
    await sha256(JSON.stringify({ counters: policyResult.updatedCounters, amountBound: true }))
  );

  const spendNullifier = await sha256(`balnf:${vault.balanceCommitment}`);
  const spendProof = await makeProof(
    "prove_spend_update",
    {
      old_balance_commitment: vault.balanceCommitment,
      new_balance_commitment: newBalanceCommitment,
      recipient_proof_digest: recipientProof.proof,
      nullifier: spendNullifier,
      contract: "contracts/nyxpay.compact#prove_spend_update",
    },
    await sha256(`${vault.balanceNonce}|${amount}|${newBalanceNonce}`)
  );

  return {
    ok: true,
    pending: {
      amount,
      recipientLabel: contact.label,
      category,
      intentCommitment,
      intentNonce,
      recipientAddress: contact.address,
      recipientPubkey: contact.recipientPubkey,
      requiresSecondaryConfirm: policyResult.requiresSecondaryConfirm ?? false,
      policyWitness: {
        templatesChecked: vault.policy.active,
        countersNext: policyResult.updatedCounters,
      },
      recipientProof,
      policyProof,
      spendProof,
      oldBalanceCommitment: vault.balanceCommitment,
      newBalanceCommitment,
      newBalanceNonce,
      newBalanceOpening,
      oldBalanceOpening: oldOpening,
      newPolicyCommitment,
      newPolicyNonce,
      spendNullifier,
      balanceWitness: {
        oldBalance: vault.balance,
        amount,
        oldOpening,
        newOpening: newBalanceOpening,
      },
    },
  };
}

export async function signIntent(
  vault: DeviceVaultState,
  intentCommitment: string
): Promise<string> {
  return signMessage(
    vault.keypair.privateKeyJwk,
    intentCommitment,
    vault.userId,
    vault.keypair.pubkey
  );
}
