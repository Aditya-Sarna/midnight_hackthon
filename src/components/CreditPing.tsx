import { useEffect, useMemo, useState } from "react";
import { fetchBorrowDeals } from "../lib/credit";
import { defaultCollateralForLoan } from "../lib/creditVoice";

export type CreditPingKind = "borrow" | "repay" | "standing";

export type CreditDisclosure = {
  aprPercent: string;
  principal: number;
  estimatedInterest: number;
  totalRepayable: number;
  installmentAmount: number;
  installments: number;
  termMonths?: number;
  termDays?: number;
  termLabel?: string;
  installmentPeriodDays?: number;
  collateralAmount: number;
  collateralRatioPercent: string;
  notice: string;
};

export type CreditDeal = {
  id: string;
  label: string;
  blurb: string;
  installments: number;
  recommended?: boolean;
  disclosure: CreditDisclosure;
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
  deals?: CreditDeal[];
  /** Soft pool warning — sheet still opens from the home widget */
  poolAvailable?: number;
  poolNote?: string;
};

type Props = {
  model: CreditPingModel;
  verifying?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: (edits?: {
    loanAmount?: number;
    collateralAmount?: number;
    installments?: number;
  }) => void;
  onDeny: () => void;
};

/** Confirm sheet for voice Circle Credit — deal picker + rate disclosure required. */
export function CreditPing({ model, verifying, busy, error, onConfirm, onDeny }: Props) {
  const [loanAmt, setLoanAmt] = useState(String(model.amount));
  const [colAmt, setColAmt] = useState(
    String(model.collateralAmount ?? Math.ceil((model.amount * 3) / 2))
  );
  const [rateAck, setRateAck] = useState(false);
  const [deals, setDeals] = useState<CreditDeal[]>(model.deals ?? []);
  const [dealId, setDealId] = useState<string>(() => {
    const list = model.deals ?? [];
    return list.find((d) => d.recommended)?.id ?? list[0]?.id ?? "standard";
  });
  const [dealsLoading, setDealsLoading] = useState(false);

  useEffect(() => {
    setLoanAmt(String(model.amount));
    setColAmt(String(model.collateralAmount ?? Math.ceil((model.amount * 3) / 2)));
    setRateAck(false);
    if (model.deals?.length) {
      setDeals(model.deals);
      setDealId(model.deals.find((d) => d.recommended)?.id ?? model.deals[0].id);
    }
  }, [model.amount, model.collateralAmount, model.kind, model.loanId, model.deals]);

  // Refresh deal math when loan (and locked 150% collateral) change
  useEffect(() => {
    if (model.kind !== "borrow") return;
    const loanAmount = Math.floor(Number(loanAmt));
    const collateralAmount = Math.floor(Number(colAmt));
    if (!(loanAmount > 0) || !(collateralAmount > 0)) return;
    if (
      loanAmount === model.amount &&
      collateralAmount ===
        (model.collateralAmount ?? defaultCollateralForLoan(model.amount)) &&
      (model.deals?.length ?? 0) > 0
    ) {
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setDealsLoading(true);
      void fetchBorrowDeals({ loanAmount, collateralAmount })
        .then((res) => {
          if (cancelled || !res?.deals?.length) return;
          setDeals(res.deals as CreditDeal[]);
          setDealId((prev) => {
            const still = (res.deals as CreditDeal[]).find((d) => d.id === prev);
            return (
              still?.id ??
              (res.deals as CreditDeal[]).find((d) => d.recommended)?.id ??
              res.deals[0].id
            );
          });
          setRateAck(false);
        })
        .finally(() => {
          if (!cancelled) setDealsLoading(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [model.kind, model.amount, model.collateralAmount, model.deals, loanAmt, colAmt]);

  const title = useMemo(() => {
    if (model.kind === "borrow") return "Your loan deals";
    if (model.kind === "repay") return "Confirm repayment";
    return "Credit standing";
  }, [model.kind]);

  const selectedDeal = deals.find((d) => d.id === dealId) ?? deals[0];
  const d = selectedDeal?.disclosure ?? model.disclosure;
  const loanNum = Math.floor(Number(loanAmt));
  const colNum = Math.floor(Number(colAmt));
  const minCol = loanNum > 0 ? defaultCollateralForLoan(loanNum) : 0;
  const poolOk =
    model.poolAvailable == null || !(loanNum > 0) || loanNum <= model.poolAvailable;
  const collateralOk = loanNum > 0 && colNum >= minCol;
  const canAcceptBorrow = Boolean(rateAck && d && poolOk && collateralOk && !dealsLoading);

  function onLoanAmountChange(raw: string) {
    setLoanAmt(raw);
    const n = Math.floor(Number(raw));
    if (n > 0) {
      setColAmt(String(defaultCollateralForLoan(n)));
    }
    setRateAck(false);
  }

  const acceptBlockReason =
    model.kind !== "borrow"
      ? ""
      : dealsLoading
        ? "Updating deals…"
        : !loanNum
          ? "Enter a loan amount"
          : !collateralOk
            ? `Collateral must be ≥150% (min ${minCol})`
            : !poolOk
              ? model.poolNote || "Not enough pool liquidity"
              : !rateAck
                ? "Confirm you understand the APR & terms"
                : !d
                  ? "Deal details still loading"
                  : "";

  if (verifying) {
    return (
      <div className="pay-sheet pay-sheet--verify" role="status">
        <div className="pay-sheet__spinner" aria-hidden />
        <p className="pay-sheet__verify-label">Checking credit privately</p>
        <p className="pay-sheet__verify-sub">Pool · collateral · APR deals · standing</p>
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
      <p className="pay-sheet__eyebrow">Circle Credit · v1 overcollateralized</p>
      <h2 id="credit-ping-title" className="pay-sheet__title">
        {title}
      </h2>

      {model.kind === "borrow" && model.poolNote && (
        <p className="pay-sheet__risk" role="status">
          {model.poolNote}
        </p>
      )}

      {model.kind === "borrow" && (
        <>
          <label className="pay-sheet__field">
            <span>Loan amount</span>
            <input
              inputMode="numeric"
              value={loanAmt}
              onChange={(e) => onLoanAmountChange(e.target.value)}
              aria-label="Loan amount"
            />
          </label>
          <label className="pay-sheet__field">
            <span>Collateral (locked at 150%)</span>
            <input
              inputMode="numeric"
              value={colAmt}
              readOnly
              aria-readonly="true"
              aria-label="Collateral amount — locked at 150% of loan"
              title="Collateral is fixed at 150% of the loan amount"
            />
            <em>
              Auto-set to {minCol || "…"} when you change the loan — not editable below the floor
            </em>
          </label>

          {deals.length > 0 && (
            <div className="credit-ping__deals" role="radiogroup" aria-label="Choose a loan deal">
              <p className="credit-ping__disclosure-title">
                Choose a deal{dealsLoading ? " · updating…" : ""}
              </p>
              <div className="credit-ping__deal-list">
                {deals.map((deal) => {
                  const active = deal.id === (selectedDeal?.id ?? dealId);
                  const disc = deal.disclosure;
                  return (
                    <button
                      key={deal.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`credit-ping__deal${active ? " is-active" : ""}`}
                      onClick={() => {
                        setDealId(deal.id);
                        setRateAck(false);
                      }}
                    >
                      <span className="credit-ping__deal-top">
                        <span className="credit-ping__deal-label">{deal.label}</span>
                        {deal.recommended && (
                          <span className="credit-ping__deal-badge">Popular</span>
                        )}
                      </span>
                      <span className="credit-ping__deal-blurb">{deal.blurb}</span>
                      <span className="credit-ping__deal-meta">
                        {disc.termLabel ?? `${deal.installments} mo`} · APR {disc.aprPercent}
                      </span>
                      <span className="credit-ping__deal-meta">
                        ~{disc.installmentAmount}/mo · interest ~{disc.estimatedInterest}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {d && (
            <div className="credit-ping__disclosure" role="region" aria-label="Loan details">
              <p className="credit-ping__disclosure-title">
                {selectedDeal ? `${selectedDeal.label} details` : "Loan details"}
              </p>
              <dl className="credit-ping__facts">
                <div>
                  <dt>APR</dt>
                  <dd>{d.aprPercent}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>
                    {d.termLabel ?? `${d.installments} months`}
                    {d.termDays != null ? ` · ~${d.termDays} days` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Installments</dt>
                  <dd>
                    {d.installments} × ~{d.installmentAmount}
                    {d.installmentPeriodDays != null
                      ? ` every ${d.installmentPeriodDays}d`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Est. interest</dt>
                  <dd>{d.estimatedInterest}</dd>
                </div>
                <div>
                  <dt>Total repayable</dt>
                  <dd>~{d.totalRepayable}</dd>
                </div>
                <div>
                  <dt>Collateral</dt>
                  <dd>
                    {d.collateralAmount} ({d.collateralRatioPercent})
                  </dd>
                </div>
              </dl>
              <p className="pay-sheet__hint">{d.notice}</p>
              <label className="credit-ping__ack">
                <input
                  type="checkbox"
                  checked={rateAck}
                  onChange={(e) => setRateAck(e.target.checked)}
                />
                <span>I understand the APR, duration, and collateral terms</span>
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
      {model.kind === "borrow" && !canAcceptBorrow && acceptBlockReason && !busy && (
        <p className="pay-sheet__hint" role="status">
          {acceptBlockReason}
        </p>
      )}

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
            onClick={(e) => {
              e.stopPropagation();
              if (model.kind === "borrow") {
                if (!canAcceptBorrow) return;
                onConfirm({
                  loanAmount: Math.floor(Number(loanAmt)),
                  collateralAmount: Math.floor(Number(colAmt)),
                  installments: selectedDeal?.installments ?? d?.installments,
                });
              } else {
                onConfirm();
              }
            }}
          >
            {busy
              ? "Booking loan…"
              : model.kind === "borrow"
                ? selectedDeal
                  ? `Book ${selectedDeal.label}`
                  : "Book loan"
                : "Pay installment"}
          </button>
        )}
      </div>
    </div>
  );
}
