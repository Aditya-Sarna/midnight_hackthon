import { useEffect, useMemo, useState } from "react";
import { receivePayment } from "../lib/receivePaySdk";
import { merchantPayUri, qrSvg } from "../lib/qr";
import { requestOfframp } from "../lib/offramp";
import { makeSystemsEvent, type SystemsEvent } from "../lib/systemsBus";

type Props = {
  onBack: () => void;
  onSystemsEvent?: (e: SystemsEvent) => void;
};

/**
 * Merchant mode — receive-only QR + webhook-ready order flow (Phase 10 skill).
 */
export function MerchantReceive({ onBack, onSystemsEvent }: Props) {
  const [amount, setAmount] = useState("42");
  const [currency, setCurrency] = useState("USD");
  const [merchant, setMerchant] = useState("nike.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    orderRef: string;
    destination: string;
    exit: Record<string, boolean>;
    webhookStub: string;
  } | null>(null);
  const [offHint, setOffHint] = useState("****4242");
  const [offMsg, setOffMsg] = useState("");

  const qr = useMemo(() => {
    if (!result) return "";
    return qrSvg(
      merchantPayUri({
        merchant,
        amount: Number(amount) || 0,
        currency,
        orderRef: result.orderRef,
        destination: result.destination,
      }),
      220
    );
  }, [result, merchant, amount, currency]);

  useEffect(() => {
    onSystemsEvent?.(
      makeSystemsEvent({
        source: "merchant",
        phase: "idle",
        title: "Merchant receive rail",
        detail: "JIT destination mint · reconcile by order_ref · prove_credit_update on confirm.",
        layer: "relay",
        status: "idle",
        intensity: 0.35,
        circuits: ["prove_credit_update"],
      })
    );
  }, [onSystemsEvent]);

  async function createInvoice() {
    setBusy(true);
    setError("");
    setResult(null);
    onSystemsEvent?.(
      makeSystemsEvent({
        source: "merchant",
        phase: "mint",
        title: "Minting JIT destination",
        detail: "Unique settlement_destination · order bind · destination never reused.",
        layer: "relay",
        status: "proving",
        intensity: 0.9,
        circuits: ["prove_credit_update"],
      })
    );
    try {
      const orderRef = `ord-${Date.now().toString(36)}`;
      const res = await receivePayment({
        merchant_identifier: merchant.trim(),
        order_reference: orderRef,
        amount: Number(amount),
        currency,
        settlement_rail: "circled-private",
        run_credit: true,
      });
      const dest =
        (res as { destination?: { settlement_destination?: string } }).destination
          ?.settlement_destination || `jit:${orderRef}`;
      setResult({
        orderRef,
        destination: dest,
        exit: res.exit_criterion as unknown as Record<string, boolean>,
        webhookStub: `${location.origin}/api/skills/receiving-payment/webhook`,
      });
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "merchant",
          phase: "credited",
          title: "Receive path complete",
          detail: "Reconciled · confirmed · private balance credited via prove_credit_update.",
          layer: "midnight",
          status: "settled",
          intensity: 0.55,
          circuits: ["prove_credit_update"],
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receive failed");
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "merchant",
          phase: "error",
          title: "Receive failed",
          detail: e instanceof Error ? e.message : "Receive failed",
          layer: "relay",
          status: "error",
          intensity: 0.45,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="merchant atelier-panel">
      <header className="merchant__head">
        <p className="atelier-kicker">Merchant mode</p>
        <h1 className="brand-mark">Receive</h1>
        <p className="merchant__lede">
          Private inbound payments — JIT destination, order reconcile, encrypted credit. No device vault
          required for the merchant counterparty.
        </p>
      </header>

      <label className="merchant__field">
        <span>Merchant id</span>
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </label>
      <div className="merchant__row">
        <label className="merchant__field">
          <span>Amount</span>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="merchant__field">
          <span>Currency</span>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="merchant__actions">
        <button type="button" className="btn primary" disabled={busy} onClick={() => void createInvoice()}>
          {busy ? "Minting destination…" : "Create receive QR"}
        </button>
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
      </div>

      {result && (
        <div className="merchant__result fade-in">
          <div
            className="merchant__qr"
            dangerouslySetInnerHTML={{ __html: qr }}
            aria-label="Payment QR"
          />
          <p className="merchant__order">
            <strong>Order</strong> {result.orderRef}
          </p>
          <code className="merchant__dest">{result.destination}</code>
          <ul className="merchant__exit">
            {Object.entries(result.exit).map(([k, v]) => (
              <li key={k} className={v ? "on" : ""}>
                <span />
                {k.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
          <p className="merchant__hook">
            Webhook stub: <code>{result.webhookStub}</code>
          </p>
        </div>
      )}

      <section className="merchant__offramp">
        <h2>Off-ramp</h2>
        <p className="merchant__lede">Mock withdraw to bank — completes money-out for demos.</p>
        <label className="merchant__field">
          <span>Account hint</span>
          <input value={offHint} onChange={(e) => setOffHint(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            void requestOfframp({
              amount: Number(amount) || 0,
              currency,
              accountHint: offHint,
            })
              .then((r) => setOffMsg(`${r.status} · ${r.reference}`))
              .catch((e) => setOffMsg(e instanceof Error ? e.message : "Off-ramp failed"));
          }}
        >
          Withdraw stub
        </button>
        {offMsg && <p className="merchant__hook">{offMsg}</p>}
      </section>
    </div>
  );
}
