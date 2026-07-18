import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeScreen } from "./HomeScreen";
import { ContactList } from "./ContactList";
import { CreditPing, type CreditPingModel } from "../components/CreditPing";
import { PaymentPing, type PaymentEdits } from "../components/PaymentPing";
import { Glyph } from "../components/Glyph";
import { type PublicUser } from "../lib/api";
import { clientConfirm, clientIntent } from "../lib/bootstrap";
import {
  creditBorrow,
  creditRepay,
  creditStanding,
  fetchBorrowDisclosure,
  fetchCreditLoans,
  fetchCreditStatus,
} from "../lib/credit";
import {
  defaultCollateralForLoan,
  parseCreditUtterance,
  type CreditVoiceIntent,
} from "../lib/creditVoice";
import { loadVault, type DeviceVaultState } from "../lib/deviceVault";
import { ensureVaultUnlocked } from "../lib/webauthnVault";
import {
  defaultUiLocale,
  detectLocaleFromText,
  isRtlLocale,
  payCopy,
  type UiLocale,
} from "../lib/i18n";
import {
  speechRecognitionAvailable,
  startVoiceListen,
  type VoiceListenHandle,
} from "../lib/voice";
import { evaluateVoiceGate } from "../lib/voiceGate";

type Phase =
  | "home"
  | "app"
  | "contacts"
  | "listening"
  | "verifying"
  | "ping"
  | "settling"
  | "settled"
  | "denied"
  | "error";

type LiveProof = {
  circuit: string;
  proof: string;
  label: string;
  ms?: number;
  snarkDigest?: string;
};

export type WalletGuideCommand =
  | { type: "idle" }
  | { type: "openApp" }
  | { type: "runPayment"; utterance: string }
  | { type: "confirm" }
  | { type: "home" };

type Props = {
  user: PublicUser;
  onUserChange: (u: PublicUser) => void;
  onOpenRecovery: () => void;
  onLiveProofs?: (proofs: LiveProof[]) => void;
  onSettled?: () => void;
  /** Guided tour: external autofill / confirm commands */
  guideCommand?: WalletGuideCommand | null;
  guideCommandKey?: number;
  onPhaseChange?: (phase: Phase) => void;
};

