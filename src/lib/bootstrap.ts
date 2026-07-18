/**
 * Production demo bootstrap — all Class 0 secrets created on-device.
 */
import {
  commit,
  encryptNoteToRecipient,
  randomNonce,
  sha256,
  signMessage,
} from "./crypto";
import {
  applyCredit,
  applySpend,
  clearAllVaults,
  createFreshVault,
  loadVault,
  saveVault,
  type ContactRecord,
  type DeviceVaultState,
} from "./deviceVault";
import { buildIntent, signIntent } from "./payments";
import { provePaymentSessionAuth } from "./nyxproof";
import { decryptNoteFromSender } from "./crypto";
import { deviceId, saveSession, type PublicUser } from "./api";
import { bindDeviceKeysToUser } from "./keyStore";

async function registerAccount(
  input: {
    displayName: string;
    documentRef: string;
    vault: Omit<DeviceVaultState, "userId" | "credentialCommitment" | "kycNullifier"> & {
      userId?: string;
      credentialCommitment?: string;
      kycNullifier?: string;
    };
  },
  opts?: { activate?: boolean }
): Promise<{
  user: PublicUser;
  kyc: { commitment: string; nullifier: string; registryRoot: string };
  vaultState: DeviceVaultState;
}> {
  const documentReferenceHash = await sha256(`docref:${input.documentRef}`);
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: input.displayName,
      documentReferenceHash,
      jurisdiction: "IN",
      deviceId: deviceId(),
      publicKeyJwk: input.vault.keypair.publicKeyJwk,
      balanceCommitment: input.vault.balanceCommitment,
      policyCommitment: input.vault.policy.commitment,
      policyActive: input.vault.policy.active,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "register failed");

  // Keys were sealed under tmp-* during provisionalVault — rebind to server userId
  const fromUserId = input.vault.userId;
  const bound = await bindDeviceKeysToUser({
    fromUserId,
    toUserId: data.user.id,
    pubkey: input.vault.keypair.pubkey,
  });
  if (!bound) {
    throw new Error(
      "Device keystore missing after register — refresh and re-onboard to regenerate Class 0 keys"
    );
  }

  const vaultState: DeviceVaultState = {
    version: 3,
    userId: data.user.id,
    displayName: input.displayName,
    keypair: {
      ...input.vault.keypair,
      sealed: true,
      keyRef: input.vault.keypair.keyRef || `pk:${input.vault.keypair.pubkey}`,
      privateKeyJwk: undefined,
      encPrivateKeyJwk: undefined,
    },
    balance: input.vault.balance,
    balanceNonce: input.vault.balanceNonce,
    balanceCommitment: input.vault.balanceCommitment,
    policy: input.vault.policy,
    contacts: input.vault.contacts ?? [],
    credentialCommitment: data.kyc.commitment,
    kycNullifier: data.kyc.nullifier,
    viewKey: data.selectiveDisclosure?.viewKey,
  };
  await saveVault(vaultState, { activate: opts?.activate !== false });
  return { user: data.user, kyc: data.kyc, vaultState };
}

async function provisionalVault(displayName: string, balance: number) {
  // Temporary id until server assigns real id
  const tmp = await createFreshVault({
    userId: `tmp-${randomNonce(4)}`,
    displayName,
    credentialCommitment: "pending",
    kycNullifier: "pending",
    initialBalance: balance,
  });
  return tmp;
}

