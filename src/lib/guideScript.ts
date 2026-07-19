/**
 * Judge-tour script — a text friend walks mentors through ease-of-use,
 * the full payment cycle, and Midnight/ZK concepts in plain language.
 */

export type GuideConceptBox = {
  title: string;
  body: string;
  tag?: "device" | "midnight" | "zk" | "privacy";
};

export type GuideAction =
  | { type: "idle" }
  | { type: "openApp" }
  | { type: "runPayment"; utterance: string }
  | { type: "confirm" }
  | { type: "highlightTheater"; focus: string };

export type GuideStep = {
  id: string;
  /** Friend chat line — short, spoken tone */
  say: string;
  /** Optional concept cards under the chat */
  boxes?: GuideConceptBox[];
  /** What the phone / theater should do when this step advances */
  action?: GuideAction;
  /** Theater stage id to emphasize */
  theaterFocus?: "kyc" | "recv" | "pol" | "spend" | "nyxproof" | "ledger" | null;
  /** Wait for wallet phase before allowing Next (optional) */
  waitFor?: "ping" | "settled" | "app" | "home";
  /** Auto-advance delay when Autoplay is on (ms) */
  autoMs?: number;
};

export const GUIDE_FRIEND_NAME = "Circle";

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "hello",
    say: "Hey — I’m Circle. I’ll walk you through the app. You don’t need to know ZK. Just tap Next, or hit Autoplay and watch.",
    boxes: [
      {
        title: "What you’re looking at",
        body: "Left: me. Center: the phone app people use. Right: Midnight proofs lighting up as we go.",
        tag: "device",
      },
    ],
    action: { type: "idle" },
    autoMs: 4200,
  },
  {
    id: "class0",
    say: "First rule of Circle: secrets never leave this phone. Balance, contacts, keys — Class 0, device-only.",
    boxes: [
      {
        title: "Class 0 — device vault",
        body: "Private key, balance, policy params, contact list stay on-device. The public ledger never sees preimages — only commitments and nullifiers.",
        tag: "privacy",
      },
      {
        title: "What the server holds",
        body: "Only commitments, nullifiers, KYC leaves, and encrypted notes — never the preimages.",
        tag: "midnight",
      },
    ],
    theaterFocus: "kyc",
    autoMs: 5000,
  },
  {
    id: "kyc",
    say: "At signup we did government ZK-KYC. Midnight only learned a Merkle root — not who you are.",
    boxes: [
      {
        title: "kyc_registry_root",
        body: "A single public root. Your leaf is in the tree; the proof shows membership without revealing the leaf.",
        tag: "zk",
      },
      {
        title: "Nullifiers",
        body: "If a credential is revoked, its nullifier hits a public set. No TX history is exposed.",
        tag: "midnight",
      },
    ],
    theaterFocus: "kyc",
    autoMs: 5200,
  },
  {
    id: "open-app",
    say: "Opening Circle on the phone. This is the everyday surface — speak or type a payment.",
    boxes: [
      {
        title: "Ease of use",
        body: "Same gesture as UPI: who + how much. Under the hood we build proofs; the user never sees circuits.",
        tag: "device",
      },
    ],
    action: { type: "openApp" },
    waitFor: "app",
    autoMs: 2800,
  },
  {
    id: "autofill",
    say: "I’ll autofill a real payment: 25 to Janhvi (any currency display works — $, €, £, ₹…). Watch the right panel — proofs will go live.",
    boxes: [
      {
        title: "prove_recipient_valid",
        body: "Janhvi enrolled with a signature. We prove she’s a valid KYC’d contact without naming her on-chain.",
        tag: "zk",
      },
      {
        title: "prove_policy_update",
        body: "Private spend rules (templates T1–T5) are checked in ZK. Policy params never leave the device.",
        tag: "zk",
      },
      {
        title: "prove_spend_update",
        body: "Balance moves as commitments. Amount stays private; a nullifier stops double-spend.",
        tag: "zk",
      },
    ],
    action: { type: "runPayment", utterance: "pay 25 to Janhvi" },
    theaterFocus: "spend",
    waitFor: "ping",
    autoMs: 9000,
  },
  {
    id: "confirm-tap",
    say: "Confirm tap replaces OTP. Circle binds this intent — nothing phishable, nothing to SMS.",
    boxes: [
      {
        title: "Circle · prove_session_auth",
        body: "Device proves it holds a valid KYC credential for this challenge, relying party, and time window. Nonce burns once.",
        tag: "zk",
      },
      {
        title: "vs OTP",
        body: "No code to intercept (SIM-swap / SS7). Same KYC tree Midnight already uses — zero new secrets.",
        tag: "privacy",
      },
    ],
    action: { type: "confirm" },
    theaterFocus: "nyxproof",
    waitFor: "settled",
    autoMs: 7000,
  },
  {
    id: "ledger",
    say: "Done. Ledger shows a generic transfer event — not amount, not parties. That’s Midnight settlement.",
    boxes: [
      {
        title: "Public ledger event",
        body: "Observers see that a valid transfer occurred. They cannot read the amount or “Janhvi”.",
        tag: "midnight",
      },
      {
        title: "Compact path",
        body: "Gold path: Compact execute + proof-server /prove. Look for grade zk-proved on the success screen and Systems Theater.",
        tag: "midnight",
      },
    ],
    theaterFocus: "ledger",
    autoMs: 4800,
  },
  {
    id: "wrap",
    say: "That’s the cycle: voice UX, Circle instead of OTP, Compact spend, zk-proved settle. Pilot-ready on Midnight.",
    boxes: [
      {
        title: "Pitch in one line",
        body: "Confidential voice payments on Midnight — Class 0 on device, Compact proofs for spend, Circle instead of OTP.",
        tag: "device",
      },
    ],
    action: { type: "idle" },
    autoMs: 5000,
  },
];
