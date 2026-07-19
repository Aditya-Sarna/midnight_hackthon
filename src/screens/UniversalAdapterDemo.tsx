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
  } | null>(null);
  const [tamperMsg, setTamperMsg] = useState("");
  const [lastRoute, setLastRoute] = useState<{
    quoteId: string;
    routeId: string;
    routeCommitment: string;
  } | null>(null);
  const voiceRef = useRef<VoiceListenHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/universal/sandbox-accounts")
      .then((r) => readJson<{ accounts: SandboxAccount[] }>(r))
      .then((data) => {
        if (cancelled) return;
        setAccounts(data.accounts);
        setReceiverId(data.accounts[0]?.id || "");
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
    setSettleMeta(null);
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
    setTamperMsg("");
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
      setLastRoute({
        quoteId: q.quoteId,
        routeId: r.routeId,
        routeCommitment: r.routeCommitment,
      });
      const s = await readJson<{
        receiptId: string;
        proofMode?: string;
        attestationGrade?: string;
        circuit?: string;
        snarkDigest?: string;
        proveMs?: number;
        quoteId: string;
        routeId: string;
        payment: { id: string };
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
        name: "You",
        amountLabel: targetLabel,
        direction: "in",
      };
      setSenderActivity((prev) => [outRow, ...prev].slice(0, 4));
      setReceiverActivity((prev) => [inRow, ...prev].slice(0, 4));
      setNotification(`Payment received · +${targetLabel}`);
      setSettleMeta({
        paymentId: s.payment.id,
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
    setTamperMsg("");
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
      setLastRoute({
        quoteId: q.quoteId,
        routeId: r.routeId,
        routeCommitment: r.routeCommitment,
      });
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
      setTamperMsg("Unexpected: tamper was accepted");
    } catch (e) {
      setTamperMsg(
        `Tamper attempt: USD route → BTC route · Result: rejected · ${
          e instanceof Error ? e.message : "Rejected"
        }`
      );
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

  async function refundLast() {
    if (!settleMeta?.paymentId) {
      setError("No payment id — run settle first");
      setPhase("error");
      return;
    }
    try {
      await readJson(
        await fetch("/api/universal/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: settleMeta.paymentId }),
        })
      );
      setSettleMeta({
        ...settleMeta,
        attestationGrade: `${settleMeta.attestationGrade || "settled"} · refunded`,
      });
      setNotification("Refund initiated");
      setPhase("home");
      window.setTimeout(() => setNotification(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
      setPhase("error");
    }
  }

  function chooseAnotherRoute() {
    setError("");
    setTamperMsg("");
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

  const receiverStatus = notification
    ? "New payment"
    : receiver
      ? `Accepts ${receiver.preferredAsset} · Stripe test`
      : "Loading…";

  const receiverBalanceLabel =
    receiver?.preferredAsset === "BTC"
      ? `${receiverBalance.toFixed(8)} BTC`
      : receiver?.preferredAsset === "USD"
        ? `$${receiverBalance.toFixed(2)}`
        : String(receiverBalance);

  return (
    <div className="uni-stage fade-in">
      <header className="uni-stage__head">
        <div>
          <h1 className="brand-mark">Circle</h1>
          <p>INR → preferred asset. Speak or run the judge demo.</p>
        </div>
        <button type="button" className="btn ghost" onClick={onBack}>
          Menu
        </button>
      </header>

      <details className="uni-stage__routeproof">
        <summary>RouteProof · binds + tamper</summary>
        <ul>
          <li>sender · receiver · source/target asset</li>
          <li>quoteId · routeId · expiry · acceptance</li>
        </ul>
        <p className="uni-stage__routeproof-result">
          Tamper: USD → BTC ·{" "}
          {tamperMsg
            ? tamperMsg.toLowerCase().includes("rejected") ||
              tamperMsg.toLowerCase().includes("mismatch")
              ? "rejected"
              : tamperMsg
            : "run Try tamper route"}
        </p>
      </details>

      <div className="uni-stage__receivers" role="tablist" aria-label="Receiver">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={receiverId === a.id}
            className={receiverId === a.id ? "is-active" : ""}
            disabled={phase === "listening" || phase === "settling"}
            onClick={() => {
              setReceiverId(a.id);
              setNotification(null);
              if (phase === "settled" || phase === "error" || phase === "ping") setPhase("home");
            }}
          >
            <strong>{a.displayName}</strong>
            <em>
              {a.preferredAsset} · {a.stripeAccountId || "stripe_test"}
            </em>
          </button>
        ))}
      </div>

      <div className="uni-stage__phones">
        <div className="uni-phone">
          <p className="uni-phone__label">You · send INR</p>
          <div className="phone-shell uni-phone__shell">
            <div className="phone">
              <div className="phone__notch" aria-hidden />
              <div className="phone__screen">
                <MiniHome
                  role="You"
                  assetLabel="INR"
                  balanceLabel={formatInr(senderBalance)}
                  statusLine={senderStatus}
                  activity={senderActivity}
                  listening={phase === "listening"}
                  proving={phase === "settling"}
                  onPay={() => {
                    if (phase === "ping" || phase === "settling") return;
                    startVoice();
                  }}
                  inputHint="Tap widget · speak amount + name"
                />
                {(phase === "listening" || phase === "settling") && (
                  <div className="home-overlay">
                    <div className="pay-sheet pay-sheet--verify">
                      <div className="pay-sheet__spinner" aria-hidden />
                      <p>
                        {phase === "listening"
                          ? transcript || "Listening…"
                          : "Proving route binding on Midnight…"}
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
                      <p className="pay-result__grade">
                        grade: {settleMeta.attestationGrade || "—"} ·{" "}
                        {settleMeta.proofMode || "—"}
                        {settleMeta.proveMs != null ? ` · ${settleMeta.proveMs}ms` : ""}
                      </p>
                      {settleMeta.circuit && (
                        <p className="pay-result__sub">
                          {settleMeta.circuit}
                          {settleMeta.snarkDigest
                            ? ` · snark ${settleMeta.snarkDigest.slice(0, 16)}…`
                            : ""}
                        </p>
                      )}
                      <button type="button" className="btn primary" onClick={() => setPhase("home")}>
                        Done
                      </button>
                    </div>
                  </div>
                )}
                {phase === "error" && (
                  <div className="home-overlay">
                    <div className="pay-result pay-result--err">
                      <h2 className="pay-result__title">Payment blocked</h2>
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
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={chooseAnotherRoute}
                        >
                          Choose another route
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={!settleMeta?.paymentId}
                          onClick={() => void refundLast()}
                        >
                          Refund
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setError("Flagged for manual review — ops will reconcile.");
                          }}
                        >
                          Manual review
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

        <div className="uni-phone">
          <p className="uni-phone__label">
            {receiver?.displayName ?? "Receiver"} · gets {receiver?.preferredAsset ?? "…"}
          </p>
          <div className="phone-shell uni-phone__shell">
            <div className="phone">
              <div className="phone__notch" aria-hidden />
              <div className="phone__screen">
                <MiniHome
                  role={receiver?.displayName ?? "Receiver"}
                  assetLabel={receiver?.preferredAsset ?? "—"}
                  balanceLabel={receiverBalanceLabel}
                  statusLine={receiverStatus}
                  activity={receiverActivity}
                  notification={notification}
                  inputHint={
                    receiver
                      ? `Stripe test · waits for ${receiver.preferredAsset}`
                      : "Loading Stripe test account…"
                  }
                />
              </div>
              <div className="phone__home" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {settleMeta && (
        <p className="uni-stage__ids muted">
          quoteId {settleMeta.quoteId} · routeId {settleMeta.routeId} · receipt{" "}
          {settleMeta.receiptId}
          {settleMeta.routeCommitment
            ? ` · routeCommitment ${settleMeta.routeCommitment.slice(0, 16)}…`
            : ""}
          {settleMeta.snarkDigest ? ` · snarkDigest ${settleMeta.snarkDigest.slice(0, 24)}…` : ""}
        </p>
      )}

      <div className="uni-stage__actions">
        <button
          type="button"
          className="btn primary"
          disabled={phase === "listening" || phase === "settling" || accounts.length === 0}
          onClick={() => void runJudgeDemo()}
        >
          Run judge demo
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={phase === "listening" || phase === "settling"}
          onClick={() => void tamperRouteDemo()}
        >
          Try tamper route
        </button>
        {settleMeta?.paymentId && (
          <button
            type="button"
            className="btn ghost"
            disabled={phase === "listening" || phase === "settling"}
            onClick={() => void refundLast()}
          >
            Refund
          </button>
        )}
        {lastRoute && (
          <span className="muted uni-stage__ids">
            last routeCommitment {lastRoute.routeCommitment.slice(0, 16)}…
          </span>
        )}
      </div>
      {tamperMsg && (
        <p className="uni-stage__tamper" role="status">
          {tamperMsg}
        </p>
      )}

      <p className="uni-stage__note muted">
        Real: Compact + Midnight proof-server SNARKs over the route bind. Sandbox: Stripe test
        Connect + FX. Never claim licensed UPI/bank. Open Command center for the technical
        receipt.
      </p>
    </div>
  );
}
