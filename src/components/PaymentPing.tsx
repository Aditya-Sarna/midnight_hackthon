import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, getDisplayCurrency, type CurrencyCode } from "../lib/currency";
import { api, type BrandLookup, type RecipientVerification } from "../lib/api";
import { defaultUiLocale, isRtlLocale, payCopy, type UiLocale } from "../lib/i18n";
import { DisambiguationFlow } from "./DisambiguationFlow";

export type PaymentEdits = {
  amount: number;
  recipient: string;
  /** Optional private note — encrypted to recipient only */
  note?: string;
};

type Props = {
  amount: number;
  recipient: string;
  verifying?: boolean;
  busy?: boolean;
  error?: string;
  /** Locale inferred from spoken language */
  locale?: UiLocale;
  /** ASR below confidence/shape floors — force careful review */
  voiceRisk?: boolean;
  /** Recipient was not in contacts — saved on-device for this pay */
  newContact?: boolean;
  /** Recipient is not a known contact — require an explicit identity verification before Accept */
  requireRecipientVerification?: boolean;
  proximityAvailable?: boolean;
  recipientCandidates?: string[];
  /** Policy T2 / high-value — require second Accept */
  requiresSecondaryConfirm?: boolean;
  onConfirm: (edits: PaymentEdits) => void;
  onDeny: () => void;
  onIdentityCancel?: () => void;
  onProximity?: () => void;
};

