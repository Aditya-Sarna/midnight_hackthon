import { useEffect, useMemo, useRef, useState } from "react";
import { PaymentPing, type PaymentEdits } from "../components/PaymentPing";
import { parseUtterance } from "../lib/payments";
import {
  speechRecognitionAvailable,
  startVoiceListen,
  type VoiceListenHandle,
} from "../lib/voice";

type SandboxAccount = {
  id: string;
  displayName: string;
  handle: string;
  preferredAsset: "USD" | "BTC" | "CIRCLE_UNIT";
  preferredMethod: string;
  stripeAccountId?: string;
  settlementHint: string;
  badge: string;
};

type Activity = {
  id: string;
  name: string;
  amountLabel: string;
  direction: "in" | "out";
};

type Phase = "home" | "listening" | "ping" | "settling" | "settled" | "error";

const SENDER_INR = 25_000;
const SENDER_NAME = "Aditya";
const APPS = [
  { name: "Phone", hue: "#34c759" },
  { name: "Mail", hue: "#3a3a3c" },
  { name: "Safari", hue: "#5ac8fa" },
  { name: "Music", hue: "#ff2d55" },
  { name: "Maps", hue: "#64d2ff" },
  { name: "Messages", hue: "#30d158" },
  { name: "Photos", hue: "#ff9f0a" },
  { name: "Camera", hue: "#8e8e93" },
];

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function MiniHome(props: {
  role: "You" | string;
  assetLabel: string;
  balanceLabel: string;
  statusLine: string;
  activity: Activity[];
  listening?: boolean;
  proving?: boolean;
  notification?: string | null;
  onPay?: () => void;
  disabled?: boolean;
  inputHint: string;
}) {
  const clock = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    []
  );

  return (
    <div className="home uni-phone__home">
      {props.notification && (
        <div className="uni-phone__toast" role="status">
          <strong>Circle</strong>
          <span>{props.notification}</span>
        </div>
      )}

      <div className="home__status">
        <span>{clock}</span>
        <span className="home__status-right">{props.role}</span>
      </div>

      <div className="home__wallpaper" aria-hidden />

      <div
        className={`circled-widget circled-widget--money ${
          props.proving || props.listening ? "circled-widget--live" : ""
        }`}
      >
        <span className="circled-widget__flow" aria-hidden />
        <span className="circled-widget__flow circled-widget__flow--2" aria-hidden />

        <button
          type="button"
          className="circled-widget__pay"
          onClick={props.onPay}
          disabled={props.disabled || !props.onPay}
          aria-label={`${props.role} — tap to speak`}
        >
          <span className="circled-widget__glyph-wrap">
            <img src="/glyph.png" alt="" className="circled-widget__glyph" />
          </span>
          <span className="circled-widget__meta">
            <strong className="brand-mark">Circle</strong>
            <span className="circled-widget__balance">{props.balanceLabel}</span>
            <em aria-live="polite">{props.statusLine}</em>
            <span className="circled-widget__activity" aria-label="Recent">
              {props.activity.length === 0 ? (
                <span className="circled-widget__activity-empty">{props.inputHint}</span>
              ) : (
                props.activity.map((p) => (
                  <span key={p.id} className="circled-widget__activity-row">
                    <span className="circled-widget__activity-name">{p.name}</span>
                    <span className="circled-widget__activity-amt">
                      {p.direction === "out" ? "−" : "+"}
                      {p.amountLabel}
                    </span>
                  </span>
                ))
              )}
            </span>
          </span>
        </button>

        <span className="uni-phone__asset-chip">{props.assetLabel}</span>
      </div>

      <div className="home__grid">
        {APPS.map((app) => (
          <div key={app.name} className="home-icon" aria-hidden>
            <span className="home-icon__tile" style={{ background: app.hue }} />
            <span className="home-icon__label">{app.name}</span>
          </div>
        ))}
      </div>

      <div className="home__dock">
        <span className="home-icon__tile" style={{ background: "#34c759" }} />
        <span className="home-icon__tile" style={{ background: "#1c1c1e" }} />
        <span className="home-icon__tile" style={{ background: "#5ac8fa" }} />
        <span className="circled-dock" aria-hidden>
          <img src="/glyph.png" alt="" />
        </span>
      </div>
    </div>
  );
}

