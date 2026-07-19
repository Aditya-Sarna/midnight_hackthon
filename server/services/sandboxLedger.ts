/**
 * Server-authoritative sandbox ledger — senders + receiver balances.
 *
 * The universal-adapter demo previously tracked balances in React
 * `useState`. That created two systems of record on top of a real
 * proof/rail pipeline. This module moves both to the server so:
 *   - the browser can never disagree with the pipeline,
 *   - state survives process restart,
 *   - every settle/refund is atomic wrt balance.
 *
 * See docs/CIRCLED_TRUST_SURFACE.md and docs/CIRCLED_MULTI_PERSONA.md.
 */

export type SandboxSender = {
  id: string;
  displayName: string;
  handle: string;
  asset: "INR" | "USD";
  jurisdiction: string;
  /** Per-persona opening balance — restored on reset */
  openingBalance: number;
  balance: number;
  note: string;
};

export type SandboxLedgerPersist = {
  senders: SandboxSender[];
  receiverBalances: Record<string, number>;
};

const DEFAULT_SENDERS: SandboxSender[] = [
  {
    id: "snd_aditya",
    displayName: "Aditya Rao",
    handle: "aditya.in",
    asset: "INR",
    jurisdiction: "IN",
    openingBalance: 25_000,
    balance: 25_000,
    note: "consumer P2P",
  },
  {
    id: "snd_priya",
    displayName: "Priya Nair",
    handle: "priya.in",
    asset: "INR",
    jurisdiction: "IN",
    openingBalance: 250_000,
    balance: 250_000,
    note: "small-biz operator",
  },
  {
    id: "snd_rahul",
    displayName: "Rahul Kim",
    handle: "rahul.us",
    asset: "USD",
    jurisdiction: "US",
    openingBalance: 2_500,
    balance: 2_500,
    note: "US sender · fiat cross",
  },
];

let senders: SandboxSender[] = DEFAULT_SENDERS.map((s) => ({ ...s }));
let receiverBalances = new Map<string, number>();
let onChange: (() => void) | null = null;

export function bindSandboxLedgerPersist(cb: () => void) {
  onChange = cb;
}

function notify() {
  onChange?.();
}

export function listSandboxSenders(): SandboxSender[] {
  return senders.map((s) => ({ ...s }));
}

export function getSandboxSender(id: string): SandboxSender | undefined {
  return senders.find((s) => s.id === id);
}

/** Match a sender by id or by displayName (case-insensitive). Used for demo continuity. */
export function resolveSenderId(idOrName: string | undefined): string {
  if (!idOrName) return senders[0]?.id ?? "snd_aditya";
  const wanted = idOrName.trim().toLowerCase();
  const byId = senders.find((s) => s.id.toLowerCase() === wanted);
  if (byId) return byId.id;
  const byName = senders.find(
    (s) => s.displayName.toLowerCase() === wanted || s.handle.toLowerCase() === wanted
  );
  return byName?.id ?? senders[0]?.id ?? "snd_aditya";
}

export function getReceiverBalance(accountId: string): number {
  return receiverBalances.get(accountId) ?? 0;
}

export function listReceiverBalances(): Record<string, number> {
  return Object.fromEntries(receiverBalances);
}

/** Debit sender by an amount. Throws on insufficient balance — settle must catch. */
export function debitSender(senderId: string, amount: number): SandboxSender {
  const s = getSandboxSender(senderId);
  if (!s) throw new Error(`sandbox sender not found: ${senderId}`);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("debit amount must be positive");
  }
  if (s.balance < amount) {
    throw new Error(
      `insufficient sandbox balance: ${s.displayName} has ${s.asset} ${s.balance}, needs ${amount}`
    );
  }
  s.balance -= amount;
  notify();
  return { ...s };
}

/** Credit receiver by target-asset amount. Creates the row lazily. */
export function creditReceiver(accountId: string, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return getReceiverBalance(accountId);
  const next = getReceiverBalance(accountId) + amount;
  receiverBalances.set(accountId, next);
  notify();
  return next;
}

/** Reverse a settled pair — refund path. */
export function reverseSettlement(input: {
  senderId: string;
  accountId: string;
  senderAmount: number;
  receiverAmount: number;
}): void {
  const s = getSandboxSender(input.senderId);
  if (s) s.balance += Math.max(0, input.senderAmount);
  const cur = getReceiverBalance(input.accountId);
  const next = Math.max(0, cur - Math.max(0, input.receiverAmount));
  receiverBalances.set(input.accountId, next);
  notify();
}

/** Restore all senders to opening balance; wipe receiver balances. */
export function resetSandboxLedger(): void {
  senders = DEFAULT_SENDERS.map((s) => ({ ...s }));
  receiverBalances = new Map();
  notify();
}

export function hydrateSandboxLedger(bucket: SandboxLedgerPersist | undefined): void {
  if (bucket && Array.isArray(bucket.senders) && bucket.senders.length) {
    // Merge persisted balances onto default persona list — new personas we ship
    // later win their opening balance, old personas keep their live balance.
    const map = new Map(bucket.senders.map((s) => [s.id, s] as const));
    senders = DEFAULT_SENDERS.map((d) => {
      const persisted = map.get(d.id);
      return persisted
        ? {
            ...d,
            balance: Number.isFinite(persisted.balance) ? persisted.balance : d.openingBalance,
          }
        : { ...d };
    });
    // Include any extra personas someone persisted that we don't ship (defensive).
    for (const s of bucket.senders) {
      if (!senders.find((x) => x.id === s.id)) senders.push({ ...s });
    }
  } else {
    senders = DEFAULT_SENDERS.map((s) => ({ ...s }));
  }
  receiverBalances = new Map(Object.entries(bucket?.receiverBalances ?? {}));
}

export function exportSandboxLedger(): SandboxLedgerPersist {
  return {
    senders: senders.map((s) => ({ ...s })),
    receiverBalances: Object.fromEntries(receiverBalances),
  };
}
