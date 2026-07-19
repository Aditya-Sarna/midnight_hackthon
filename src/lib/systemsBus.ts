/**
 * Systems theater bus — realtime narrative for Midnight / ZK / backend actions.
 * Screens emit; SystemsTheater animates.
 */

export type SystemsSource =
  | "app"
  | "wallet"
  | "credit"
  | "onboarding"
  | "merchant"
  | "recovery"
  | "director"
  | "zk-demo"
  | "settle"
  | "circledproof";

export type SystemsLayer =
  | "device"
  | "voice"
  | "policy"
  | "compact"
  | "proof-server"
  | "midnight"
  | "pool"
  | "kyc"
  | "relay";

export type SystemsEvent = {
  id: string;
  at: number;
  source: SystemsSource;
  /** Short machine phase id */
  phase: string;
  /** Human headline shown in theater */
  title: string;
  /** One-line explanation of what the backend is doing */
  detail: string;
  layer: SystemsLayer;
  /** Optional circuit names currently proving */
  circuits?: string[];
  /** 0–1 progress hint for animation */
  intensity?: number;
  status?: "idle" | "active" | "proving" | "settled" | "error";
};

export type LiveProofLite = {
  circuit: string;
  proof: string;
  label: string;
  ms?: number;
  snarkDigest?: string;
};

let seq = 0;
export function systemsEventId(): string {
  seq += 1;
  return `sys_${Date.now().toString(36)}_${seq}`;
}

export function makeSystemsEvent(
  partial: Omit<SystemsEvent, "id" | "at"> & { id?: string; at?: number }
): SystemsEvent {
  return {
    id: partial.id ?? systemsEventId(),
    at: partial.at ?? Date.now(),
    source: partial.source,
    phase: partial.phase,
    title: partial.title,
    detail: partial.detail,
    layer: partial.layer,
    circuits: partial.circuits,
    intensity: partial.intensity ?? 0.6,
    status: partial.status ?? "active",
  };
}

