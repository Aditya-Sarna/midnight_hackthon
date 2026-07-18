import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Installable PWA / home-screen prompt — closes the “no mobile install” gap.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!deferred || hidden) return null;

  return (
    <div className="install-prompt" role="region" aria-label="Install Circled">
      <p>
        <strong className="brand-mark">Circled</strong>
        <span>Install for offline shell + home-screen launch</span>
      </p>
      <div className="install-prompt__actions">
        <button type="button" className="btn ghost" onClick={() => setHidden(true)}>
          Not now
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            setHidden(true);
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