export function UniversalAdapterDemo({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<SandboxAccount[]>([]);
  const [receiverId, setReceiverId] = useState("");
  const [phase, setPhase] = useState<Phase>("home");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [pendingAmount, setPendingAmount] = useState(0);
  const [pendingName, setPendingName] = useState("");
  const [senderBalance, setSenderBalance] = useState(SENDER_INR);
  const [receiverBalance, setReceiverBalance] = useState(0);
  const [senderActivity, setSenderActivity] = useState<Activity[]>([]);
  const [receiverActivity, setReceiverActivity] = useState<Activity[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [settleMeta, setSettleMeta] = useState<{
    paymentId: string;
    quoteId: string;
    routeId: string;
    routeCommitment: string;
    receiptId: string;
    targetAmount: string;
    targetAsset: string;
    proofMode?: string;
    attestationGrade?: string;
    circuit?: string;
    snarkDigest?: string;
    proveMs?: number;
    refunded?: boolean;
  } | null>(null);
  const [tamperState, setTamperState] = useState<"idle" | "running" | "blocked">("idle");
  const [refundRequest, setRefundRequest] = useState<{
    inr: number;
    targetAmt: number;
    targetAsset: string;
    fromName: string;
    status: "pending" | "processing";
  } | null>(null);
  const voiceRef = useRef<VoiceListenHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/universal/sandbox-accounts")
      .then((r) => readJson<{ accounts: SandboxAccount[] }>(r))
      .then((data) => {
        if (cancelled) return;
        const usable = data.accounts.filter((a) => a.preferredAsset !== "BTC");
        setAccounts(usable);
        setReceiverId(usable[0]?.id || "");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load accounts");
      });
    return () => {
      cancelled = true;
      voiceRef.current?.stop();
    };
  }, []);

  const receiver = accounts.find((a) => a.id === receiverId) ?? accounts[0];

  function matchReceiver(name: string): SandboxAccount | undefined {
    const n = name.trim().toLowerCase();
    return accounts.find(
      (a) =>
        a.displayName.toLowerCase().includes(n) ||
        n.includes(a.displayName.split(" ")[0]!.toLowerCase()) ||
        a.handle.toLowerCase().includes(n)
    );
  }

  function startVoice() {
    if (!receiver) return;
    if (!speechRecognitionAvailable()) {
      setError("Voice unavailable in this browser — use Chrome/Edge and allow the mic.");
      setPhase("error");
      return;
    }
    voiceRef.current?.stop();
    setError("");
    setTranscript("");
    setNotification(null);
    setPhase("listening");

    const names = accounts.map((a) => a.displayName);
    voiceRef.current = startVoiceListen({
      timeoutMs: 14_000,
      contacts: names,
      onInterim: (text) => setTranscript(text),
      onFinal: (result) => {
        setTranscript(result.transcript);
        const parsed = parseUtterance(result.transcript, { contacts: names });
        const amount = result.amount ?? parsed.amount;
        const spokenName = result.recipient ?? parsed.recipient;
        const matched = spokenName ? matchReceiver(spokenName) : undefined;

        if (!amount || amount <= 0) {
          setError("Say an amount and a name — e.g. “Send 5000 to Maya”");
          setPhase("error");
          return;
        }
        if (amount > senderBalance) {
          setError("Insufficient INR balance on this demo wallet.");
          setPhase("error");
          return;
        }
        if (matched) setReceiverId(matched.id);
        setPendingAmount(amount);
        setPendingName(matched?.displayName || spokenName || receiver.displayName);
        setPhase("ping");
      },
      onError: (reason) => {
        if (reason === "no-speech" || reason === "aborted") {
          setPhase("home");
          return;
        }
        setError("Couldn’t hear that — tap the widget and try again.");
        setPhase("error");
      },
    });
  }

  async function confirmPay(edits: PaymentEdits, accountOverride?: SandboxAccount) {
    const matched = accountOverride || matchReceiver(edits.recipient) || receiver;
    if (!matched) return;
    const amount = edits.amount;
    setReceiverId(matched.id);
    setPendingAmount(amount);
    setPendingName(matched.displayName);
    setPhase("settling");
    setError("");
    setTamperState("idle");
    try {
      const q = await readJson<{
        quoteId: string;
        quote: { targetAmount: string; targetAsset: string };
      }>(
        await fetch("/api/universal/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: matched.id,
            amount: String(amount),
            sourceAsset: "INR",
            sourceMethod: "upi",
          }),
        })
      );
      const r = await readJson<{
        routeId: string;
        routeCommitment: string;
      }>(
        await fetch("/api/universal/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId: q.quoteId }),
        })
      );
      const s = await readJson<{
        receiptId: string;
        proofMode?: string;
        attestationGrade?: string;
        circuit?: string;
        snarkDigest?: string;
        proveMs?: number;
        quoteId: string;
        routeId: string;
        payment?: { id?: string };
      }>(
        await fetch("/api/universal/sandbox-settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteId: q.quoteId,
            routeId: r.routeId,
            routeCommitment: r.routeCommitment,
          }),
        })
      );

      const paymentId = s.payment?.id || s.receiptId;
      const targetLabel = `${q.quote.targetAmount} ${q.quote.targetAsset}`;
      setSenderBalance((b) => b - amount);
      setReceiverBalance((b) => b + Number(q.quote.targetAmount));
      const outRow: Activity = {
        id: s.receiptId,
        name: matched.displayName,
        amountLabel: formatInr(amount),
        direction: "out",
      };
      const inRow: Activity = {
        id: `${s.receiptId}_in`,
        name: SENDER_NAME,
        amountLabel: targetLabel,
        direction: "in",
      };
      setSenderActivity((prev) => [outRow, ...prev].slice(0, 4));
      setReceiverActivity((prev) => [inRow, ...prev].slice(0, 4));
      setNotification(`Payment received · +${targetLabel}`);
      setSettleMeta({
        paymentId,
        quoteId: s.quoteId,
        routeId: s.routeId,
        routeCommitment: r.routeCommitment,
        receiptId: s.receiptId,
        targetAmount: q.quote.targetAmount,
        targetAsset: q.quote.targetAsset,
        proofMode: s.proofMode,
        attestationGrade: s.attestationGrade,
        circuit: s.circuit,
        snarkDigest: s.snarkDigest,
        proveMs: s.proveMs,
        refunded: false,
      });
      setPhase("settled");
      window.setTimeout(() => setNotification(null), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
      setPhase("error");
    }
  }

  async function tamperRouteDemo() {
    if (!receiver) return;
    setTamperState("running");
    setError("");
    try {
      const q = await readJson<{ quoteId: string }>(
        await fetch("/api/universal/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: receiver.id,
            amount: "500",
            sourceAsset: "INR",
            sourceMethod: "upi",
          }),
        })
      );
      const r = await readJson<{ routeId: string; routeCommitment: string }>(
        await fetch("/api/universal/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId: q.quoteId }),
        })
      );
      await readJson(
        await fetch("/api/universal/sandbox-settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteId: q.quoteId,
            routeId: r.routeId,
            routeCommitment: r.routeCommitment,
            tamperRouteId: "route_switched_to_btc",
          }),
        })
      );
      setTamperState("idle");
      setError("Unexpected: tamper was accepted");
      setPhase("error");
    } catch {
      setTamperState("blocked");
    }
  }

  /** Demo-only: Maya · ₹5000 · quote → route → settle → ready for tamper */
  async function runJudgeDemo() {
    const maya =
      accounts.find((a) => a.preferredAsset === "USD") ||
      accounts.find((a) => a.displayName.includes("Maya"));
    if (!maya) {
      setError("Maya USD account not loaded");
      setPhase("error");
      return;
    }
    setReceiverId(maya.id);
    await confirmPay({ amount: 5000, recipient: maya.displayName }, maya);
  }

  /** Sender asks for the money back — request goes to the receiver for approval. */
  function requestRefund() {
    if (!settleMeta?.paymentId || settleMeta.refunded) {
      setError("Nothing to refund — send a payment first");
      setPhase("error");
      return;
    }
    if (refundRequest) return;
    const inr = pendingAmount || 0;
    const targetAmt = Number(settleMeta.targetAmount) || 0;
    setRefundRequest({
      inr,
      targetAmt,
      targetAsset: settleMeta.targetAsset,
      fromName: SENDER_NAME,
      status: "pending",
    });
    setPhase("home");
    setNotification(null);
  }

  function declineRefund() {
    setRefundRequest(null);
    setNotification("Refund declined by recipient");
    window.setTimeout(() => setNotification(null), 5000);
  }

  /** Receiver approves — now the rail refund actually runs and balances reverse. */
  async function approveRefund() {
    if (!settleMeta?.paymentId || !refundRequest) return;
    const { inr, targetAmt, targetAsset } = refundRequest;
    setRefundRequest({ ...refundRequest, status: "processing" });
    try {
      await readJson(
        await fetch("/api/universal/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: settleMeta.paymentId }),
        })
      );
      setSenderBalance((b) => b + inr);
      setReceiverBalance((b) => Math.max(0, b - targetAmt));
      const refundIntoSender: Activity = {
        id: `${settleMeta.receiptId}_refund_in`,
        name: "Refund",
        amountLabel: formatInr(inr),
        direction: "in",
      };
      const refundOutOfReceiver: Activity = {
        id: `${settleMeta.receiptId}_refund_out`,
        name: "Refund",
        amountLabel:
          targetAsset === "USD" ? `$${targetAmt.toFixed(2)}` : `${targetAmt} ${targetAsset}`,
        direction: "out",
      };
      setSenderActivity((prev) => [refundIntoSender, ...prev].slice(0, 4));
      setReceiverActivity((prev) => [refundOutOfReceiver, ...prev].slice(0, 4));
      setSettleMeta({ ...settleMeta, refunded: true });
      setRefundRequest(null);
      setNotification(`Refund approved · ${formatInr(inr)} back in your wallet`);
      window.setTimeout(() => setNotification(null), 6000);
    } catch (e) {
      setRefundRequest(null);
      setError(e instanceof Error ? e.message : "Refund failed");
      setPhase("error");
    }
  }

  function chooseAnotherRoute() {
    setError("");
    setTamperState("idle");
    setPhase("home");
  }

  const senderStatus =
    phase === "listening"
      ? transcript
        ? `Hearing: “${transcript}”`
        : "I’m listening… say amount and name"
      : phase === "settling"
        ? "Proving route on Midnight · then Stripe test…"
        : phase === "settled"
          ? settleMeta?.attestationGrade === "zk-proved"
            ? "Sent · zk-proved"
            : "Sent"
          : "Tap to speak — amount and name (INR)";

  const receiverStatus =
    notification && !notification.startsWith("Refund")
      ? "New payment"
      : receiver
        ? `Accepts ${receiver.preferredAsset}`
        : "Loading…";

  const receiverBalanceLabel =
    receiver?.preferredAsset === "BTC"
      ? `${receiverBalance.toFixed(8)} BTC`
      : receiver?.preferredAsset === "USD"
        ? `$${receiverBalance.toFixed(2)}`
        : String(receiverBalance);

  const busy = phase === "listening" || phase === "settling" || tamperState === "running";
  const authorizedAsset = receiver?.preferredAsset ?? "USD";

  return (
    <div className="uni-stage fade-in">
      <div className="uni-stage__atmosphere" aria-hidden />

      <div className="uni-stage__frame">
      <header className="uni-stage__bar">
        <button type="button" className="uni-stage__back" onClick={onBack}>
          ← Menu
        </button>
        <div className="uni-stage__brand">
          <img src="/glyph.png" alt="" />
          <div>
            <strong className="brand-mark">Circle</strong>
            <span>Speak INR · they receive what they accept</span>
          </div>
        </div>
        <div className="uni-stage__bar-actions">
          <button
            type="button"
            className="btn primary uni-stage__demo-btn"
            disabled={busy || accounts.length === 0}
            onClick={() => void runJudgeDemo()}
          >
            Run demo
          </button>
        </div>
      </header>

      <div className="uni-stage__receivers" role="tablist" aria-label="Pay to">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={receiverId === a.id}
            className={receiverId === a.id ? "is-active" : ""}
            disabled={busy}
            onClick={() => {
              setReceiverId(a.id);
              setNotification(null);
              setTamperState("idle");
              if (phase === "settled" || phase === "error" || phase === "ping") setPhase("home");
            }}
          >
            <strong>{a.displayName.split(" ")[0]}</strong>
            <em>{a.preferredAsset}</em>
          </button>
        ))}
      </div>

      <div className="uni-stage__phones">
        <div className="uni-phone">
          <p className="uni-phone__label">{SENDER_NAME} · INR</p>
          <div className="phone-shell uni-phone__shell">
            <div className="phone">
              <div className="phone__notch" aria-hidden />
              <div className="phone__screen">
                <MiniHome
                  role={SENDER_NAME}
                  assetLabel="INR"
                  balanceLabel={formatInr(senderBalance)}
                  statusLine={
                    settleMeta?.refunded && notification?.startsWith("Refund")
                      ? "Refund received"
                      : senderStatus
                  }
                  activity={senderActivity}
                  listening={phase === "listening"}
                  proving={phase === "settling"}
                  notification={
                    notification?.startsWith("Refund") ? notification : null
                  }
                  onPay={() => {
                    if (phase === "ping" || phase === "settling") return;
                    startVoice();
                  }}
                  inputHint="Tap · say amount and name"
                />
                {(phase === "listening" || phase === "settling") && (
                  <div className="home-overlay">
                    <div className="pay-sheet pay-sheet--verify">
                      <div className="pay-sheet__spinner" aria-hidden />
                      <p>
                        {phase === "listening"
                          ? transcript || "Listening…"
                          : "Proving route on Midnight…"}
                      </p>
                    </div>
                  </div>
                )}
                {phase === "ping" && (
                  <div className="home-overlay">
                    <PaymentPing
                      amount={pendingAmount}
                      recipient={pendingName}
                      onConfirm={(edits) => void confirmPay(edits)}
                      onDeny={() => setPhase("home")}
                    />
                  </div>
                )}
                {phase === "settled" && settleMeta && (
                  <div className="home-overlay">
                    <div className="pay-result pay-result--ok">
                      <span className="pay-result__emoji" aria-hidden>
                        ✓
                      </span>
                      <h2 className="pay-result__title">Sent</h2>
                      <p className="pay-result__sub">
                        {formatInr(pendingAmount)} → {settleMeta.targetAmount}{" "}
                        {settleMeta.targetAsset}
                      </p>
                      {settleMeta.attestationGrade && (
                        <p className="pay-result__grade">{settleMeta.attestationGrade}</p>
                      )}
                      <div className="uni-stage__fail-actions">
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => setPhase("home")}
                        >
                          Done
                        </button>
                        {!settleMeta.refunded && !refundRequest && (
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={requestRefund}
                          >
                            Request refund
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {phase === "error" && (
                  <div className="home-overlay">
                    <div className="pay-result pay-result--err">
                      <h2 className="pay-result__title">Couldn’t send</h2>
                      <p className="pay-result__sub">{error}</p>
                      <div className="uni-stage__fail-actions">
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => {
                            setError("");
                            void confirmPay({
                              amount: pendingAmount || 5000,
                              recipient: pendingName || receiver?.displayName || "Maya",
                            });
                          }}
                        >
                          Retry
                        </button>
                        <button type="button" className="btn ghost" onClick={chooseAnotherRoute}>
                          Switch person
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={!settleMeta?.paymentId || settleMeta.refunded || !!refundRequest}
                          onClick={requestRefund}
                        >
                          Request refund
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="phone__home" aria-hidden />
            </div>
          </div>
        </div>

        <div className="uni-stage__flow" aria-hidden>
          <span className="uni-stage__flow-line" />
          <span className="uni-stage__flow-label">
            {receiver?.preferredAsset ?? "…"}
          </span>
          <span className="uni-stage__flow-line" />
        </div>

        <div className="uni-phone">
          <p className="uni-phone__label">
            {receiver?.displayName.split(" ")[0] ?? "Them"} · {receiver?.preferredAsset ?? "…"}
          </p>
          <div className="phone-shell uni-phone__shell">
            <div className="phone">
              <div className="phone__notch" aria-hidden />
              <div className="phone__screen">
                <MiniHome
                  role={receiver?.displayName ?? "Receiver"}
                  assetLabel={receiver?.preferredAsset ?? "—"}
                  balanceLabel={receiverBalanceLabel}
                  statusLine={
                    refundRequest
                      ? "Refund requested"
                      : settleMeta?.refunded
                        ? "Refund sent back"
                        : receiverStatus
                  }
                  activity={receiverActivity}
                  notification={
                    notification && !notification.startsWith("Refund")
                      ? notification
                      : null
                  }
                  inputHint={
                    receiver ? `Waiting for ${receiver.preferredAsset}` : "Loading…"
                  }
                />
                {refundRequest && (
                  <div className="home-overlay">
                    <div className="pay-sheet refund-ask">
                      <span className="refund-ask__emoji" aria-hidden>
                        ↩
                      </span>
                      <h2 className="refund-ask__title">Refund request</h2>
                      <p className="refund-ask__sub">
                        {refundRequest.fromName} asks to reverse{" "}
                        <strong>
                          {refundRequest.targetAsset === "USD"
                            ? `$${refundRequest.targetAmt.toFixed(2)}`
                            : `${refundRequest.targetAmt} ${refundRequest.targetAsset}`}
                        </strong>
                      </p>
                      <p className="refund-ask__note">
                        Approving debits your balance and returns {formatInr(refundRequest.inr)} to
                        the sender.
                      </p>
                      <div className="refund-ask__actions">
                        <button
                          type="button"
                          className="btn primary"
                          disabled={refundRequest.status === "processing"}
                          onClick={() => void approveRefund()}
                        >
                          {refundRequest.status === "processing" ? "Refunding…" : "Approve refund"}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={refundRequest.status === "processing"}
                          onClick={declineRefund}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="phone__home" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <section className="uni-stage__safety" aria-label="Route safety">
        <div className="uni-stage__safety-copy">
          <h2>Route stays locked</h2>
          <p>
            You authorize a person and an asset. If anything tries to change that after you say
            yes, Circle blocks it.
          </p>
        </div>
        <div className="uni-stage__compare" data-state={tamperState}>
          <div className="uni-stage__compare-card is-ok">
            <span>You authorized</span>
            <strong>
              {receiver?.displayName.split(" ")[0] ?? "Them"} · {authorizedAsset}
            </strong>
          </div>
          <div className="uni-stage__compare-vs" aria-hidden>
            {tamperState === "blocked" ? "✕" : "→"}
          </div>
          <div
            className={`uni-stage__compare-card ${
              tamperState === "blocked" ? "is-blocked" : "is-threat"
            }`}
          >
            <span>{tamperState === "blocked" ? "Blocked attempt" : "Bad router tries"}</span>
            <strong>
              {receiver?.displayName.split(" ")[0] ?? "Them"} · BTC
            </strong>
          </div>
        </div>
        <div className="uni-stage__actions">
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => void tamperRouteDemo()}
          >
            {tamperState === "running"
              ? "Checking…"
              : tamperState === "blocked"
                ? "Try again"
                : "Simulate switch to BTC"}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy || !settleMeta?.paymentId || settleMeta.refunded || !!refundRequest}
            onClick={requestRefund}
            title={
              !settleMeta?.paymentId
                ? "Send a payment first"
                : settleMeta.refunded
                  ? "Already refunded"
                  : refundRequest
                    ? "Waiting for recipient approval"
                    : "Ask the recipient to return the last payment"
            }
          >
            {settleMeta?.refunded
              ? "Refunded"
              : refundRequest
                ? "Awaiting approval…"
                : "Request refund"}
          </button>
          {refundRequest && (
            <span className="uni-stage__pill" role="status">
              Sent to {receiver?.displayName.split(" ")[0] ?? "recipient"} for approval
            </span>
          )}
          {tamperState === "blocked" && (
            <span className="uni-stage__pill uni-stage__pill--ok" role="status">
              Payment never left
            </span>
          )}
          {settleMeta?.attestationGrade && (
            <span className="uni-stage__pill" role="status">
              {settleMeta.refunded
                ? `${settleMeta.attestationGrade} · refunded`
                : settleMeta.attestationGrade}
            </span>
          )}
        </div>
        {tamperState === "blocked" && (
          <p className="uni-stage__safety-result" role="status">
            You said {authorizedAsset}. A router tried to rewrite it to BTC. RouteProof didn’t
            match — settle refused.
          </p>
        )}
      </section>

      <footer className="uni-stage__foot">
        <div className="uni-stage__tech-body">
          <h3 className="uni-stage__tech-title">Technical receipt</h3>
          {settleMeta ? (
            <dl>
              <div>
                <dt>quote</dt>
                <dd>{settleMeta.quoteId}</dd>
              </div>
              <div>
                <dt>route</dt>
                <dd>{settleMeta.routeId}</dd>
              </div>
              <div>
                <dt>receipt</dt>
                <dd>{settleMeta.receiptId}</dd>
              </div>
              {settleMeta.routeCommitment && (
                <div>
                  <dt>commitment</dt>
                  <dd>{settleMeta.routeCommitment.slice(0, 24)}…</dd>
                </div>
              )}
              {settleMeta.snarkDigest && (
                <div>
                  <dt>snark</dt>
                  <dd>{settleMeta.snarkDigest.slice(0, 24)}…</dd>
                </div>
              )}
              <div>
                <dt>status</dt>
                <dd>{settleMeta.refunded ? "refunded" : "settled"}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Run demo or speak a payment — IDs appear here after settle.</p>
          )}
          <p className="muted">
            Sandbox Stripe TEST · not licensed UPI/bank · Command center for ops.
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
