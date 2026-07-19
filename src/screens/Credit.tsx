import { useCallback, useEffect, useState } from "react";
import {
  creditBorrow,
  creditPoolDeposit,
  creditRepay,
  creditStanding,
  fetchBorrowDeals,
  fetchBorrowDisclosure,
  fetchCreditIdentity,
  fetchCreditLoans,
  fetchCreditStatus,
} from "../lib/credit";
import type { CreditDeal } from "../components/CreditPing";
import { defaultCollateralForLoan } from "../lib/creditVoice";
import { loadVault, type DeviceVaultState } from "../lib/deviceVault";
import type { PublicUser } from "../lib/api";
import {
  makeSystemsEvent,
  narrativeForCreditAction,
  type SystemsEvent,
} from "../lib/systemsBus";

type Props = {
  user: PublicUser;
  onBack: () => void;
  onSystemsEvent?: (e: SystemsEvent) => void;
  onLiveProofs?: (
    proofs: { circuit: string; proof: string; label: string; ms?: number }[]
  ) => void;
};

/**
 * Circle Credit v1 — same-asset overcollateralized lending.
 * Deliberately NOT marketed as undercollateralized.
 */
export function CreditScreen({ user, onBack, onSystemsEvent, onLiveProofs }: Props) {
  const [vault, setVault] = useState<DeviceVaultState | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loans, setLoans] = useState<
    { id: string; remaining: number; installmentAmount: number; status: string; loanAmount: number; collateralAmount: number }[]
  >([]);
  const [creditIdentity, setCreditIdentity] = useState("");
  const [depositAmt, setDepositAmt] = useState("5000");
  const [loanAmt, setLoanAmt] = useState("1000");
  const [collateralAmt, setCollateralAmt] = useState("1500");
  const [standing, setStanding] = useState<Record<string, unknown> | null>(null);
  const [disclosure, setDisclosure] = useState<Record<string, unknown> | null>(null);
  const [deals, setDeals] = useState<CreditDeal[]>([]);
  const [dealId, setDealId] = useState("standard");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const v = await loadVault(user.id);
    setVault(v);
    const [st, ln, id] = await Promise.all([
      fetchCreditStatus(),
      fetchCreditLoans(user.id),
      fetchCreditIdentity(user.id),
    ]);
    setStatus(st);
    setLoans(ln.loans ?? []);
    setCreditIdentity(id.creditIdentity ?? "");
  }, [user.id]);

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refresh]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchBorrowDeals({
        loanAmount: Number(loanAmt) || 1000,
        collateralAmount: Number(collateralAmt) || 1500,
      })
        .then((res) => {
          setDisclosure(res.disclosure ?? null);
          const list = (res.deals ?? []) as CreditDeal[];
          setDeals(list);
          setDealId((prev) => {
            const still = list.find((d) => d.id === prev);
            return still?.id ?? list.find((d) => d.recommended)?.id ?? list[0]?.id ?? "standard";
          });
        })
        .catch(() => {
          setDisclosure(null);
          setDeals([]);
          void fetchBorrowDisclosure({
            loanAmount: Number(loanAmt) || 1000,
            collateralAmount: Number(collateralAmt) || 1500,
          })
            .then((disc) => setDisclosure(disc.disclosure ?? null))
            .catch(() => undefined);
        });
    }, 200);
    return () => window.clearTimeout(t);
  }, [loanAmt, collateralAmt]);

  async function run(
    label: string,
    fn: () => Promise<void>,
    creditAction?: "deposit" | "borrow" | "repay" | "standing"
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    if (creditAction) {
      onSystemsEvent?.(makeSystemsEvent(narrativeForCreditAction(creditAction)));
      const circuits = narrativeForCreditAction(creditAction).circuits ?? [];
      onLiveProofs?.(
        circuits.map((c) => ({ circuit: c, proof: "…", label: c.replace(/^prove_/, "") }))
      );
    }
    try {
      await fn();
      setMessage(label);
      if (creditAction) {
        onSystemsEvent?.(
          makeSystemsEvent({
            ...narrativeForCreditAction(creditAction),
            status: "settled",
            title: label,
            intensity: 0.45,
          })
        );
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      onSystemsEvent?.(
        makeSystemsEvent({
          source: "credit",
          phase: "error",
          title: "Credit action failed",
          detail: e instanceof Error ? e.message : "Failed",
          layer: "compact",
          status: "error",
          intensity: 0.5,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  const pool = (status?.pool ?? {}) as {
    total?: number;
    outstanding?: number;
    available?: number;
    commitment?: string;
  };

  return (
    <div className="credit atelier-panel">
      <header className="credit__head">
        <p className="atelier-kicker">Circle Credit · v1</p>
        <h1 className="brand-mark">Lend & borrow</h1>
        <p className="credit__lede">
          Same-asset, fully overcollateralized (≥150%). Pool-funded — no lender↔borrower link.
          Not undercollateralized. Not zero-collateral.
        </p>
      </header>

      <section className="credit__card">
        <h2>Pool</h2>
        <p>
          Available <strong>{pool.available ?? 0}</strong> · Total {pool.total ?? 0} · Outstanding{" "}
          {pool.outstanding ?? 0}
        </p>
        <code className="credit__mono">{(pool.commitment ?? "—").slice(0, 40)}…</code>
      </section>

      <section className="credit__card">
        <h2>Your credit identity</h2>
        <p className="credit__hint">
          Scoped exception to unlinkability — links only your loans, never payments or Circle-Auth.
        </p>
        <code className="credit__mono">{creditIdentity.slice(0, 48) || "—"}…</code>
        <p className="credit__balance">
          Free balance: <strong>{vault?.balance ?? "…"}</strong>
          {vault?.lockedCollateral && Object.keys(vault.lockedCollateral).length > 0 && (
            <>
              {" "}
              · Locked{" "}
              <strong>
                {Object.values(vault.lockedCollateral).reduce((a, b) => a + b, 0)}
              </strong>
            </>
          )}
        </p>
      </section>

      <section className="credit__card">
        <h2>Lend to pool</h2>
        <label className="credit__field">
          <span>Deposit amount</span>
          <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} type="number" />
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={busy || !vault}
          onClick={() =>
            void run(
              "Deposited to pool",
              async () => {
                if (!vault) return;
                const { vault: next } = await creditPoolDeposit(vault, Number(depositAmt));
                setVault(next);
              },
              "deposit"
            )
          }
        >
          Deposit
        </button>
      </section>

      <section className="credit__card">
        <h2>Compliance</h2>
        <p className="credit__hint">
          Bureau mode:{" "}
          <strong>{String((status?.compliance as { bureauFurnishing?: string })?.bureauFurnishing ?? "—")}</strong>
          {" · "}
          APR{" "}
          <strong>
            {String(
              ((status?.compliance as { disclosedAprBps?: number })?.disclosedAprBps ?? 1200) / 100
            )}
            %
          </strong>
        </p>
        <p className="credit__hint">
          Lending license is jurisdiction-specific legal review. Rate is always disclosed to you;
          standing proofs stay pass/fail unless bureau selective-disclosure is compelled.
        </p>
      </section>

      <section className="credit__card">
        <h2>Your loan deals</h2>
        <div className="credit__row">
          <label className="credit__field">
            <span>Loan</span>
            <input
              value={loanAmt}
              onChange={(e) => {
                const v = e.target.value;
                setLoanAmt(v);
                const n = Math.floor(Number(v));
                if (n > 0) setCollateralAmt(String(defaultCollateralForLoan(n)));
              }}
              type="number"
            />
          </label>
          <label className="credit__field">
            <span>Collateral (locked at 150%)</span>
            <input
              value={collateralAmt}
              readOnly
              type="number"
              title="Collateral is fixed at 150% of the loan"
              aria-readonly="true"
            />
          </label>
        </div>
        {deals.length > 0 && (
          <div className="credit-ping__deal-list credit__deal-list" role="radiogroup" aria-label="Choose a loan deal">
            {deals.map((deal) => {
              const active = deal.id === dealId;
              const disc = deal.disclosure;
              return (
                <button
                  key={deal.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`credit-ping__deal${active ? " is-active" : ""}`}
                  onClick={() => setDealId(deal.id)}
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
        )}
        {(() => {
          const selected = deals.find((d) => d.id === dealId);
          const disc = selected?.disclosure ?? disclosure;
          if (!disc) return null;
          return (
            <p className="credit__hint">
              {selected ? `${selected.label} · ` : ""}
              APR {String(disc.aprPercent)} · est. interest {String(disc.estimatedInterest)} ·
              collateral {String(disc.collateralRatioPercent)}
            </p>
          );
        })()}
        <button
          type="button"
          className="btn primary"
          disabled={busy || !vault}
          onClick={() =>
            void run(
              "Loan booked",
              async () => {
                if (!vault) return;
                onSystemsEvent?.(makeSystemsEvent(narrativeForCreditAction("borrow")));
                const selected = deals.find((d) => d.id === dealId);
                const loan = Math.floor(Number(loanAmt));
                const { vault: next } = await creditBorrow(vault, {
                  loanAmount: loan,
                  collateralAmount: defaultCollateralForLoan(loan),
                  installments: selected?.installments ?? 4,
                });
                setVault(next);
              },
              "borrow"
            )
          }
        >
          Lock collateral & borrow
          {deals.find((d) => d.id === dealId)
            ? ` · ${deals.find((d) => d.id === dealId)!.label}`
            : ""}
        </button>
      </section>

      <section className="credit__card">
        <h2>Your loans</h2>
        {loans.length === 0 && <p className="credit__hint">No loans yet.</p>}
        <ul className="credit__loans">
          {loans.map((l) => (
            <li key={l.id}>
              <div>
                <strong>{l.status}</strong> · {l.remaining} left of {l.loanAmount}
                <em>
                  {" "}
                  · collateral {l.collateralAmount} · installment {l.installmentAmount}
                </em>
              </div>
              {l.status === "active" && (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || !vault}
                  onClick={() =>
                    void run(
                      "Installment paid",
                      async () => {
                        if (!vault) return;
                        const { vault: next } = await creditRepay(
                          vault,
                          l.id,
                          l.installmentAmount
                        );
                        setVault(next);
                      },
                      "repay"
                    )
                  }
                >
                  Repay installment
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="credit__card">
        <h2>Credit standing</h2>
        <p className="credit__hint">Threshold pass/fail only — never a numeric score.</p>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() =>
            void run(
              "Standing checked",
              async () => {
                const s = await creditStanding(user.id, {
                  onTimeThreshold: 1,
                  maxDefaultsAllowed: 0,
                });
                setStanding(s);
              },
              "standing"
            )
          }
        >
          Prove standing (≥1 on-time, 0 defaults)
        </button>
        {standing && (
          <p className={standing.pass ? "credit__ok" : "credit__warn"}>
            {standing.pass ? "PASS" : "FAIL"} · {String(standing.note ?? "")}
            {standing.v1Only ? " · v1-only eligibility" : ""}
          </p>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      {message && <p className="credit__ok">{message}</p>}

      <button type="button" className="btn ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
