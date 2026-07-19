import { useEffect, useMemo, useState } from "react";
import type { DeviceVaultState, PaymentRecord } from "../lib/deviceVault";
import { updateSpendingBudgets } from "../lib/deviceVault";
import {
  formatMoney,
  formatMoneyParts,
  getDisplayCurrency,
  type CurrencyCode,
} from "../lib/currency";
import { CurrencyPicker } from "../components/CurrencyPicker";
import { fetchCreditLoans } from "../lib/credit";
import {
  approveRefundOnDevice,
  markPaymentDisputed,
  openPaymentDispute,
} from "../lib/disputes";
type View = "overview" | "expenses" | "insights" | "loans";

type PublicLoan = {
  id: string;
  loanAmount: number;
  collateralAmount: number;
  remaining: number;
  installmentAmount: number;
  installmentsPaid: number;
  installmentsTotal: number;
  status: string;
  dueNextAt: number;
  createdAt: number;
  aprBps?: number;
  aprPercent?: string;
  installmentPeriodDays?: number;
  termDays?: number;
  remainingTermDays?: number;
  collateralRatioPercent?: string;
};

type Props = {
  vault: DeviceVaultState;
  onClose: () => void;
  onVaultChange: (v: DeviceVaultState) => void;
};

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Balance" },
  { id: "expenses", label: "Expenses" },
  { id: "insights", label: "Chart" },
  { id: "loans", label: "Loans" },
];

const CARD_COLORS = ["#A8B59A", "#C4A27A", "#E8D9A0", "#E23D3D", "#4A4A4A", "#E8A06A", "#8FA8A3"];

function categoryFor(p: PaymentRecord): string {
  const c = (p.category || "general").toLowerCase();
  if (c.includes("food") || c.includes("resto")) return "Food";
  if (c.includes("taxi") || c.includes("travel")) return "Taxi";
  if (c.includes("movie") || c.includes("entertain")) return "Movie";
  if (c.includes("design")) return "Design";
  if (c.includes("game")) return "Games";
  if (c.includes("product") || c.includes("shop")) return "Products";
  return c === "general" ? "Transfer" : c.charAt(0).toUpperCase() + c.slice(1);
}

