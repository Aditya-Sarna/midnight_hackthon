import { useEffect, useState } from "react";
import { GlyphMark } from "../components/Glyph";

type TechnicalReceipt = {
  quoteId?: string;
  routeId?: string;
  routeCommitment?: string;
  receiptId?: string;
  lifecycleState?: string;
  sourceAdapter?: string;
  conversionAdapter?: string;
  targetAdapter?: string;
  proofMode?: string;
  attestationGrade?: string;
  snarkDigest?: string;
  proveMs?: number;
};

type CommandCenter = {
  proofServer: {
    mode?: string;
    proofServerOk?: boolean;
    detail?: string;
  };
  compact: { circuits: string[]; note: string };
  activeRoute: TechnicalReceipt | null;
  technicalReceipt: TechnicalReceipt | null;
  metrics: Record<string, number>;
  pilotHealth?: { status: "green" | "yellow" | "red"; note: string };
  midnight?: { ready?: boolean };
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="judge-cc__field">
      <span>{label}</span>
      <strong>{value == null || value === "" ? "—" : String(value)}</strong>
    </div>
  );
}

export function JudgeCommandCenter({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<CommandCenter | null>(null);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);

  async function refresh() {
    setError("");
    try {
      const res = await fetch("/api/judge/command-center");
      const json = (await res.json()) as CommandCenter & { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setData(json);
      setAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(t);
  }, []);

  const proof = data?.proofServer;
  const receipt = data?.technicalReceipt || data?.activeRoute;
  const m = data?.metrics || {};
  const health = data?.pilotHealth?.status || "yellow";

  return (
    <div className="screen judge-cc fade-in">
      <header className="screen-head">
        <GlyphMark />
        <div>
          <h2>Judge command center</h2>
          <p>Technical receipt for the Universal Adapter demo.</p>
        </div>
      </header>

      {error && <p className="muted">{error}</p>}

      <p className={`judge-cc__health judge-cc__health--${health}`} role="status">
        Pilot health: {health.toUpperCase()}
        {data?.pilotHealth?.note ? ` · ${data.pilotHealth.note}` : ""}
      </p>

      <section className="judge-cc__grid" aria-label="Command center">
        <article>
          <span>Proof-server</span>
          <strong>
            {proof?.proofServerOk === true
              ? "UP"
              : proof?.proofServerOk === false
                ? "DOWN / fallback"
                : "—"}
          </strong>
          <em>{proof?.mode ?? "—"}</em>
        </article>
        <article>
          <span>Compact circuits</span>
          <strong>{data?.compact.circuits.length ?? 0}</strong>
          <em>{data?.compact.circuits.slice(0, 3).join(", ") || "—"}</em>
        </article>
        <article>
          <span>Ops counters</span>
          <strong>
            settled {m.settled ?? 0} · failed {m.failed ?? 0} · refunds {m.refunds ?? 0}
          </strong>
          <em>tamperRejects {m.tamperRejects ?? 0} · quotes {m.quotes ?? 0}</em>
        </article>
      </section>

      <section className="judge-cc__receipt" aria-label="Ops metrics">
        <h3>Demo ops</h3>
        <div className="judge-cc__fields">
          <Field label="settled" value={m.settled ?? 0} />
          <Field label="failed" value={m.failed ?? 0} />
          <Field label="refunds" value={m.refunds ?? 0} />
          <Field label="tamperRejects" value={m.tamperRejects ?? 0} />
          <Field label="riskHolds" value={m.riskHolds ?? 0} />
          <Field label="sanctionsBlocks" value={m.sanctionsBlocks ?? 0} />
          <Field label="pendingReconciliation" value={m.pendingReconciliation ?? 0} />
        </div>
      </section>

      <section className="judge-cc__receipt" aria-label="Technical receipt">
        <h3>Last universal receipt</h3>
        {!receipt ? (
          <p className="muted">Run Universal Adapter (or Run judge demo) first.</p>
        ) : (
          <div className="judge-cc__fields">
            <Field label="quoteId" value={receipt.quoteId} />
            <Field label="routeId" value={receipt.routeId} />
            <Field
              label="routeCommitment"
              value={receipt.routeCommitment ? `${receipt.routeCommitment.slice(0, 24)}…` : null}
            />
            <Field label="receiptId" value={receipt.receiptId} />
            <Field label="lifecycleState" value={receipt.lifecycleState} />
            <Field label="sourceAdapter" value={receipt.sourceAdapter} />
            <Field label="conversionAdapter" value={receipt.conversionAdapter ?? "—"} />
            <Field label="targetAdapter" value={receipt.targetAdapter} />
            <Field label="proofMode" value={receipt.proofMode} />
            <Field label="attestationGrade" value={receipt.attestationGrade} />
            <Field
              label="snarkDigest"
              value={receipt.snarkDigest ? `${receipt.snarkDigest.slice(0, 24)}…` : null}
            />
            <Field label="proveMs" value={receipt.proveMs} />
          </div>
        )}
      </section>

      <p className="muted">
        Fallback if proof-server fails: compact-runtime. Strict production fails closed.
      </p>
      <p className="muted">Updated {at ? new Date(at).toLocaleTimeString() : "—"}</p>

      <button type="button" className="btn primary" onClick={() => void refresh()}>
        Refresh
      </button>
      <button type="button" className="btn ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