/** Map wallet UI phase → theater narrative */
export function narrativeForWalletPhase(
  phase: string,
  opts?: { credit?: boolean }
): Omit<SystemsEvent, "id" | "at"> {
  if (opts?.credit) {
    const creditMap: Record<string, Omit<SystemsEvent, "id" | "at">> = {
      verifying: {
        source: "credit",
        phase: "credit-verify",
        title: "Checking loan terms",
        detail: "Pool liquidity · collateral ≥150% · APR deal packages for the borrower.",
        layer: "pool",
        status: "proving",
        intensity: 0.8,
        circuits: ["prove_collateral_lock", "prove_credit_standing"],
      },
      ping: {
        source: "credit",
        phase: "credit-deals",
        title: "Loan deals ready",
        detail: "Borrower picks a term package. Nothing books until they Accept the APR.",
        layer: "pool",
        status: "active",
        intensity: 0.55,
      },
      settling: {
        source: "credit",
        phase: "collateral-lock",
        title: "Booking loan",
        detail: "prove_collateral_lock · pool debit · disbursement into Class 0 balance.",
        layer: "pool",
        status: "proving",
        intensity: 1,
        circuits: ["prove_collateral_lock"],
      },
      settled: {
        source: "credit",
        phase: "loan-booked",
        title: "Loan booked",
        detail: "Collateral locked · CIRCLE units disbursed · credit_identity updated — not a P2P payment.",
        layer: "pool",
        status: "settled",
        intensity: 0.55,
        circuits: ["prove_collateral_lock", "circled-credit"],
      },
      denied: {
        source: "credit",
        phase: "loan-declined",
        title: "Loan declined",
        detail: "No collateral locked. Pool untouched.",
        layer: "device",
        status: "idle",
        intensity: 0.15,
      },
      error: {
        source: "credit",
        phase: "loan-error",
        title: "Loan booking failed",
        detail: "Fail-closed: collateral, pool liquidity, or Compact witness — no loan opened.",
        layer: "compact",
        status: "error",
        intensity: 0.4,
      },
    };
    if (creditMap[phase]) return creditMap[phase];
  }

  const map: Record<string, Omit<SystemsEvent, "id" | "at">> = {
    home: {
      source: "wallet",
      phase: "home",
      title: "Class 0 vault idle",
      detail: "Balance openings stay on-device. Midnight ledger holds commitments only.",
      layer: "device",
      status: "idle",
      intensity: 0.2,
    },
    app: {
      source: "wallet",
      phase: "app",
      title: "Voice channel open",
      detail: "Web Speech → ASR normalize → intent parse. Nothing settles until Accept.",
      layer: "voice",
      status: "active",
      intensity: 0.4,
    },
    listening: {
      source: "wallet",
      phase: "listening",
      title: "Listening",
      detail: "Capturing utterance · stitching ASR hypotheses · scoring payment vs credit shape.",
      layer: "voice",
      status: "active",
      intensity: 0.7,
    },
    verifying: {
      source: "wallet",
      phase: "verifying",
      title: "Building private proofs",
      detail: "Recipient · policy · spend circuits staged. Amount stays a private witness.",
      layer: "compact",
      status: "proving",
      intensity: 0.85,
      circuits: ["prove_recipient_valid", "prove_policy_update", "prove_spend_update"],
    },
    ping: {
      source: "wallet",
      phase: "ping",
      title: "Human review gate",
      detail: "Proofs ready. Settlement waits for Accept — ASR alone never moves money.",
      layer: "policy",
      status: "active",
      intensity: 0.55,
    },
    settling: {
      source: "wallet",
      phase: "settling",
      title: "Proof-server → Midnight",
      detail: "SNARK prove · nullifier burn · Compact ledger update · optional Circle session.",
      layer: "proof-server",
      status: "proving",
      intensity: 1,
      circuits: ["prove_spend_update", "prove_session_auth"],
    },
    settled: {
      source: "wallet",
      phase: "settled",
      title: "Settlement anchored",
      detail: "Transfer counter advanced. Encrypted note to recipient. Class 0 vault updated locally.",
      layer: "midnight",
      status: "settled",
      intensity: 0.5,
    },
    denied: {
      source: "wallet",
      phase: "denied",
      title: "Intent discarded",
      detail: "No nullifier burned. No ledger write. Proofs dropped.",
      layer: "device",
      status: "idle",
      intensity: 0.15,
    },
    error: {
      source: "wallet",
      phase: "error",
      title: "Proof or policy failed",
      detail: "Fail-closed: commitment mismatch, policy cap, or Compact assert — funds untouched.",
      layer: "compact",
      status: "error",
      intensity: 0.4,
    },
    contacts: {
      source: "wallet",
      phase: "contacts",
      title: "Contact enrollment",
      detail: "Recipient leaf bound to KYC registry. Labels stay on-device.",
      layer: "kyc",
      status: "active",
      intensity: 0.45,
    },
  };
  return (
    map[phase] ?? {
      source: "wallet",
      phase,
      title: phase,
      detail: "Wallet activity",
      layer: "device",
      status: "active",
      intensity: 0.4,
    }
  );
}