export async function bootstrapProductionDemo(opts?: { documentRef?: string }): Promise<{
  user: PublicUser;
  peer: PublicUser;
  vault: DeviceVaultState;
}> {
  clearAllVaults();

  const aliceTmp = await provisionalVault("You", 100_000);
  const peerTmp = await provisionalVault("Janhvi", 250_000);

  // Register peer first (device-generated keys) — do not activate peer vault
  let peerReg: Awaited<ReturnType<typeof registerAccount>>;
  try {
    peerReg = await registerAccount(
      {
        displayName: "Janhvi",
        documentRef: `aadhaar-peer-Janhvi-${Date.now()}`,
        vault: peerTmp,
      },
      { activate: false }
    );
  } catch {
    peerReg = await registerAccount(
      {
        displayName: `Janhvi ${String(Date.now()).slice(-4)}`,
        documentRef: `aadhaar-peer-Janhvi-${Date.now()}`,
        vault: peerTmp,
      },
      { activate: false }
    );
  }

  const aliceReg = await registerAccount({
    displayName: `You ${String(Date.now()).slice(-4)}`,
    documentRef: opts?.documentRef ?? `aadhaar-demo-${Date.now()}`,
    vault: aliceTmp,
  });

  // Enrollment: Janhvi signs contact card on-device
  const address = await sha256(`addr:${peerReg.vaultState.keypair.pubkey}`);
  const displayContext = "Janhvi";
  const message = `${displayContext}|${address}`;
  const enrollmentSig = await signMessage(
    peerReg.vaultState.keypair.privateKeyJwk,
    message,
    peerReg.vaultState.userId,
    peerReg.vaultState.keypair.pubkey
  );

  const janhvi: ContactRecord = {
    label: "Janhvi",
    address,
    recipientPubkey: peerReg.vaultState.keypair.pubkey,
    recipientPublicKeyJwk: peerReg.vaultState.keypair.publicKeyJwk,
    recipientEncPublicKeyJwk: peerReg.vaultState.keypair.encPublicKeyJwk,
    displayContext,
    enrollmentSig,
    leaf: peerReg.kyc.commitment,
    note: "Primary demo contact",
    addedAt: Date.now(),
  };

  let aliceVault: DeviceVaultState = {
    ...aliceReg.vaultState,
    contacts: [janhvi],
    demoPeerVaults: {
      [peerReg.user.id]: peerReg.vaultState,
    },
  };

  // Seed a fuller Class 0 contact list (on-device only)
  const DEMO_CONTACTS = [
    { name: "Arjun", note: "College" },
    { name: "Meera", note: "Family" },
    { name: "Priya", note: "Work" },
    { name: "Rahul", note: "Gym" },
    { name: "Ananya", note: "Design" },
    { name: "Kabir", note: "Travel" },
    { name: "Sara", note: "Neighbours" },
    { name: "Dev", note: "Startup" },
    { name: "Nisha", note: "School" },
  ];
  for (const c of DEMO_CONTACTS) {
    aliceVault = await ensurePayableContact(aliceVault, c.name);
    const row = aliceVault.contacts.find((x) => x.label.toLowerCase() === c.name.toLowerCase());
    if (row) {
      row.note = c.note;
      row.addedAt = Date.now();
    }
  }
  await saveVault(aliceVault);
  await saveVault(peerReg.vaultState, { activate: false });
  saveSession(aliceReg.user.id);

  return { user: aliceReg.user, peer: peerReg.user, vault: aliceVault };
}

