import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Gap = { id: string; title: string; status: string };

/** Compact compliance posture strip for judges / auditors */
export function ComplianceStrip() {
  const [services, setServices] = useState(0);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    let alive = true;
    api.compliance()
      .then((doc) => {
        if (!alive) return;
        setServices(doc.serviceInventory.length);
        setGaps(doc.gapsToDisclose as Gap[]);
        setOpen(doc.gapsToDisclose.filter((g) => g.status === "open").length);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!services) return null;

  return (
    <div className="compliance-strip">
      <div className="compliance-strip__row">
        <strong>Backend compliance</strong>
        <span>{services} scoped services</span>
        <span className={open ? "compliance-strip__warn" : ""}>
          {open} open gap{open === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="compliance-strip__gaps">
        {gaps.map((g) => (
          <li key={g.id} data-status={g.status}>
            <em>{g.status}</em> {g.title}
          </li>
        ))}
      </ul>
      <p className="compliance-strip__note">
        Class 0 on device · server holds commitments only. Gaps disclosed, not papered over.
      </p>
    </div>
  );
}