export function narrativeForView(view: string): Omit<SystemsEvent, "id" | "at"> {
  const map: Record<string, Omit<SystemsEvent, "id" | "at">> = {
    menu: {
      source: "app",
      phase: "menu",
      title: "Circle systems ready",
      detail: "Midnight Preprod · Compact circuits · Class 0 vault · proof-server path.",
      layer: "midnight",
      status: "idle",
      intensity: 0.25,
    },
    director: {
      source: "director",
      phase: "director",
      title: "Demo director",
      detail: "Bootstrap KYC leaf · fund vault · stage circuits for judge path.",
      layer: "kyc",
      status: "active",
      intensity: 0.5,
    },
    strategy: {
      source: "app",
      phase: "strategy",
      title: "Private strategy",
      detail: "prove_strategy_commitment — weight is a private witness; ledger sees commitment only.",
      layer: "compact",
      status: "active",
      intensity: 0.55,
      circuits: ["prove_strategy_commitment"],
    },
    onboarding: {
      source: "onboarding",
      phase: "onboarding",
      title: "Issuing ZK-KYC",
      detail: "Government-verified identity → Merkle leaf · credential commitment · device vault.",
      layer: "kyc",
      status: "proving",
      intensity: 0.75,
      circuits: ["prove_kyc_membership", "publish_kyc_leaf"],
    },
    credit: {
      source: "credit",
      phase: "credit-idle",
      title: "Circle Credit pool",
      detail: "Same-asset overcollateralized lending. Pool commitment · scoped credit_identity.",
      layer: "pool",
      status: "idle",
      intensity: 0.35,
      circuits: ["prove_collateral_lock", "prove_pool_deposit", "prove_credit_standing"],
    },
    merchant: {
      source: "merchant",
      phase: "merchant",
      title: "Merchant receive rail",
      detail: "JIT destination · reconcile · prove_credit_update · no destination reuse.",
      layer: "relay",
      status: "active",
      intensity: 0.5,
      circuits: ["prove_credit_update"],
    },
    recovery: {
      source: "recovery",
      phase: "recovery",
      title: "Social recovery",
      detail: "Share holders · coordinator · Class 0 re-seal without server holding keys.",
      layer: "device",
      status: "active",
      intensity: 0.55,
    },
    "zk-demo": {
      source: "zk-demo",
      phase: "zk-demo",
      title: "Circuit triptych",
      detail: "Walking Compact proofs as they form — membership · spend · session auth.",
      layer: "compact",
      status: "proving",
      intensity: 0.8,
    },
    loading: {
      source: "app",
      phase: "loading",
      title: "Warming Midnight",
      detail: "Health check · proof-server · Compact ledger replay.",
      layer: "midnight",
      status: "active",
      intensity: 0.6,
    },
  };
  return (
    map[view] ?? {
      source: "app",
      phase: view,
      title: view,
      detail: "Circle runtime",
      layer: "midnight",
      status: "idle",
      intensity: 0.3,
    }
  );
}

export function narrativeForCreditAction(
  action: "deposit" | "borrow" | "repay" | "standing" | "disclose"
): Omit<SystemsEvent, "id" | "at"> {
  const map = {
    deposit: {
      source: "credit" as const,
      phase: "pool-deposit",
      title: "Pool deposit proving",
      detail: "prove_pool_deposit · lender share · no borrower link created.",
      layer: "pool" as const,
      status: "proving" as const,
      intensity: 0.9,
      circuits: ["prove_pool_deposit"],
    },
    borrow: {
      source: "credit" as const,
      phase: "collateral-lock",
      title: "Collateral lock → disbursement",
      detail: "prove_collateral_lock (≥150%) · debit pool · credit_identity bound · APR disclosed.",
      layer: "pool" as const,
      status: "proving" as const,
      intensity: 1,
      circuits: ["prove_collateral_lock", "prove_loan_repayment"],
    },
    repay: {
      source: "credit" as const,
      phase: "loan-repay",
      title: "Installment nullifier",
      detail: "prove_loan_repayment · remaining ↓ · standing on_time++ · scoped to credit_identity.",
      layer: "compact" as const,
      status: "proving" as const,
      intensity: 0.9,
      circuits: ["prove_loan_repayment"],
    },
    standing: {
      source: "credit" as const,
      phase: "credit-standing",
      title: "Standing threshold proof",
      detail: "prove_credit_standing · on_time≥T · defaults≤M · pass/fail only · no numeric score.",
      layer: "compact" as const,
      status: "proving" as const,
      intensity: 0.85,
      circuits: ["prove_credit_standing"],
    },
    disclose: {
      source: "credit" as const,
      phase: "apr-disclose",
      title: "Rate disclosure",
      detail: "APR shown to borrower before Accept. Privacy of amounts ≠ secrecy of rate.",
      layer: "policy" as const,
      status: "active" as const,
      intensity: 0.5,
    },
  };
  return map[action];
}

export const LAYER_LABEL: Record<SystemsLayer, string> = {
  device: "Class 0 device",
  voice: "Voice / ASR",
  policy: "Policy engine",
  compact: "Compact circuits",
  "proof-server": "Proof server",
  midnight: "Midnight network",
  pool: "Credit pool",
  kyc: "ZK-KYC registry",
  relay: "Settlement relay",
};
