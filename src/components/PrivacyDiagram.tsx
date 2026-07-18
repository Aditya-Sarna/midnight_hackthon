const ROWS: { left: string; right: string }[] = [
  { left: "raw voice audio", right: "proof of valid recipient" },
  { left: "contact list / names", right: "proof of valid spend-update" },
  { left: "recipient wallet address", right: "proof of valid policy compliance" },
  { left: "account balance", right: "nullifier (spend + revocation)" },
  { left: "policy rules & parameters", right: "new balance / policy commitments" },
  { left: "spend history / period counters", right: "generic transfer event + relay jitter" },
  { left: "KYC document / raw identity", right: "KYC credential commitment (once)" },
  { left: "recovery vault contents", right: "encrypted shares (below threshold)" },
];

type Props = {
  checked?: boolean;
  compact?: boolean;
  title?: string;
};

/** §6 privacy boundary — the diagram the skill requires on-screen */
export function PrivacyDiagram({
  checked = false,
  compact = false,
  title = "Privacy boundary",
}: Props) {
  return (
    <div className={`diagram ${compact ? "diagram--compact" : ""}`}>
      {!compact && (
        <>
          <h3 className="diagram__title">{title}</h3>
          <p className="diagram__sub">
            Minimal info, end to end — nothing on the left crosses except as a ZK proof or padded traffic.
          </p>
        </>
      )}
      <div className="diagram__cols">
        <span>Never crosses</span>
        <span>Crosses (proof only)</span>
      </div>
      <ul className="diagram__list">
        {ROWS.map((r) => (
          <li key={r.left} className="diagram__row">
            <div className={`diagram__cell left ${checked ? "checked" : ""}`}>{r.left}</div>
            <div className={`diagram__cell right ${checked ? "checked" : ""}`}>{r.right}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