/** Modern payment decision sheet — copy follows spoken language */
export function PaymentPing({
  amount,
  recipient,
  verifying,
  busy,
  error,
  locale: localeProp,
  voiceRisk,
  newContact,
  requireRecipientVerification,
  proximityAvailable = false,
  recipientCandidates = [],
  requiresSecondaryConfirm,
  onConfirm,
  onDeny,
  onIdentityCancel,
  onProximity,
}: Props) {
  const locale = localeProp || defaultUiLocale();
  const t = useMemo(() => payCopy(locale), [locale]);
  const rtl = isRtlLocale(locale);
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [currency, setCurrency] = useState<CurrencyCode>(() => getDisplayCurrency());
  const [brand, setBrand] = useState<BrandLookup | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [unverifiedAck, setUnverifiedAck] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [editAmount, setEditAmount] = useState(String(amount));
  const [editName, setEditName] = useState(recipient);
  const [editNote, setEditNote] = useState("");
  const [secondaryArmed, setSecondaryArmed] = useState(false);
  const [verifyState, setVerifyState] = useState<"idle" | "checking" | "done">("idle");
  const [verifyResult, setVerifyResult] = useState<RecipientVerification | null>(null);
  const verifyRequestRef = useRef(0);

  useEffect(() => {
    const onChange = (e: Event) => setCurrency((e as CustomEvent<CurrencyCode>).detail);
    window.addEventListener("circled:currency", onChange);
    return () => window.removeEventListener("circled:currency", onChange);
  }, []);

  useEffect(() => {
    setEditAmount(String(amount));
    setEditName(recipient);
    setSecondaryArmed(false);
  }, [amount, recipient]);

  // Reset the identity-verification gate whenever the target name changes.
  useEffect(() => {
    setVerifyState("idle");
    setVerifyResult(null);
  }, [editName]);

  async function runRecipientVerify(identityId?: string) {
    const name = editName.trim();
    if (!name) return;
    const requestId = ++verifyRequestRef.current;
    setVerifyState("checking");
    setVerifyResult(null);
    try {
      const res = await Promise.race([
        api.verifyRecipient(name, identityId),
        new Promise<RecipientVerification>((resolve) => {
          window.setTimeout(
            () => resolve({
              ok: true,
              recipient: name,
              status: "unverified",
              basis: "none",
              label: "No safe match",
              detail: "No candidate shared enough to confirm within this request.",
              matches: [],
            }),
            4_000
          );
        }),
      ]);
      if (requestId === verifyRequestRef.current) setVerifyResult(res);
    } catch {
      if (requestId !== verifyRequestRef.current) return;
      setVerifyResult({
        ok: false,
        recipient: name,
        status: "unverified",
        basis: "none",
        label: "Verification unavailable",
        detail: "Could not reach the verification service.",
      });
    } finally {
      if (requestId === verifyRequestRef.current) setVerifyState("done");
    }
  }

  useEffect(() => {
    if (!requireRecipientVerification || !editName.trim() || verifyState !== "idle") return;
    void runRecipientVerify();
  }, [editName, requireRecipientVerification, verifyState]);

  useEffect(() => {
    let alive = true;
    setBrandLoading(true);
    setUnverifiedAck(false);
    setLogoFailed(false);
    void api
      .lookupBrand(editName.trim() || recipient)
      .then((res) => {
        if (alive) setBrand(res);
      })
      .catch(() => {
        if (alive) setBrand(null);
      })
      .finally(() => {
        if (alive) setBrandLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [editName, recipient]);

  useEffect(() => {
    if (verifying || brandLoading) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const root = sheetRef.current;
    if (!root) return;

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onDeny();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault();
          list[list.length - 1]?.focus();
        }
      } else if (i === list.length - 1 || i < 0) {
        e.preventDefault();
        list[0]?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [verifying, brandLoading, busy, onDeny]);

  if (verifying || brandLoading) {
    return (
      <div className="pay-sheet pay-sheet--verify" role="status" lang={locale} dir={rtl ? "rtl" : "ltr"}>
        <div className="pay-sheet__spinner" />
        <p className="pay-sheet__verify-label">
          {verifying ? t.verifyingPrivately : t.checkingMerchant}
        </p>
        <p className="pay-sheet__verify-sub">
          {verifying ? t.verifyingSub : t.checkingMerchantSub}
        </p>
      </div>
    );
  }

  const isVerified = brand?.status === "verified";
  const isUnverifiedBrand = brand?.status === "unverified_brand";
  // Identity gate for non-contact payees: must run verification, and either be
  // verified or explicitly acknowledge paying an unverified recipient.
  const needsRecipientVerify = Boolean(requireRecipientVerification);
  const recipientVerified = verifyResult?.status === "verified";
  const verifyGateBlocks = needsRecipientVerify && !recipientVerified;
  const blockAccept = (isUnverifiedBrand && !unverifiedAck) || verifyGateBlocks;
  const parsedAmount = Number(editAmount);
  const editsValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && editName.trim().length > 0;

  function submitConfirm() {
    if (!editsValid) return;
    if (requiresSecondaryConfirm && !secondaryArmed) {
      setSecondaryArmed(true);
      return;
    }
    onConfirm({
      amount: parsedAmount,
      recipient: editName.trim(),
      note: editNote.trim() || undefined,
    });
  }

  const candidateChips = recipientCandidates.filter(
    (c) => c.toLowerCase() !== editName.trim().toLowerCase()
  );

  if (needsRecipientVerify && verifyState === "checking") {
    return (
      <div className="pay-sheet pay-sheet--verify identity-resolve__loading" role="status">
        <div className="pay-sheet__spinner" aria-hidden />
        <p className="pay-sheet__verify-label">Checking who you meant</p>
        <p className="pay-sheet__verify-sub">Only opted-in hints can appear.</p>
      </div>
    );
  }

  if (needsRecipientVerify && verifyState === "done" && verifyResult && !recipientVerified) {
    return (
      <DisambiguationFlow
        result={verifyResult}
        busy={busy}
        proximityAvailable={proximityAvailable}
        onResolved={(identityId) => void runRecipientVerify(identityId)}
        onNoMatch={() => setVerifyResult(null)}
        onProximity={() => onProximity?.()}
        onRetry={() => (onIdentityCancel ?? onDeny)()}
        onCancel={onIdentityCancel ?? onDeny}
      />
    );
  }

  return (
    <div
      ref={sheetRef}
      className="pay-sheet"
      role="alertdialog"
      aria-modal="true"
      aria-label={t.confirmPayment}
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pay-sheet__brand">
        <img src="/glyph.png" alt="" />
        <span className="brand-mark">Circle</span>
      </div>

      <p className="pay-sheet__eyebrow">{t.eyebrow}</p>

      <div className="pay-sheet__hero" aria-live="polite">
        <em>{t.amount}</em>
        <strong>
          {formatMoney(Number.isFinite(parsedAmount) ? parsedAmount : 0, currency)}
        </strong>
        <span>
          {t.payTo} <b>{editName.trim() || "…"}</b>
        </span>
      </div>

      {isVerified && brand?.brand && (
        <div className="pay-verify pay-verify--ok">
          <div className="pay-verify__logo-wrap">
            {!logoFailed && brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt=""
                className="pay-verify__logo"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="pay-verify__logo-fallback">
                {brand.brand.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="pay-verify__gold-tick" aria-label={t.verified}>
              ✓
            </span>
          </div>
          <div>
            <strong>{brand.brand.name}</strong>
            <em>{t.verifiedPayment}</em>
          </div>
        </div>
      )}

      {isUnverifiedBrand && brand?.brand && (
        <div className="pay-verify pay-verify--warn">
          <div className="pay-verify__logo-wrap pay-verify__logo-wrap--dim">
            {!logoFailed && brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt=""
                className="pay-verify__logo"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="pay-verify__logo-fallback">
                {brand.brand.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="pay-verify__warn-mark" aria-hidden>
              !
            </span>
          </div>
          <div>
            <strong>{brand.brand.name}</strong>
            <em>{t.notVerifiedPayment}</em>
          </div>
          <p className="pay-verify__warn-copy">{t.unverifiedWarn}</p>
          <label className="pay-verify__ack">
            <input
              type="checkbox"
              checked={unverifiedAck}
              onChange={(e) => setUnverifiedAck(e.target.checked)}
            />
            <span>{t.unverifiedAck}</span>
          </label>
        </div>
      )}

      {voiceRisk && (
        <p className="pay-sheet__risk" role="status">
          {t.voiceLowConfidence}
        </p>
      )}

      {!needsRecipientVerify && newContact && (
        <p className="pay-sheet__risk" role="status">
          New contact — Accept saves them on this device for next time.
        </p>
      )}

      {requiresSecondaryConfirm && secondaryArmed && (
        <p className="pay-sheet__risk pay-sheet__risk--secondary" role="status">
          {t.secondaryConfirmHint}
        </p>
      )}

      <label className="pay-sheet__field">
        <span>{t.amount}</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={editAmount}
          disabled={busy}
          onChange={(e) => {
            setSecondaryArmed(false);
            setEditAmount(e.target.value);
          }}
          aria-label={t.amountAria}
        />
      </label>

      <label className="pay-sheet__field">
        <span>{t.payTo}</span>
        <input
          type="text"
          value={editName}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setSecondaryArmed(false);
            setEditName(e.target.value);
          }}
          aria-label={t.recipientAria}
          placeholder={t.recipientPlaceholder}
        />
      </label>

      {candidateChips.length > 0 && (
        <div className="pay-sheet__chips" role="group" aria-label={t.payTo}>
          {candidateChips.map((name) => (
            <button
              key={name}
              type="button"
              className="pay-sheet__chip"
              disabled={busy}
              onClick={() => {
                setSecondaryArmed(false);
                setEditName(name);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <label className="pay-sheet__field">
        <span>{t.noteLabel}</span>
        <input
          type="text"
          value={editNote}
          disabled={busy}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => {
            setSecondaryArmed(false);
            setEditNote(e.target.value);
          }}
          aria-label={t.noteLabel}
          placeholder={t.notePlaceholder}
        />
      </label>

      {error && (
        <p className="pay-sheet__error" role="alert">
          {error}
        </p>
      )}

      <div className="pay-sheet__actions">
        <button
          type="button"
          className="pay-sheet__btn pay-sheet__btn--deny"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeny();
          }}
          disabled={busy}
        >
          {t.decline}
        </button>
        <button
          type="button"
          className="pay-sheet__btn pay-sheet__btn--accept"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            submitConfirm();
          }}
          disabled={busy || blockAccept || !editsValid}
        >
          {busy
            ? t.sending
            : secondaryArmed
              ? t.confirmAgain
              : isUnverifiedBrand
                ? t.continueUnverified
                : t.accept}
        </button>
      </div>
    </div>
  );
}
