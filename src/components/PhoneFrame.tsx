import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-shell">
      <div className="phone">
        <div className="phone__notch" aria-hidden />
        <div className="phone__screen">{children}</div>
        <div className="phone__home" aria-hidden />
      </div>
    </div>
  );
}