function colorFor(i: number, recipient: string): string {
  const n = recipient.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return CARD_COLORS[(i + n) % CARD_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function SpendingInsights({ vault, onClose, onVaultChange }: Props) {
  const [view, setView] = useState<View>("overview");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>(() => getDisplayCurrency());
  const [categoryCap, setCategoryCap] = useState(String(vault.policy.params.T1?.cap ?? 500_000));
  const [totalCap, setTotalCap] = useState(String(vault.policy.params.T5?.cap ?? 50_000_000));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loans, setLoans] = useState<PublicLoan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState("");

  useEffect(() => {
    const onChange = (e: Event) => setCurrency((e as CustomEvent<CurrencyCode>).detail);
    window.addEventListener("circled:currency", onChange);
    return () => window.removeEventListener("circled:currency", onChange);
  }, []);

  useEffect(() => {
    if (view !== "loans") return;
    let alive = true;
    setLoansLoading(true);
    setLoansError("");
    void fetchCreditLoans(vault.userId)
      .then((data) => {
        if (!alive) return;
        setLoans(Array.isArray(data?.loans) ? data.loans : []);
      })
      .catch((e) => {
        if (!alive) return;
        setLoansError(e instanceof Error ? e.message : "Could not load loans");
        setLoans([]);
      })
      .finally(() => {
        if (alive) setLoansLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [view, vault.userId]);

  const history = vault.paymentHistory ?? [];
  const mask = `****${vault.keypair.pubkey.slice(-4)}`;
  const bal = formatMoneyParts(vault.balance, currency);
  const allTime = history.reduce((s, p) => s + (p.direction === "out" ? p.amount : 0), 0);
  const allFmt = formatMoneyParts(allTime, currency);

  const weekBars = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    const amounts = days.map((_, i) => {
      const d0 = start.getTime() + i * 86400000;
      const d1 = d0 + 86400000;
      return history
        .filter((p) => p.direction === "out" && p.timestamp >= d0 && p.timestamp < d1)
        .reduce((s, p) => s + p.amount, 0);
    });
    const max = Math.max(...amounts, 1);
    const todayIdx = day;
    return days.map((label, i) => ({
      label,
      amount: amounts[i],
      h: 18 + (amounts[i] / max) * 72,
      active: i === todayIdx || (amounts[i] > 0 && amounts[i] === Math.max(...amounts)),
    }));
  }, [history]);

  async function saveBudgets() {
    setSaving(true);
    setSavedMsg("");
    try {
      const next = await updateSpendingBudgets(vault, {
        categoryCap: Number(categoryCap) || 0,
        totalCap: Number(totalCap) || 0,
      });
      onVaultChange(next);
      setSavedMsg("Budgets updated on device");
      setBudgetOpen(false);
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const title =
    view === "overview"
      ? "Budgeting and Spending Insights"
      : view === "expenses"
        ? "Expenses"
        : view === "loans"
          ? "Loan records"
          : "Spending chart";

  return (
    <div className="insights" role="dialog" aria-label="Budgeting and Spending Insights">
      <div className="insights__sheet">
        <header className="insights__head">
          <h1>{title}</h1>
          <button type="button" className="insights__chev" onClick={onClose} aria-label="Close">
            ⌄
          </button>
        </header>

        <nav className="insights__tabs" aria-label="Insights sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={view === tab.id ? "insights__tab insights__tab--on" : "insights__tab"}
              aria-current={view === tab.id ? "page" : undefined}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <CurrencyPicker compact={view !== "overview"} className="insights__currency" />

        <div className="insights__body">
          {view === "overview" && (
            <>
              <div className="insights__orbs" aria-hidden>
                <span />
                <span />
                <span />
              </div>

              <div className="insights__balance">
                <p>Total Balance · {mask}</p>
                <h2>
                  {bal.symbol}
                  {bal.whole}
                  {bal.cents ? <small>.{bal.cents}</small> : null}
                </h2>
              </div>

              <div className="insights__recent-row">
                {history.length === 0 && (
                  <div className="insights__empty-chip">
                    <strong>No payments yet</strong>
                    <em>Send one — it shows up here</em>
                  </div>
                )}
                {history.slice(0, 6).map((p, i) => (
                  <article key={p.id} className="insights__mini">
                    <span
                      className="insights__mini-icon"
                      style={{ background: colorFor(i, p.recipient) }}
                    >
                      {initials(p.recipient)}
                    </span>
                    <div>
                      <strong>{p.recipient}</strong>
                      <em>
                        {p.direction === "out" ? "-" : "+"}
                        {formatMoney(p.amount, currency)}
                      </em>
                    </div>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="insights__budget-cta"
                onClick={() => setBudgetOpen(true)}
              >
                Update spending budgets
              </button>
            </>
          )}

          {view === "expenses" && (
            <div className="insights__stack">
              {history.length === 0 && (
                <p className="insights__empty">Payments you confirm appear in this stack.</p>
              )}
              {history.map((p, i) => (
                <ExpenseCard
                  key={p.id}
                  payment={p}
                  index={i}
                  currency={currency}
                  onDispute={
                    p.direction === "out" && p.status !== "refunded" && p.status !== "disputed"
                      ? async () => {
                          try {
                            const d = await openPaymentDispute(vault.userId, p);
                            const next = await markPaymentDisputed(vault, p.id, d.id);
                            onVaultChange(next);
                            // Pilot: auto-approve refund after open (no merchant network yet)
                            const refunded = await approveRefundOnDevice(next, p, d.id);
                            onVaultChange(refunded);
                          } catch (e) {
                            window.alert(e instanceof Error ? e.message : "Dispute failed");
                          }
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {view === "insights" && (
            <>
              <div className="insights__deck" aria-hidden>
                {CARD_COLORS.slice(0, 4).map((c, i) => (
                  <span key={c} style={{ background: c, zIndex: 4 - i }} />
                ))}
              </div>

              <div className="insights__stack insights__stack--tight">
                {history.slice(0, 3).map((p, i) => (
                  <ExpenseCard key={p.id} payment={p} index={i} currency={currency} />
                ))}
                {history.length === 0 && (
                  <article className="insights__card" style={{ background: "#C4A27A" }}>
                    <span className="insights__card-icon">·</span>
                    <div>
                      <em>Waiting</em>
                      <strong>First payment</strong>
                    </div>
                    <b>—{formatMoney(0, currency)}</b>
                  </article>
                )}
              </div>

              <div className="insights__chart">
                <div className="insights__bars">
                  {weekBars.map((b) => (
                    <div key={b.label} className="insights__bar-col">
                      <div
                        className={`insights__bar ${b.active ? "insights__bar--on" : ""}`}
                        style={{ height: `${b.h}px` }}
                      />
                      <span>{b.label}</span>
                    </div>
                  ))}
                </div>
                <div className="insights__alltime">
                  <span>All Time</span>
                  <strong>
                    {allFmt.symbol}
                    {allFmt.whole}
                    {allFmt.cents ? <small>.{allFmt.cents}</small> : null}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="insights__budget-cta"
                onClick={() => setBudgetOpen(true)}
              >
                Update spending budgets
              </button>
            </>
          )}

          {view === "loans" && (
            <div className="insights__loans">
              {loansLoading && <p className="insights__empty">Loading loan records…</p>}
              {loansError && <p className="insights__empty">{loansError}</p>}
              {!loansLoading && !loansError && loans.length === 0 && (
                <p className="insights__empty">
                  No Circle Credit loans yet. Say “borrow 1000” from the home screen.
                </p>
              )}
              {loans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  currency={currency}
                  lockedOnDevice={vault.lockedCollateral?.[loan.id]}
                />
              ))}
            </div>
          )}
        </div>

        {savedMsg && <p className="insights__toast">{savedMsg}</p>}
      </div>

      {budgetOpen && (
        <div className="insights__budget-modal">
          <div className="insights__budget-card">
            <h3>Spending budgets</h3>
            <p>Class 0 — caps stay on this device. Shown in {currency}.</p>
            <label>
              Category monthly cap (T1)
              <input
                type="number"
                min={0}
                value={categoryCap}
                onChange={(e) => setCategoryCap(e.target.value)}
              />
            </label>
            <label>
              Total spend cap (T5)
              <input
                type="number"
                min={0}
                value={totalCap}
                onChange={(e) => setTotalCap(e.target.value)}
              />
            </label>
            <div className="insights__budget-actions">
              <button type="button" className="btn ghost" onClick={() => setBudgetOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={saving}
                onClick={() => void saveBudgets()}
              >
                {saving ? "Saving…" : "Save budgets"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseCard({
  payment,
  index,
  currency,
  onDispute,
}: {
  payment: PaymentRecord;
  index: number;
  currency: CurrencyCode;
  onDispute?: () => void;
}) {
  const cat = categoryFor(payment);
  return (
    <article className="insights__card" style={{ background: colorFor(index, payment.recipient) }}>
      <span className="insights__card-icon">{initials(payment.recipient)}</span>
      <div>
        <em>
          {cat}
          {payment.status === "disputed"
            ? " · disputed"
            : payment.status === "refunded"
              ? " · refunded"
              : ""}
        </em>
        <strong>{payment.recipient}</strong>
        {onDispute && (
          <button
            type="button"
            className="insights__dispute"
            onClick={(e) => {
              e.stopPropagation();
              onDispute();
            }}
          >
            Dispute / refund
          </button>
        )}
      </div>
      <b>
        {payment.direction === "out" ? "-" : "+"}
        {formatMoney(payment.amount, currency)}
      </b>
    </article>
  );
}

function formatTerm(days: number | undefined): string {
  if (days == null || !Number.isFinite(days)) return "—";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  const weeks = Math.round(days / 7);
  if (weeks < 10) return `${weeks} week${weeks === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

function LoanCard({
  loan,
  currency,
  lockedOnDevice,
}: {
  loan: PublicLoan;
  currency: CurrencyCode;
  lockedOnDevice?: number;
}) {
  const due =
    loan.dueNextAt > 0
      ? new Date(loan.dueNextAt).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
  const opened = new Date(loan.createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className={`insights__loan insights__loan--${loan.status}`}>
      <header className="insights__loan-head">
        <div>
          <em>{loan.status}</em>
          <strong>{formatMoney(loan.loanAmount, currency)}</strong>
        </div>
        <span className="insights__loan-apr">{loan.aprPercent ?? "—"} APR</span>
      </header>
      <dl className="insights__loan-meta">
        <div>
          <dt>Remaining</dt>
          <dd>{formatMoney(loan.remaining, currency)}</dd>
        </div>
        <div>
          <dt>Installment</dt>
          <dd>{formatMoney(loan.installmentAmount, currency)}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {loan.installmentsPaid}/{loan.installmentsTotal}
          </dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{formatTerm(loan.termDays)}</dd>
        </div>
        <div>
          <dt>Left on term</dt>
          <dd>{formatTerm(loan.remainingTermDays)}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>
            every {loan.installmentPeriodDays ?? "—"} day
            {(loan.installmentPeriodDays ?? 0) === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt>Collateral</dt>
          <dd>
            {formatMoney(loan.collateralAmount, currency)}
            {loan.collateralRatioPercent ? ` · ${loan.collateralRatioPercent}` : ""}
          </dd>
        </div>
        <div>
          <dt>Next due</dt>
          <dd>{due}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{opened}</dd>
        </div>
        {lockedOnDevice != null && lockedOnDevice > 0 ? (
          <div>
            <dt>Locked on device</dt>
            <dd>{formatMoney(lockedOnDevice, currency)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="insights__loan-id">#{loan.id.slice(0, 10)}…</p>
    </article>
  );
}