export async function ensurePayableContact(
  vault: DeviceVaultState,
  label: string
): Promise<DeviceVaultState> {
  const { sanitizePersonLabel, isAsrGarbageLabel } = await import("./voiceNormalize");
  // Never persist ASR junk like "Deepak bhej dijiye" as a contact
  const clean = sanitizePersonLabel(label.trim().replace(/\s+/g, " "));
  if (!clean || isAsrGarbageLabel(clean)) {
    throw new Error("Could not understand recipient name — say the name clearly");
  }

  const existing = vault.contacts.find(
    (c) => c.label.toLowerCase() === clean.toLowerCase()
  );
  if (existing) return vault;

  const peerTmp = await createFreshVault({
    userId: `tmp-peer-${randomNonce(4)}`,
    displayName: clean,
    credentialCommitment: "pending",
    kycNullifier: "pending",
    initialBalance: 250_000,
  });

  let peerReg: Awaited<ReturnType<typeof registerAccount>>;
  try {
    peerReg = await registerAccount(
      {
        displayName: clean,
        documentRef: `aadhaar-peer-${clean}-${Date.now()}`,
        vault: peerTmp,
      },
      { activate: false }
    );
  } catch {
    peerReg = await registerAccount(
      {
        displayName: `${clean} ${String(Date.now()).slice(-4)}`,
        documentRef: `aadhaar-peer-${clean}-${Date.now()}`,
        vault: peerTmp,
      },
      { activate: false }
    );
  }

  const address = await sha256(`addr:${peerReg.vaultState.keypair.pubkey}`);
  const displayContext = clean;
  const enrollmentSig = await signMessage(
    peerReg.vaultState.keypair.privateKeyJwk,
    `${displayContext}|${address}`,
    peerReg.vaultState.userId,
    peerReg.vaultState.keypair.pubkey
  );

  const contact: ContactRecord = {
    label: clean,
    address,
    recipientPubkey: peerReg.vaultState.keypair.pubkey,
    recipientPublicKeyJwk: peerReg.vaultState.keypair.publicKeyJwk,
    recipientEncPublicKeyJwk: peerReg.vaultState.keypair.encPublicKeyJwk,
    displayContext,
    enrollmentSig,
    leaf: peerReg.kyc.commitment,
    addedAt: Date.now(),
  };

  const next: DeviceVaultState = {
    ...vault,
    contacts: [...vault.contacts.filter((c) => c.label.toLowerCase() !== clean.toLowerCase()), contact],
    demoPeerVaults: {
      ...(vault.demoPeerVaults ?? {}),
      [peerReg.user.id]: peerReg.vaultState,
    },
  };
  await saveVault(next);
  await saveVault(peerReg.vaultState, { activate: false });
  return next;
}

export async function clientIntent(
  userId: string,
  payload: { utterance?: string; amount?: number; recipient?: string; category?: string }
) {
  let vault = await loadVault(userId);
  if (!vault) throw new Error("Device vault locked or missing — Class 0 required");

  // Resolve recipient early so we can auto-enroll unknown names on-device
  const { parseUtterance, findContact, buildIntent } = await import("./payments");
  let amount = payload.amount;
  let recipient = payload.recipient;
  if (payload.utterance) {
    const parsed = parseUtterance(payload.utterance, {
      contacts: vault.contacts.map((c) => c.label),
    });
    amount = amount ?? parsed.amount;
    recipient = recipient ?? parsed.recipient;
  }
  if (!amount || !recipient) {
    return { ok: false as const, reason: "Say an amount and a name" };
  }
  if (!findContact(vault, recipient)) {
    // Production builds refuse auto-enroll (pay-anyone only in soft/dev demos).
    const strictContacts =
      import.meta.env.VITE_STRICT_CONTACTS === "1" ||
      (import.meta.env.PROD && import.meta.env.VITE_STRICT_CONTACTS !== "0");
    if (strictContacts) {
      return {
        ok: false as const,
        reason: "Unknown recipient — enroll this contact before paying",
      };
    }
    vault = await ensurePayableContact(vault, recipient.trim());
  }

  const ctx = await fetch(`/api/users/${userId}/prove-context`).then((r) => r.json());
  return buildIntent(vault, {
    amount,
    recipient,
    category: payload.category || "general",
    kycRoot: ctx.kycRoot,
  });
}

