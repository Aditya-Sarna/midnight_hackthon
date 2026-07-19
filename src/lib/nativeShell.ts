/**
 * Capacitor shell hooks — App resume → encourage vault re-lock check.
 * Biometrics today = WebAuthn passkeys (webauthnVault), not native Push yet.
 */
import { lockVaultSession } from "./webauthnVault";

export function initNativeShell(): () => void {
  const onVis = () => {
    if (document.visibilityState === "hidden") {
      // Soft lock: next pay requires unlock again after backgrounding
      lockVaultSession();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  // Capacitor App plugin when available
  void import("@capacitor/app")
    .then(({ App }) => {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) lockVaultSession();
      });
    })
    .catch(() => undefined);

  return () => document.removeEventListener("visibilitychange", onVis);
}
