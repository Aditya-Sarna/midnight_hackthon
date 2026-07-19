import { useEffect, useState } from "react";
import { GlyphMark } from "../components/Glyph";

type CommandCenter = {
  proofServer: {
    mode?: string;
    proofServerOk?: boolean;
    note?: string;
  };
  compact: { circuits: string[]; note: string };
  activeRoute: {
    receiptId?: string;
    routeId?: string;
    quoteId?: string;
    lifecycleState?: string;
    attestationGrade?: string;
    proofMode?: string;
  } | null;
  settle: Record<string, unknown>;
  metrics: Record<string, number>;
  midnight?: { ready?: boolean };
};

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
  const route = data?.activeRoute;

  return (
    <div className="screen judge-cc fade-in">
      <header className="screen-head">
        <GlyphMark />
        <div>
          <h2>Judge command center</h2>
          <p>Technical receipt — proof health, route IDs, lifecycle.</p>
        </div>
      </header>

      {error && <p className="muted">{error}</p>}

      <section className="judge-cc__grid" aria-label="Command center">
        <article>
          <span>Proof-server health</span>
          <strong>
            {proof?.proofServerOk === true
              ? "UP"
              : proof?.proofServerOk === false
                ? "DOWN / fallback"
                : "—"}
          </strong>
          <em>
            {proof?.mode ?? "—"}
            {proof?.note ? ` · ${proof.note}` : ""}
          </em>
        </article>
        <article>
          <span>Compact artifact / circuits</span>
          <strong>{data?.compact.circuits.length ?? 0} circuits</strong>
          <em>{data?.compact.circuits.join(", ") || "—"}</em>
        </article>
        <article>
          <span>Active quote / route</span>
          <strong>{route?.quoteId ?? "none yet"}</strong>
          <em>{route?.routeId ?? "Run Universal Adapter settle first"}</em>
        </article>
        <article>
          <span>Source → conversion → target</span>
          <strong>See last settle receipt</strong>
          <em>
            Lifecycle: {route?.lifecycleState ?? "—"} · grade:{" "}
            {route?.attestationGrade ?? "—"}
          </em>
        </article>
        <article>
          <span>Risk / reconciliation</span>
          <strong>
            holds {data?.metrics.riskHolds ?? 0} · tamper rejects{" "}
            {data?.metrics.tamperRejects ?? 0}
          </strong>
          <em>
            settled {data?.metrics.settled ?? 0} · failed {data?.metrics.failed ?? 0} ·
            refunds {data?.metrics.refunds ?? 0}
          </em>
        </article>
        <article>
          <span>Last receipt</span>
          <strong>{route?.receiptId ?? "—"}</strong>
          <em>
            proofMode {route?.proofMode ?? "—"} · midnight{" "}
            {data?.midnight?.ready ? "ready" : "probe"}
          </em>
        </article>
      </section>

      <p className="muted">
        Fallback if proof-server fails: compact-runtime. SNARK path needs Docker proof-server.
        Strict production mode fails closed when ZK is required.
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
