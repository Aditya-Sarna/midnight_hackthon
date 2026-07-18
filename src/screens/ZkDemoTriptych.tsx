import { useEffect, useState } from "react";

type Panel = {
  title: string;
  subtitle: string;
  steps: { label: string; detail: string }[];
};

const PANELS: Panel[] = [
  {
    title: "ZK-KYC",
    subtitle: "Midnight membership circuit",
    steps: [
      { label: "Hash identity", detail: "Aadhaar → identity_hash (never stored raw)" },
      { label: "Issuer signature", detail: "Government credential signed off-chain" },
      { label: "Merkle leaf", detail: "leaf = H(hash, jurisdiction, flags, sig)" },
      { label: "Publish root only", detail: "kyc_registry_root on Midnight — no PII" },
    ],
  },
  {
    title: "Recipient + Policy",
    subtitle: "prove_recipient_valid · prove_policy",
    steps: [
      { label: "Local resolve", detail: "“Janhvi” → encrypted contact (device only)" },
      { label: "Enrollment sig", detail: "Recipient signed (label, address) at handshake" },
      { label: "Membership proof", detail: "leaf ∈ KYC tree without revealing leaf" },
      { label: "Policy templates", detail: "T1–T5 satisfied privately; params hidden" },
    ],
  },
  {
    title: "Spend + Relay",
    subtitle: "prove_spend_update · decorrelated settle",
    steps: [
      { label: "Balance commit", detail: "old → new commitment; amount never public" },
      { label: "Nullifier", detail: "Invalidate old state; block double-spend" },
      { label: "Intent sign", detail: "Confirm tap authorizes C = commit(amount, W, n)" },
      { label: "Jittered relay", detail: "Generic transfer event + decoy traffic" },
    ],
  },
];

type Props = {
  onDone: () => void;
};

/** Three side-by-side screens demonstrating Midnight / ZK backend procedures */
export function ZkDemoTriptych({ onDone }: Props) {
  const [active, setActive] = useState(0);
  const [stepIdx, setStepIdx] = useState([0, 0, 0]);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((prev) => {
        const next = [...prev];
        const max = PANELS[active].steps.length;
        if (next[active] < max - 1) {
          next[active] += 1;
          return next;
        }
        if (active < 2) {
          setActive((a) => a + 1);
          return next;
        }
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [active]);

  const allDone = active === 2 && stepIdx[2] >= PANELS[2].steps.length - 1;

  return (
    <div className="zk-demo">
      <header className="zk-demo__head">
        <img src="/glyph.png" alt="" />
        <div>
          <h2>What Midnight proves</h2>
          <p>Three circuits · nothing sensitive crosses the ledger</p>
        </div>
      </header>

      <div className="zk-demo__grid">
        {PANELS.map((panel, i) => (
          <article
            key={panel.title}
            className={`zk-panel ${i === active ? "zk-panel--active" : ""} ${i < active ? "zk-panel--done" : ""}`}
          >
            <div className="zk-panel__top">
              <span className="zk-panel__num">0{i + 1}</span>
              <h3>{panel.title}</h3>
              <p>{panel.subtitle}</p>
            </div>
            <ul className="zk-panel__steps">
              {panel.steps.map((s, si) => {
                const lit = si <= stepIdx[i] && i <= active;
                const current = i === active && si === stepIdx[i];
                return (
                  <li
                    key={s.label}
                    className={`zk-step ${lit ? "zk-step--lit" : ""} ${current ? "zk-step--current" : ""}`}
                  >
                    <span className="zk-step__dot" />
                    <div>
                      <strong>{s.label}</strong>
                      <em>{s.detail}</em>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="zk-panel__footer">
              {i < active || (i === active && stepIdx[i] >= panel.steps.length - 1)
                ? "Proof verified"
                : i === active
                  ? "Proving…"
                  : "Waiting"}
            </div>
          </article>
        ))}
      </div>

      <div className="zk-demo__actions">
        <button type="button" className="btn primary" onClick={onDone} disabled={!allDone}>
          {allDone ? "Continue to Home Screen" : "Running demonstration…"}
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          Skip
        </button>
      </div>
    </div>
  );
}