export async function clientConfirm(
  userId: string,
  pending: Awaited<ReturnType<typeof buildIntent>>,
  opts?: { note?: string }
) {
  if (!pending.ok) throw new Error(pending.reason);
  const vault = await loadVault(userId);
  if (!vault) throw new Error("Device vault missing");

  const signature = await signIntent(vault, pending.pending.intentCommitment);
  const contact = vault.contacts.find((c) => c.label === pending.pending.recipientLabel);
  if (!contact) throw new Error("Contact missing");

  const { maybeIssueTravelRuleDisclosure } = await import("./travelRule");
  const travel = await maybeIssueTravelRuleDisclosure({
    amount: pending.pending.amount,
    userId,
    intentCommitment: pending.pending.intentCommitment,
  });

  const ctx = await fetch(`/api/users/${userId}/prove-context`).then((r) => r.json());
  const { sessionProof, timeWindow } = await provePaymentSessionAuth(
    vault,
    pending.pending.intentCommitment,
    ctx.kycRoot
  );

  const notePayload = {
    amount: pending.pending.amount,
    fromCommitment: vault.credentialCommitment,
    memo: opts?.note?.trim() || "circled-transfer",
  };
  const encrypted = await encryptNoteToRecipient(
    contact.recipientEncPublicKeyJwk,
    notePayload
  );
  const noteCommitment = await commit(
    JSON.stringify({ amount: pending.pending.amount, to: contact.recipientPubkey }),
    randomNonce()
  );

  const res = await fetch(`/api/users/${userId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intentCommitment: pending.pending.intentCommitment,
      signature,
      spendNullifier: pending.pending.spendNullifier,
      oldBalanceCommitment: pending.pending.oldBalanceCommitment,
      newBalanceCommitment: pending.pending.newBalanceCommitment,
      newPolicyCommitment: pending.pending.newPolicyCommitment,
      recipientPubkey: pending.pending.recipientPubkey,
      recipientProof: pending.pending.recipientProof,
      policyProof: pending.pending.policyProof,
      spendProof: pending.pending.spendProof,
      sessionAuth: sessionProof,
      sessionAuthTimeWindow: timeWindow,
      balanceWitness: pending.pending.balanceWitness,
      encryptedNote: {
        ephemeralPublicKeyJwk: encrypted.ephemeralPublicKeyJwk,
        ciphertext: encrypted.ciphertext,
        noteCommitment,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.reason || data.error || "Settlement failed");

  // Apply Class 0 spend locally — must reuse the same openings submitted to the server.
  // If this fails after server commit, surface a recovery error (do not silent-desync).
  let next: DeviceVaultState;
  try {
    next = await applySpend(
      vault,
      pending.pending.amount,
      pending.pending.policyWitness.countersNext,
      {
        balanceNonce: pending.pending.newBalanceNonce,
        balanceOpening: pending.pending.newBalanceOpening,
        balanceCommitment: pending.pending.newBalanceCommitment,
        policyNonce: pending.pending.newPolicyNonce,
        policyCommitment: pending.pending.newPolicyCommitment,
      },
      {
        recipient: pending.pending.recipientLabel,
        category: pending.pending.category || "general",
      }
    );
  } catch (e) {
    throw new Error(
      `Settled on ledger but device vault failed to apply — reload and check balance. ${
        e instanceof Error ? e.message : ""
      }`.trim()
    );
  }

  // Demo: auto-claim into matching peer vault if present on device
  const peerEntry = Object.entries(next.demoPeerVaults ?? {}).find(
    ([, v]) => v.keypair.pubkey === contact.recipientPubkey
  );
  if (peerEntry) {
    try {
      await claimNotesForPeer(peerEntry[0], peerEntry[1]);
      const refreshed = await loadVault(userId);
      if (refreshed) Object.assign(next, refreshed);
    } catch {
      /* peer claim best-effort in same-browser demo */
    }
  }

  return { ...data, vault: next, sessionProof, travelRule: travel };
}

async function claimNotesForPeer(peerUserId: string, peerVault: DeviceVaultState) {
  const list = await fetch(`/api/users/${peerUserId}/notes`).then((r) => r.json());
  let vault = peerVault;
  for (const note of list.notes ?? []) {
    const payload = (await decryptNoteFromSender(
      vault.keypair.encPrivateKeyJwk,
      note.ephemeralPublicKeyJwk,
      note.ciphertext,
      peerUserId
    )) as { amount: number };
    // decryptNoteFromSender resolves via userId; peer keys also aliased under pubkey via bind
    vault = await applyCredit(vault, Number(payload.amount));
    await fetch(`/api/users/${peerUserId}/notes/${note.id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newBalanceCommitment: vault.balanceCommitment }),
    });
  }
  await saveVault(vault, { activate: false });
  const payerId = localStorage.getItem("circled_user_id");
  if (!payerId) return;
  const aliceVault = await loadVault(payerId);
  if (aliceVault?.demoPeerVaults) {
    aliceVault.demoPeerVaults[peerUserId] = vault;
    await saveVault(aliceVault);
  }
}