export function Wallet({
  user,
  onUserChange,
  onOpenRecovery,
  onLiveProofs,
  onSettled,
  guideCommand = null,
  guideCommandKey = 0,
  onPhaseChange,
}: Props) {
  const [phase, setPhase] = useState<Phase>("home");
  const [pendingBundle, setPendingBundle] = useState<Awaited<ReturnType<typeof clientIntent>> | null>(
    null
  );
  const [pendingCredit, setPendingCredit] = useState<CreditPingModel | null>(null);
  /** True while a credit voice/typed flow is in flight (avoids PaymentPing flash) */
  const [creditFlow, setCreditFlow] = useState(false);
  const [successLabel, setSuccessLabel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [uiLocale, setUiLocale] = useState<UiLocale>(() => defaultUiLocale());
  const [voiceOk, setVoiceOk] = useState(false);
  const [vault, setVault] = useState<DeviceVaultState | null>(null);
  const [voiceRisk, setVoiceRisk] = useState(false);
  const [recipientCandidates, setRecipientCandidates] = useState<string[]>([]);
  const voiceRef = useRef<VoiceListenHandle | null>(null);
  const pendingRef = useRef(pendingBundle);
  const pendingCreditRef = useRef(pendingCredit);
  const busyRef = useRef(busy);
  pendingRef.current = pendingBundle;
  pendingCreditRef.current = pendingCredit;
  busyRef.current = busy;
  const t = useMemo(() => payCopy(uiLocale), [uiLocale]);
  const rtl = isRtlLocale(uiLocale);

  useEffect(() => {
    setVoiceOk(speechRecognitionAvailable());
    void loadVault(user.id).then(setVault);
    return () => {
      voiceRef.current?.stop();
    };
  }, [user.id]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const runCreditIntent = useCallback(
    async (intent: CreditVoiceIntent) => {
      setCreditFlow(true);
      setPhase("verifying");
      setPendingBundle(null);
      setPendingCredit({
        kind: intent.kind,
        amount: intent.kind === "borrow" ? intent.loanAmount : 0,
        collateralAmount:
          intent.kind === "borrow"
            ? intent.collateralAmount ?? defaultCollateralForLoan(intent.loanAmount)
            : undefined,
      });
      setMessage("");
      onLiveProofs?.([
        { circuit: "prove_collateral_lock", proof: "…", label: "Collateral" },
        { circuit: "prove_loan_repayment", proof: "…", label: "Repayment" },
        { circuit: "prove_credit_standing", proof: "…", label: "Standing" },
      ]);
      try {
        const v = await loadVault(user.id);
        if (!v) {
          setCreditFlow(false);
          setPendingCredit(null);
          setPhase("error");
          setMessage("Unlock vault first — open Circled app once");
          setTimeout(() => {
            setPhase("home");
            setMessage("");
          }, 2800);
          return;
        }
        setVault(v);

        if (intent.kind === "borrow") {
          const loanAmount = intent.loanAmount;
          const collateralAmount =
            intent.collateralAmount ?? defaultCollateralForLoan(loanAmount);
          if (2 * collateralAmount < 3 * loanAmount) {
            setCreditFlow(false);
            setPendingCredit(null);
            setPhase("error");
            setMessage(`Need ≥150% collateral (min ${defaultCollateralForLoan(loanAmount)})`);
            setTimeout(() => {
              setPhase("home");
              setMessage("");
            }, 2800);
            return;
          }
          const status = await fetchCreditStatus();
          const available = Number(status?.pool?.available ?? 0);
          if (loanAmount > available) {
            setCreditFlow(false);
            setPendingCredit(null);
            setPhase("error");
            setMessage(
              available <= 0
                ? "No pool liquidity — deposit as a lender first (Credit screen)"
                : `Pool only has ${available} available`
            );
            setTimeout(() => {
              setPhase("home");
              setMessage("");
            }, 3200);
            return;
          }
          if (v.balance < collateralAmount) {
            setCreditFlow(false);
            setPendingCredit(null);
            setPhase("error");
            setMessage(`Need ${collateralAmount} free balance to lock collateral`);
            setTimeout(() => {
              setPhase("home");
              setMessage("");
            }, 2800);
            return;
          }
          const disc = await fetchBorrowDisclosure({ loanAmount, collateralAmount });
          setPendingCredit({
            kind: "borrow",
            amount: loanAmount,
            collateralAmount,
            disclosure: disc.disclosure,
          });
          setPhase("ping");
          return;
        }

        if (intent.kind === "repay") {
          const { loans } = await fetchCreditLoans(user.id);
          const active = (loans ?? []).find(
            (l: { status: string }) => l.status === "active"
          ) as
            | {
                id: string;
                installmentAmount: number;
                remaining: number;
              }
            | undefined;
          if (!active) {
            setCreditFlow(false);
            setPendingCredit(null);
            setPhase("error");
            setMessage("No active loan to repay");
            setTimeout(() => {
              setPhase("home");
              setMessage("");
            }, 2800);
            return;
          }
          setPendingCredit({
            kind: "repay",
            amount: active.installmentAmount,
            loanId: active.id,
            remaining: active.remaining,
          });
          setPhase("ping");
          return;
        }

        // standing
        const st = await creditStanding(user.id, {
          onTimeThreshold: 1,
          maxDefaultsAllowed: 0,
        });
        setPendingCredit({
          kind: "standing",
          amount: 0,
          pass: Boolean(st.pass),
          note: st.note || (st.pass ? "Standing threshold met" : "Standing not met — v1 terms only"),
        });
        setPhase("ping");
      } catch (e) {
        setCreditFlow(false);
        setPendingCredit(null);
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Credit request failed");
        setTimeout(() => {
          setPhase("home");
          setMessage("");
        }, 2800);
      }
    },
    [user.id, onLiveProofs]
  );

  const runIntent = useCallback(
    async (payload: {
      utterance?: string;
      amount?: number;
      recipient?: string;
      category?: string;
    }) => {
      // Voice / typed credit commands take priority over payment parse
      if (payload.utterance) {
        const credit = parseCreditUtterance(payload.utterance);
        if (credit) {
          await runCreditIntent(credit);
          return;
        }
      }
      setCreditFlow(false);
      setPhase("verifying");
      setPendingBundle(null);
      setPendingCredit(null);
      setMessage("");
      onLiveProofs?.([]);
      try {
        const res = await clientIntent(user.id, { ...payload, category: payload.category || "general" });
        if (!res.ok) {
          setPhase("error");
          setMessage(res.reason || "Proof failed");
          setTimeout(() => {
            setPhase("home");
            setMessage("");
          }, 2800);
          return;
        }
        setPendingBundle(res);
        const p = res.pending;
        const live: LiveProof[] = [
          {
            circuit: p.recipientProof.circuit,
            proof: p.recipientProof.proof,
            label: "Recipient",
          },
          { circuit: p.policyProof.circuit, proof: p.policyProof.proof, label: "Policy" },
          { circuit: p.spendProof.circuit, proof: p.spendProof.proof, label: "Spend" },
        ];
        onLiveProofs?.(live);
        setPhase("ping");
      } catch (e) {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Network error");
        setTimeout(() => {
          setPhase("home");
          setMessage("");
        }, 2800);
      }
    },
    [user.id, onLiveProofs, runCreditIntent]
  );

  function startVoice() {
    if (!speechRecognitionAvailable()) {
      setMessage("Voice unavailable — type a command in Circled app");
      setPhase("app");
      return;
    }
    voiceRef.current?.stop();
    setPhase("listening");
    setTranscript("");
    setUiLocale(defaultUiLocale());
    setMessage(payCopy(defaultUiLocale()).listening);

    const contactLabels = (vault?.contacts ?? []).map((c) => c.label);

    voiceRef.current = startVoiceListen({
      timeoutMs: 14_000,
      contacts: contactLabels,
      onInterim: (text, locale) => {
        setTranscript(text);
        setUiLocale(locale);
      },
      onFinal: (result) => {
        setTranscript(result.transcript);
        setUiLocale(result.uiLocale);
        setRecipientCandidates(result.recipientCandidates ?? []);

        // Circled Credit voice — borrow / repay / standing (before payment gate)
        const credit = parseCreditUtterance(result.transcript);
        if (credit) {
          setVoiceRisk(false);
          void runCreditIntent(credit);
          return;
        }

        const contacts = (vault?.contacts ?? []).map((c) => c.label);
        const gate = evaluateVoiceGate({
          confidence: result.confidence,
          shape: result.shape,
          amount: result.amount,
          recipient: result.recipient,
          contacts,
          production: import.meta.env.PROD,
        });
        // Money never settles from ASR alone — PaymentPing Accept is mandatory.
        // Low confidence / unknown contact forces a louder human review banner.
        setVoiceRisk(gate.lowConfidence || gate.unknownContact || !gate.autoIntent);

        // Production: refuse unknown contacts (must enroll first). Still open ping for review when parse ok.
        if (import.meta.env.PROD && gate.unknownContact && result.recipient) {
          setPhase("error");
          setMessage("Unknown contact — enroll them in Contacts first");
          setTimeout(() => {
            setPhase("home");
            setMessage("");
          }, 2800);
          return;
        }

        if (result.amount && result.recipient) {
          void runIntent({
            amount: result.amount,
            recipient: result.recipient,
            utterance: result.transcript,
            category: "general",
          });
          return;
        }
        if (result.transcript.trim()) {
          void runIntent({
            utterance: result.transcript,
            category: "general",
          });
          return;
        }
        setPhase("home");
        setMessage("");
      },
      onError: (reason) => {
        if (reason === "no-speech" || reason === "aborted") {
          setPhase("home");
          setMessage("");
          return;
        }
        setPhase("app");
        setMessage("Couldn’t hear that — try again or type");
      },
    });
  }

  const confirmSend = useCallback(
    async (edits?: PaymentEdits) => {
      let bundle = pendingRef.current;
      if (!bundle || !bundle.ok || busyRef.current) return;

      const amount = edits?.amount ?? bundle.pending.amount;
      const recipient = edits?.recipient?.trim() || bundle.pending.recipientLabel;
      const changed =
        amount !== bundle.pending.amount ||
        recipient.toLowerCase() !== bundle.pending.recipientLabel.toLowerCase();

      setBusy(true);
      setMessage("");

      try {
        const unlock = await ensureVaultUnlocked({
          userId: user.id,
          displayName: vault?.displayName || user.displayName || "Circled",
        });
        if (!unlock.ok) {
          setPhase("ping");
          setMessage(unlock.reason || "Unlock vault to pay");
          return;
        }

        if (changed) {
          setPhase("verifying");
          const rebuilt = await clientIntent(user.id, {
            amount,
            recipient,
            category: "general",
          });
          if (!rebuilt.ok) {
            setPhase("ping");
            setMessage(rebuilt.reason || "Could not update payment");
            return;
          }
          setPendingBundle(rebuilt);
          pendingRef.current = rebuilt;
          bundle = rebuilt;
          const p = rebuilt.pending;
          onLiveProofs?.([
            {
              circuit: p.recipientProof.circuit,
              proof: p.recipientProof.proof,
              label: "Recipient",
            },
            { circuit: p.policyProof.circuit, proof: p.policyProof.proof, label: "Policy" },
            { circuit: p.spendProof.circuit, proof: p.spendProof.proof, label: "Spend" },
          ]);
        }

        setPhase("settling");
        const data = await clientConfirm(user.id, bundle, { note: edits?.note });
        if (data.user) onUserChange(data.user);
        if (data.vault) setVault(data.vault);
        const timings = (data as { proveTimings?: Record<string, number> }).proveTimings;
        const digests = (data as { snarkDigests?: Record<string, string> }).snarkDigests;
        const live: LiveProof[] = [
          {
            circuit: "prove_recipient_valid",
            proof: digests?.prove_recipient_valid || bundle.pending.recipientProof.proof,
            label: "Recipient",
            ms: timings?.recipient,
            snarkDigest: digests?.prove_recipient_valid,
          },
          {
            circuit: "prove_policy_update",
            proof: bundle.pending.policyProof.proof,
            label: "Policy",
            ms: timings?.policy,
          },
          {
            circuit: "prove_spend_update",
            proof: digests?.prove_spend_update || bundle.pending.spendProof.proof,
            label: "Spend",
            ms: timings?.spend ?? timings?.zkSnark,
            snarkDigest: digests?.prove_spend_update,
          },
        ];
        if (data.sessionProof) {
          live.push({
            circuit: "prove_session_auth",
            proof: data.sessionProof.proof,
            label: "CircledProof",
          });
        }
        onLiveProofs?.(live);
        setPendingBundle(null);
        setPhase("settled");
        onSettled?.();
        setTimeout(() => setPhase("home"), 1600);
      } catch (e) {
        setPhase("ping");
        setMessage(e instanceof Error ? e.message : "Settlement failed");
      } finally {
        setBusy(false);
      }
    },
    [user.id, user.displayName, vault?.displayName, onUserChange, onLiveProofs, onSettled]
  );

  const confirmCredit = useCallback(
    async (edits?: { loanAmount?: number; collateralAmount?: number }) => {
      const model = pendingCreditRef.current;
      if (!model || busyRef.current) return;

      if (model.kind === "standing") {
        setSuccessLabel(model.pass ? "Standing: pass" : "Standing: fail");
        setPendingCredit(null);
        setCreditFlow(false);
        setPhase("settled");
        setTimeout(() => {
          setPhase("home");
          setSuccessLabel("");
        }, 1400);
        return;
      }

      setBusy(true);
      setMessage("");
      try {
        const unlock = await ensureVaultUnlocked({
          userId: user.id,
          displayName: vault?.displayName || user.displayName || "Circled",
        });
        if (!unlock.ok) {
          setPhase("ping");
          setMessage(unlock.reason || "Unlock vault to continue");
          return;
        }

        const v = await loadVault(user.id);
        if (!v) {
          setPhase("ping");
          setMessage("Vault not found");
          return;
        }

        setPhase("settling");
        if (model.kind === "borrow") {
          const loanAmount = edits?.loanAmount ?? model.amount;
          const collateralAmount =
            edits?.collateralAmount ??
            model.collateralAmount ??
            defaultCollateralForLoan(loanAmount);
          const out = await creditBorrow(v, { loanAmount, collateralAmount });
          setVault(out.vault);
          setSuccessLabel(`Loan ${loanAmount} received`);
          onLiveProofs?.([
            {
              circuit: "prove_collateral_lock",
              proof: out.data.loan?.loanCommitment || "ok",
              label: "Collateral lock",
            },
            {
              circuit: "circled-credit",
              proof: out.data.creditIdentity || "ok",
              label: "credit_identity",
            },
          ]);
        } else if (model.kind === "repay" && model.loanId) {
          const out = await creditRepay(v, model.loanId, model.amount);
          setVault(out.vault);
          setSuccessLabel("Installment paid");
          onLiveProofs?.([
            {
              circuit: "prove_loan_repayment",
              proof: out.data.installmentNullifier || "ok",
              label: "Repayment",
            },
          ]);
        }

        setPendingCredit(null);
        setCreditFlow(false);
        setPhase("settled");
        onSettled?.();
        setTimeout(() => {
          setPhase("home");
          setSuccessLabel("");
        }, 1600);
      } catch (e) {
        setPhase("ping");
        setMessage(e instanceof Error ? e.message : "Credit action failed");
      } finally {
        setBusy(false);
      }
    },
    [user.id, user.displayName, vault?.displayName, onLiveProofs, onSettled]
  );

  // Guided tour driver — autofill payment + confirm without judge typing
  useEffect(() => {
    if (!guideCommand || guideCommand.type === "idle") return;
    if (guideCommand.type === "openApp") {
      setPhase("app");
      return;
    }
    if (guideCommand.type === "home") {
      setPhase("home");
      return;
    }
    if (guideCommand.type === "runPayment") {
      setTranscript(guideCommand.utterance);
      setUiLocale(detectLocaleFromText(guideCommand.utterance));
      void runIntent({ utterance: guideCommand.utterance, category: "general" });
      return;
    }
    if (guideCommand.type === "confirm") {
      let tries = 0;
      const tick = () => {
        if (pendingCreditRef.current) {
          void confirmCredit();
          return;
        }
        if (pendingRef.current?.ok) {
          void confirmSend();
          return;
        }
        if (tries++ < 50) window.setTimeout(tick, 120);
      };
      tick();
    }
  }, [guideCommandKey, guideCommand, runIntent, confirmSend, confirmCredit]);

  function deny() {
    if (busy) return;
    setPendingBundle(null);
    setPendingCredit(null);
    setCreditFlow(false);
    setMessage("");
    onLiveProofs?.([]);
    setPhase("denied");
    setTimeout(() => setPhase("home"), 1200);
  }

  const showOverlay =
    phase === "listening" ||
    phase === "verifying" ||
    phase === "ping" ||
    phase === "settling" ||
    phase === "settled" ||
    phase === "denied" ||
    phase === "error";

  const pending = pendingBundle && pendingBundle.ok ? pendingBundle.pending : null;

  if (phase === "contacts" && vault) {
    return (
      <div className="screen wallet wallet--app">
        <ContactList
          vault={vault}
          onVaultChange={setVault}
          onClose={() => setPhase("app")}
          onPay={(label) => {
            setPhase("app");
            void runIntent({ amount: 25, recipient: label, category: "general" });
          }}
        />
      </div>
    );
  }

  if (phase === "app") {
    return (
      <div className="screen wallet wallet--app">
        <button className="back-home" type="button" onClick={() => setPhase("home")}>
          ‹ Home
        </button>
        <button className="vault-link" type="button" onClick={onOpenRecovery} aria-label="Recovery">
          <Glyph size={22} dim />
        </button>
        <div className="wallet__stage">
          <button type="button" className="glyph-hit" onClick={startVoice} aria-label="Speak payment">
            <Glyph size={140} pulse />
          </button>
          <p className="status-text muted" style={{ marginTop: 12 }}>
            On this device · private balance
          </p>
          <p className="status-text muted">Pay someone · or take a loan by voice</p>
          <form
            className="voice-fallback"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const utterance = String(fd.get("cmd") || "").trim();
              if (utterance) {
                setUiLocale(detectLocaleFromText(utterance));
                void runIntent({ utterance, category: "general" });
              }
            }}
          >
            <input
              name="cmd"
              placeholder="pay 25 to Nike · borrow 1000 · repay my loan"
              required
              autoComplete="off"
            />
            <button type="submit" className="btn primary">
              Go
            </button>
          </form>
          <div className="contacts-bar">
            <button type="button" className="btn primary contacts-bar__open" onClick={() => setPhase("contacts")}>
              Contacts ({vault?.contacts?.length ?? 0})
            </button>
          </div>
          <div className="quick" style={{ marginTop: 12 }}>
            {(vault?.contacts ?? []).slice(0, 6).map((c) => (
              <button
                key={c.label}
                type="button"
                className="chip"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>(
                    '.voice-fallback input[name="cmd"]'
                  );
                  if (input) {
                    const prefix = "pay ";
                    const suffix = ` to ${c.label}`;
                    input.value = prefix + suffix;
                    input.focus();
                    const pos = prefix.length;
                    input.setSelectionRange(pos, pos);
                  }
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen home-wrap">
      <HomeScreen
        onOpenCircled={() => setPhase("app")}
        onOpenContacts={() => setPhase("contacts")}
        onPay={startVoice}
        proving={phase === "verifying" || phase === "settling" || phase === "listening"}
        listening={phase === "listening"}
        voiceHint={
          voiceOk
            ? "Tap card · pay someone, or say “borrow 1000”"
            : "Tap card · open app to type"
        }
        vault={vault}
        onVaultChange={setVault}
      />

      {showOverlay && (
        <div
          className="home-overlay"
          onClick={() => {
            if (phase === "ping" && !busy) deny();
          }}
        >
          {phase === "listening" && (
            <div
              className="pay-sheet pay-sheet--verify"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              lang={uiLocale}
              dir={rtl ? "rtl" : "ltr"}
            >
              <div className="pay-sheet__spinner" aria-hidden />
              <p className="pay-sheet__verify-label">{t.listening}</p>
              <p className="pay-sheet__verify-sub">{transcript || t.listeningHint}</p>
            </div>
          )}

          {(phase === "verifying" || phase === "ping") && creditFlow && pendingCredit && (
            <CreditPing
              model={pendingCredit}
              verifying={phase === "verifying"}
              busy={busy}
              error={message}
              onDeny={() => {
                setVoiceRisk(false);
                deny();
              }}
              onConfirm={(edits) => void confirmCredit(edits)}
            />
          )}

          {(phase === "verifying" || phase === "ping") && !creditFlow && (
            <PaymentPing
              amount={pending?.amount ?? 0}
              recipient={pending?.recipientLabel ?? "…"}
              verifying={phase === "verifying"}
              busy={busy}
              error={message}
              locale={uiLocale}
              voiceRisk={voiceRisk}
              recipientCandidates={recipientCandidates}
              requiresSecondaryConfirm={Boolean(pending?.requiresSecondaryConfirm)}
              onDeny={() => {
                setVoiceRisk(false);
                setRecipientCandidates([]);
                deny();
              }}
              onConfirm={(edits) => void confirmSend(edits)}
            />
          )}

          {phase === "settling" && (
            <div
              className="pay-sheet pay-sheet--verify"
              lang={uiLocale}
              dir={rtl ? "rtl" : "ltr"}
            >
              <div className="pay-sheet__spinner" />
              <p className="pay-sheet__verify-label">
                {creditFlow ? "Updating credit…" : t.accepting}
              </p>
              <p className="pay-sheet__verify-sub">
                {creditFlow ? "Collateral lock · pool disbursement" : t.acceptingSub}
              </p>
            </div>
          )}

          {phase === "settled" && (
            <div className="pay-result fade-in success" lang={uiLocale} dir={rtl ? "rtl" : "ltr"}>
              <CheckIcon />
              <p>{successLabel || t.paymentSent}</p>
            </div>
          )}

          {phase === "denied" && (
            <div className="pay-result fade-in danger" lang={uiLocale} dir={rtl ? "rtl" : "ltr"}>
              <XIcon />
              <p>{t.declined}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="pay-result fade-in danger">
              <XIcon />
              <p>{message || "Failed"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l5 5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

