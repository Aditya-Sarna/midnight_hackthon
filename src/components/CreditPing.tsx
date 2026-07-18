import { useEffect, useMemo, useState } from "react";

export type CreditPingKind = "borrow" | "repay" | "standing";

export type CreditDisclosure = {
  aprPercent: string;
  principal: number;
  estimatedInterest: number;
  totalRepayable: number;
  installmentAmount: number;
  installments: number;
  collateralAmount: number;
  collateralRatioPercent: string;
  notice: string;
};

export type CreditPingModel = {
  kind: CreditPingKind;
  /** Borrow: loan amount · Repay: installment · Standing: unused */
  amount: number;
  collateralAmount?: number;
  loanId?: string;
  remaining?: number;
  note?: string;
  pass?: boolean;
  disclosure?: CreditDisclosure;
};

type Props = {
  model: CreditPingModel;
  verifying?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: (edits?: { loanAmount?: number; collateralAmount?: number }) => void;
  onDeny: () => void;
};

/** Confirm sheet for voice Circled Credit — Accept + rate disclosure required. */
export function CreditPing({ model, verifying, busy, error, onConfirm, onDeny }: Props) {
  const [loanAmt, setLoanAmt] = useState(String(model.amount));
  const [colAmt, setColAmt] = useState(
    String(model.collateralAmount ?? Math.ceil((model.amount * 3) / 2))
  );
  const [rateAck, setRateAck] = useState(false);

  useEffect(() => {
    setLoanAmt(String(model.amount));
    setColAmt(String(model.collateralAmount ?? Math.ceil((model.amount * 3) / 2)));
    setRateAck(false);
  }, [model.amount, model.collateralAmount, model.kind, model.loanId, model.disclosure?.aprPercent]);

  const title = useMemo(() => {
    if (model.kind === "borrow") return "Confirm loan";
    if (model.kind === "repay") return "Confirm repayment";
    return "Credit standing";
  }, [model.kind]);

  const d = model.disclosure;
  const canAcceptBorrow = rateAck || !d;

  if (verifying) {
    return (
      <div className="pay-sheet pay-sheet--verify" role="status">
        <div className="pay-sheet__spinner" aria-hidden />
        <p className="pay-sheet__verify-label">Checking credit privately</p>
        <p className="pay-sheet__verify-sub">Pool · collateral · APR disclosure · standing</p>
      </div>
    );
  }

  return (
    <div
      className="pay-sheet credit-ping"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-ping-title"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="pay-sheet__eyebrow">Circled Credit · v1 overcollateralized</p>
      <h2 id="credit-ping-title" className="pay-sheet__title">
        {title}
      </h2>

      {model.kind === "borrow" && (
        <>
          <label className="pay-sheet__field">
            <span>Loan amount</span>
            <input
              inputMode="numeric"
              value={loanAmt}
              onChange={(e) => setLoanAmt(e.target.value)}
              aria-label="Loan amount"
            />
          </label>
          <label className="pay-sheet__field">
            <span>Collateral (≥150%)</span>
            <input
              inputMode="numeric"
              value={colAmt}
              onChange={(e) => setColAmt(e.target.value)}
              aria-label="Collateral amount"
            />
          </label>

          {d && (
            <div className="credit-ping__disclosure" role="region" aria-label="Loan rate disclosure">
              <p className="credit-ping__disclosure-title">Rate disclosure</p>
              <ul>
                <li>APR {d.aprPercent}</li>
                <li>
                  Est. interest {d.estimatedInterest} · total repayable ~{d.totalRepayable}
                </li>
                <li>
                  {d.installments} installments · ~{d.installmentAmount} principal each
                </li>
                <li>
                  Collateral {d.collateralAmount} ({d.collateralRatioPercent})
                </li>
              </ul>
              <p className="pay-sheet__hint">{d.notice}</p>
              <label className="credit-ping__ack">
                <input
                  type="checkbox"
                  checked={rateAck}
                  onChange={(e) => setRateAck(e.target.checked)}
                />
                <span>I understand the APR and collateral terms</span>
              </label>
            </div>
          )}

          {!d && (
            <p className="pay-sheet__hint">
              Same-asset lock · pool-funded · no undercollateralized terms
            </p>
          )}
        </>
      )}

      {model.kind === "repay" && (
        <>
          <p className="pay-sheet__hero-amt">{model.amount}</p>
          <p className="pay-sheet__hint">
            Installment toward loan {model.loanId?.slice(0, 12) ?? "…"}
            {model.remaining != null ? ` · ${model.remaining} remaining` : ""}
          </p>
        </>
      )}

      {model.kind === "standing" && (
        <>
          <p className={`pay-sheet__hero-amt ${model.pass ? "credit-ping__pass" : "credit-ping__fail"}`}>
            {model.pass ? "Pass" : "Fail"}
          </p>
          <p className="pay-sheet__hint">
            {model.note || "Threshold proof only — no numeric score · counts enforced in Compact"}
          </p>
        </>
      )}

      {error && <p className="pay-sheet__error">{error}</p>}

      <div className="pay-sheet__actions">
        <button type="button" className="btn ghost" disabled={busy} onClick={onDeny}>
          Decline
        </button>
        {model.kind === "standing" ? (
          <button type="button" className="btn primary" disabled={busy} onClick={() => onConfirm()}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={busy || (model.kind === "borrow" && !canAcceptBorrow)}
            onClick={() => {
              if (model.kind === "borrow") {
                onConfirm({
                  loanAmount: Math.floor(Number(loanAmt)),
                  collateralAmount: Math.floor(Number(colAmt)),
                });
              } else {
                onConfirm();
              }
            }}
          >
            {busy ? "Working…" : model.kind === "borrow" ? "Accept loan" : "Pay installment"}
          </button>
        )}
      </div>
    </div>
  );
}
