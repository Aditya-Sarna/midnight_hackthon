import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ComplianceStrip } from "./ComplianceStrip";
import { CircledProofPanel } from "./CircledProofPanel";

type ProofEvent = {
  id: string;
  title: string;
  circuit: string;
  detail: string;
  hash?: string;
  ms?: number;
  status: "pending" | "live" | "done";
};

type Props = {
  refreshKey?: number;
  liveProofs?: {
    circuit: string;
    proof: string;
    label: string;
    ms?: number;
    snarkDigest?: string;
  }[];
  /** Guided tour: which stage to emphasize */
  focus?: "kyc" | "recv" | "pol" | "spend" | "nyxproof" | "ledger" | null;
};

export function ProofTheater({ refreshKey = 0, liveProofs = [], focus = null }: Props) {
  const [root, setRoot] = useState("—");
  const [events, setEvents] = useState<{ id: string; type: string; note?: string; timestamp: number }[]>([]);
  const [pendingRelay, setPendingRelay] = useState(0);
  const [mode, setMode] = useState("—");
  const [modeDetail, setModeDetail] = useState("");
  const [transfers, setTransfers] = useState("0");
  const [serverOk, setServerOk] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [ledger, health] = await Promise.all([api.ledger(), api.health()]);
        if (!alive) return;
        setRoot(ledger.kycRegistryRoot);
        setEvents(ledger.events.slice(0, 12));
        setPendingRelay(ledger.pendingInRelay);
        setMode(health.proofMode?.mode ?? "—");
        setModeDetail(health.proofMode?.detail ?? "");
        setServerOk(Boolean(health.proofMode?.proofServerOk));
        setTransfers(health.compactLedger?.transferCount ?? String(ledger.spentNullifierCount));
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshKey]);

  const stages: ProofEvent[] = [
    {
      id: "kyc",
      title: "ZK-KYC membership",
      circuit: "prove_kyc_membership",
      detail: "Merkle inclusion · nullifier not revoked",
      status: root !== "—" ? "done" : "pending",
      hash: root !== "—" ? root : undefined,
    },
    {
      id: "recv",
      title: "Recipient binding",
      circuit: "prove_recipient_valid",
      detail: "Enrollment signature · KYC leaf bind",
      status: liveProofs.some((p) => p.circuit.includes("recipient")) ? "live" : "pending",
      hash:
        liveProofs.find((p) => p.circuit.includes("recipient"))?.snarkDigest ||
        liveProofs.find((p) => p.circuit.includes("recipient"))?.proof,
      ms: liveProofs.find((p) => p.circuit.includes("recipient"))?.ms,
    },
    {
      id: "pol",
      title: "Policy compliance",
      circuit: "prove_policy_update",
      detail: "Private amount witness · T1–T6 templates",
      status: liveProofs.some((p) => p.circuit.includes("policy")) ? "live" : "pending",
      hash: liveProofs.find((p) => p.circuit.includes("policy"))?.proof,
      ms: liveProofs.find((p) => p.circuit.includes("policy"))?.ms,
    },
    {
      id: "spend",
      title: "Spend update",
      circuit: "prove_spend_update",
      detail: "Balance commit · nullifier · amount private",
      status: liveProofs.some((p) => p.circuit.includes("spend")) ? "live" : "pending",
      hash:
        liveProofs.find((p) => p.circuit.includes("spend"))?.snarkDigest ||
        liveProofs.find((p) => p.circuit.includes("spend"))?.proof,
      ms: liveProofs.find((p) => p.circuit.includes("spend"))?.ms,
    },
    {
      id: "nyxproof",
      title: "CircledProof session auth",
      circuit: "prove_session_auth",
      detail: "OTP replacement · challenge-bound · nonce burn",
      status: liveProofs.some((p) => p.circuit.includes("session_auth")) ? "live" : "pending",
      hash: liveProofs.find((p) => p.circuit.includes("session_auth"))?.proof,
      ms: liveProofs.find((p) => p.circuit.includes("session_auth"))?.ms,
    },
  ];

  return (
    <aside className="theater">
      <header className="theater__head">
        <div>
          <p className="theater__eyebrow">Midnight proof theater</p>
          <h2>Live verification</h2>
        </div>
        <span className="theater__badge">{mode}</span>
      </header>

      <div className="theater__root">
        <span>kyc_registry_root</span>
        <code>{root.slice(0, 28)}…</code>
      </div>
      <p className="theater__mode muted">
        {modeDetail || `Compact transfers ${transfers}`}
        {serverOk
          ? " · SNARK path: proof-server /prove (grade zk-proved on settle)"
          : " · Compact-runtime until proof-server is up"}
      </p>

      <ul className="theater__stages">
        {stages.map((s) => (
          <li
            key={s.id}
            className={`theater__stage theater__stage--${s.status} ${
              focus === s.id ? "theater__stage--focus" : ""
            }`}
          >
            <div className="theater__stage-top">
              <strong>{s.title}</strong>
              <em>
                {s.ms != null ? `${s.ms}ms` : s.status}
              </em>
            </div>
            <code>{s.circuit}</code>
            <p>{s.detail}</p>
            {s.hash && <code className="theater__hash">{s.hash.slice(0, 40)}…</code>}
            {s.ms != null && (
              <div className="theater__timing" style={{ ["--ms" as string]: String(Math.min(s.ms, 2400)) }}>
                <i />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className={`theater__ledger ${focus === "ledger" ? "theater__ledger--focus" : ""}`}>
        <div className="theater__ledger-head">
          <strong>Ledger events</strong>
          <span>relay queue {pendingRelay}</span>
        </div>
        <ul>
          {events.length === 0 && <li className="muted">Awaiting settlement…</li>}
          {events.map((e) => (
            <li key={e.id}>
              <strong>{e.type}</strong>
              <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
              {e.note && <em>{e.note}</em>}
            </li>
          ))}
        </ul>
      </div>

      <ComplianceStrip />
      <CircledProofPanel />
    </aside>
  );
}
