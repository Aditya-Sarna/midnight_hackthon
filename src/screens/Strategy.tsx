import { useState } from "react";
import type { SystemsEvent } from "../lib/systemsBus";

type Props = {
  userId: string;
  onBack: () => void;
  onSystemsEvent?: (e: Omit<SystemsEvent, "id" | "at">) => void;
  onLiveProofs?: (
    proofs: { circuit: string; proof: string; label: string }[]
  ) => void;
};

function randomHex32(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Judge-facing private strategy commitment — weight never hits the public ledger.
 */
export function StrategyScreen({
  userId,
  onBack,
  onSystemsEvent,
  onLiveProofs,
}: Props) {
  const [weight, setWeight] = useState("42");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    strategyCommitment: string;
    strategyId: string;
  } | null>(null);

  async function commit() {
    setBusy(true);
    setError("");
    setResult(null);
    onSystemsEvent?.({
      source: "app",
      phase: "strategy",
      layer: "compact",
      status: "proving",
      title: "Strategy commitment",
      detail: "Private weight → public persistentCommit",
      circuits: ["prove_strategy_commitment"],
    });
    try {
      const w = BigInt(weight || "0");
      const opening = randomHex32();
      const commitRes = await fetch("/api/compact/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: w.toString(), opening }),
      });
      const commitData = await commitRes.json();
      if (!commitRes.ok) throw new Error(commitData.error || "Commit failed");

      const res = await fetch(`/api/users/${userId}/strategy/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: w.toString(),
          opening,
          strategyCommitment: commitData.commitment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.reason || data.error || "Prove failed");

      setResult({
        strategyCommitment: data.strategyCommitment,
        strategyId: data.strategyId,
      });
      onLiveProofs?.([
        {
          circuit: "prove_strategy_commitment",
          proof: data.strategyCommitment,
          label: "Strategy",
        },
      ]);
      onSystemsEvent?.({
        source: "app",
        phase: "strategy",
        layer: "proof-server",
        status: "settled",
        title: "Strategy proved",
        detail: "Ledger sees commitment only — weight stayed private",
        circuits: ["prove_strategy_commitment"],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Strategy commit failed");
      onSystemsEvent?.({
        source: "app",
        phase: "strategy",
        layer: "compact",
        status: "error",
        title: "Strategy failed",
        detail: e instanceof Error ? e.message : "error",
        circuits: ["prove_strategy_commitment"],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="strategy atelier-panel">
      <header className="strategy__head">
        <p className="atelier-kicker">Private strategy</p>
        <h1 className="brand-mark">Commit</h1>
        <p className="strategy__lede">
          Proprietary strategy params stay off the public ledger. Compact proves the
          commitment without revealing the weight.
        </p>
      </header>

      <label className="strategy__field">
        <span>Private weight (witness)</span>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          disabled={busy}
        />
      </label>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="strategy__result">
          <p>
            <strong>Public commitment</strong>
          </p>
          <code>{result.strategyCommitment}</code>
          <p>
            <strong>Strategy id</strong>
          </p>
          <code>{result.strategyId}</code>
          <p className="strategy__note">
            Circuit: prove_strategy_commitment · weight never published
          </p>
        </div>
      )}

      <div className="strategy__actions">
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void commit()}
        >
          {busy ? "Proving…" : "Commit strategy"}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={onBack}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
