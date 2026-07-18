import { useMemo, useState } from "react";
import type { ContactRecord, DeviceVaultState } from "../lib/deviceVault";
import { ensurePayableContact } from "../lib/bootstrap";
import { parseContactUri } from "../lib/qr";

type Props = {
  vault: DeviceVaultState;
  onVaultChange: (v: DeviceVaultState) => void;
  onClose: () => void;
  onPay: (label: string) => void;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_HUES = ["#A8B59A", "#C4A27A", "#E8A06A", "#8FA8A3", "#C9A227", "#7A8B6E", "#B08968"];

export function ContactList({ vault, onVaultChange, onClose, onPay }: Props) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [scanUri, setScanUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const contacts = useMemo(() => {
    const list = [...(vault.contacts ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        (c.note ?? "").toLowerCase().includes(needle)
    );
  }, [vault.contacts, q]);

  async function addContact() {
    const scanned = parseContactUri(scanUri);
    const name = (scanned?.label || newName).trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      let next = await ensurePayableContact(vault, name);
      const row = next.contacts.find((c) => c.label.toLowerCase() === name.toLowerCase());
      if (row) {
        row.addedAt = Date.now();
        row.note = scanned
          ? `Enrolled via QR · ${scanned.pubkey.slice(0, 12)}…`
          : row.note || "Added on device";
        if (scanned?.pubkey) {
          (row as ContactRecord & { address?: string }).address = scanned.pubkey;
        }
      }
      const { saveVault } = await import("../lib/deviceVault");
      await saveVault(next);
      onVaultChange(next);
      setNewName("");
      setScanUri("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add contact");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contacts" role="dialog" aria-label="Contacts">
      <header className="contacts__head">
        <button type="button" className="contacts__back" onClick={onClose}>
          ‹
        </button>
        <div>
          <h1>Contacts</h1>
          <p>Class 0 · on this device only</p>
        </div>
        <button
          type="button"
          className="contacts__add-btn"
          onClick={() => setAdding((v) => !v)}
          aria-label="Add contact"
        >
          +
        </button>
      </header>

      <div className="contacts__search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts"
          autoComplete="off"
        />
      </div>

      {adding && (
        <form
          className="contacts__add"
          onSubmit={(e) => {
            e.preventDefault();
            void addContact();
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name to enroll"
            autoFocus
            autoComplete="off"
          />
          <input
            value={scanUri}
            onChange={(e) => setScanUri(e.target.value)}
            placeholder="Paste circled://contact QR / NFC"
            autoComplete="off"
            aria-label="Contact QR or NFC payload"
          />
          <button
            type="submit"
            className="btn primary"
            disabled={busy || (!newName.trim() && !parseContactUri(scanUri))}
          >
            {busy ? "Enrolling…" : scanUri ? "Add from scan" : "Add"}
          </button>
        </form>
      )}
      {error && <p className="contacts__error">{error}</p>}

      <p className="contacts__count">
        {contacts.length} contact{contacts.length === 1 ? "" : "s"} · enrollment-signed
      </p>

      <ul className="contacts__list">
        {contacts.length === 0 && (
          <li className="contacts__empty">No contacts yet. Add someone to pay privately.</li>
        )}
        {contacts.map((c, i) => (
          <ContactRow
            key={`${c.label}-${c.address.slice(0, 8)}`}
            contact={c}
            hue={AVATAR_HUES[i % AVATAR_HUES.length]}
            onPay={() => onPay(c.label)}
          />
        ))}
      </ul>
    </div>
  );
}

function ContactRow({
  contact,
  hue,
  onPay,
}: {
  contact: ContactRecord;
  hue: string;
  onPay: () => void;
}) {
  return (
    <li className="contacts__row">
      <span className="contacts__avatar" style={{ background: hue }}>
        {initials(contact.label)}
      </span>
      <div className="contacts__meta">
        <strong>{contact.label}</strong>
        <em>
          {contact.note || "Enrolled contact"}
          {contact.enrollmentSig ? " · signed" : ""}
        </em>
        <code>{contact.address.slice(0, 10)}…{contact.address.slice(-6)}</code>
      </div>
      <button type="button" className="contacts__pay" onClick={onPay}>
        Pay
      </button>
    </li>
  );
}
