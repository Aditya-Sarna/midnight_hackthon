import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { SystemsTheater } from "./components/SystemsTheater";
import { DemoDirector } from "./components/DemoDirector";
import { GuideFriend } from "./components/GuideFriend";
import { IntroSplash } from "./components/IntroSplash";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { BootLoading } from "./components/BootLoading";
import { MainMenu, type MenuDestination } from "./components/MainMenu";
import { InstallPrompt } from "./components/InstallPrompt";
import { ProductGate } from "./components/ProductGate";
import { JudgeTruthPanel } from "./components/JudgeTruthPanel";
import { Onboarding } from "./screens/Onboarding";
import { Wallet, type WalletGuideCommand } from "./screens/Wallet";
import { Recovery } from "./screens/Recovery";
import { SettingsScreen } from "./screens/Settings";
import { ZkDemoTriptych } from "./screens/ZkDemoTriptych";
import { MerchantReceive } from "./screens/MerchantReceive";
import { CreditScreen } from "./screens/Credit";
import { StrategyScreen } from "./screens/Strategy";
import { MoneyRailsScreen } from "./screens/MoneyRails";
import { LegalScreen } from "./screens/Legal";
import { UniversalAdapterDemo } from "./screens/UniversalAdapterDemo";
import { JudgeCommandCenter } from "./screens/JudgeCommandCenter";
import { api, clearSession, loadSession, type PublicUser } from "./lib/api";
import { clearAllVaults, loadVault, type DeviceVaultState } from "./lib/deviceVault";
import { disableDemoMode, enableDemoMode, isDemoMode } from "./lib/productMode";
import { publicUserFromVault } from "./lib/offlineUser";
import { initNativeShell } from "./lib/nativeShell";
import type { GuideAction, GuideStep } from "./lib/guideScript";
import {
  makeSystemsEvent,
  narrativeForView,
  narrativeForWalletPhase,
  type SystemsEvent,
} from "./lib/systemsBus";
import "./styles/app.css";

type View =
  | "gate"
  | "intro"
  | "welcome"
  | "menu"
  | "loading"
  | "boot"
  | "director"
  | "onboarding"
  | "zk-demo"
  | "wallet"
  | "settings"
  | "recovery"
  | "merchant"
  | "credit"
  | "strategy"
  | "truth"
  | "universal"
  | "judge"
  | "rails"
  | "privacy"
  | "terms";

export default function App() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [vaultSnapshot, setVaultSnapshot] = useState<DeviceVaultState | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [loadDetail, setLoadDetail] = useState("Opening Circle…");
  const [lastSettleGrade, setLastSettleGrade] = useState("");
  const [proofMode, setProofMode] = useState("—");
  const [proofServerOk, setProofServerOk] = useState<boolean | null>(null);
  const [liveProofs, setLiveProofs] = useState<
    { circuit: string; proof: string; label: string; ms?: number; snarkDigest?: string }[]
  >([]);
  const [theaterKey, setTheaterKey] = useState(0);
  const [guided, setGuided] = useState(false);
  const [guideCommand, setGuideCommand] = useState<WalletGuideCommand | null>(null);
  const [guideCommandKey, setGuideCommandKey] = useState(0);
  const [walletPhase, setWalletPhase] = useState("home");
  const [theaterFocus, setTheaterFocus] = useState<GuideStep["theaterFocus"] | null>(null);
  const [directorAuto, setDirectorAuto] = useState<"tour" | "explore" | null>(null);
  const [systemsHistory, setSystemsHistory] = useState<SystemsEvent[]>([]);
  const [systemsCurrent, setSystemsCurrent] = useState<SystemsEvent | null>(null);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(() => isDemoMode());
  const [booted, setBooted] = useState(false);

  const pushSystems = useCallback((partial: Omit<SystemsEvent, "id" | "at">) => {
    const ev = makeSystemsEvent(partial);
    setSystemsCurrent(ev);
    setSystemsHistory((prev) => [ev, ...prev].slice(0, 24));
  }, []);

  useEffect(() => initNativeShell(), []);

  /** Cold start: restore session → wallet; first open → intro → welcome → menu. */
  useEffect(() => {
    if (booted) return;
    let alive = true;
    (async () => {
      setLoadDetail("Checking systems…");
      try {
        await api.health();
        if (!alive) return;
        setBackendOk(true);
      } catch {
        if (!alive) return;
        setBackendOk(false);
      }

      const sid = loadSession();
      if (sid) {
        setLoadDetail("Restoring your wallet…");
        try {
          const vault = await loadVault(sid);
          if (vault) {
            disableDemoMode();
            setDemoMode(false);
            setGuided(false);
            setSystemsOpen(false);
            try {
              const { user: u } = await api.getUser(sid);
              if (!alive) return;
              setUser(u);
            } catch {
              if (!alive) return;
              // Local vault is enough for offline widget use
              setUser(publicUserFromVault(vault));
              setBackendOk(false);
            }
            setVaultSnapshot(vault);
            setBooted(true);
            setView("wallet");
            return;
          }
          clearSession();
        } catch {
          // Keep session pointer if vault decrypt failed transiently — still show cinema
          clearSession();
        }
      }

      if (!alive) return;
      setBooted(true);
      setDemoMode(false);
      setView("intro");
    })();
    return () => {
      alive = false;
    };
  }, [booted]);

  useEffect(() => {
    if (
      view === "intro" ||
      view === "menu" ||
      view === "loading" ||
      view === "gate" ||
      view === "welcome"
    ) {
      return;
    }
    if (demoMode) setSystemsOpen(true);
    // Avoid flooding the stream with identical idle narratives on every paint
    const next = narrativeForView(view);
    setSystemsCurrent((prev) => {
      if (
        prev &&
        prev.title === next.title &&
        prev.phase === next.phase &&
        prev.status === next.status
      ) {
        return prev;
      }
      const ev = makeSystemsEvent(next);
      setSystemsHistory((h) => {
        if (h[0]?.title === ev.title && h[0]?.phase === ev.phase) return h;
        return [ev, ...h].slice(0, 24);
      });
      return ev;
    });
  }, [view, demoMode]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const h = await api.health();
        if (!alive) return;
        setBackendOk(true);
        const ok = Boolean(h.proofMode?.proofServerOk);
        const mode = String(h.proofMode?.mode ?? "—");
        setProofServerOk(ok);
        setProofMode(mode);
      } catch {
        if (alive) {
          setBackendOk(false);
          setProofServerOk(false);
          setProofMode("offline");
        }
      }
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const systemsViewLabel = useMemo(() => {
    const labels: Record<string, string> = {
      wallet: "Voice wallet",
      settings: "Settings",
      credit: "Circle Credit",
      strategy: "Private strategy",
      merchant: "Merchant receive",
      onboarding: "Onboarding",
      recovery: "Recovery",
      director: "Guided tour",
      "zk-demo": "Circuit walkthrough",
      universal: "Universal adapter",
      judge: "Command center",
      truth: "Real vs demo",
      loading: "Boot",
      boot: "Boot",
      gate: "Welcome",
    };
    return labels[view] ?? view;
  }, [view]);

  const pushGuideAction = useCallback((action: GuideAction) => {
    if (action.type === "highlightTheater") {
      setTheaterFocus(action.focus as GuideStep["theaterFocus"]);
      return;
    }
    if (action.type === "idle") {
      setGuideCommand({ type: "idle" });
      setGuideCommandKey((k) => k + 1);
      return;
    }
    if (action.type === "openApp") {
      setGuideCommand({ type: "openApp" });
      setGuideCommandKey((k) => k + 1);
      return;
    }
    if (action.type === "runPayment") {
      setGuideCommand({ type: "runPayment", utterance: action.utterance });
      setGuideCommandKey((k) => k + 1);
      return;
    }
    if (action.type === "confirm") {
      setGuideCommand({ type: "confirm" });
      setGuideCommandKey((k) => k + 1);
    }
  }, []);

  function handleSignOut() {
    clearSession();
    clearAllVaults();
    disableDemoMode();
    setUser(null);
    setVaultSnapshot(null);
    setLiveProofs([]);
    setSystemsHistory([]);
    setSystemsCurrent(null);
    setGuided(false);
    setGuideCommand(null);
    setTheaterFocus(null);
    setDirectorAuto(null);
    setSystemsOpen(false);
    setDemoMode(false);
    setView("menu");
  }

  function enterShowcase() {
    enableDemoMode();
    setDemoMode(true);
  }

  function handleMenuSelect(dest: MenuDestination) {
    if (dest === "truth") {
      setDirectorAuto(null);
      setView("truth");
      return;
    }

    if (dest === "universal") {
      enterShowcase();
      setDirectorAuto(null);
      setView("universal");
      return;
    }

    if (dest === "judge") {
      enterShowcase();
      setDirectorAuto(null);
      setView("judge");
      return;
    }

    if (dest === "tour") {
      enterShowcase();
      setDirectorAuto("tour");
      setView("director");
      return;
    }

    // circle — product path (no demo theater)
    disableDemoMode();
    setDemoMode(false);
    setSystemsOpen(false);
    setGuided(false);
    setDirectorAuto(null);
    setGuideCommand(null);
    void (async () => {
      const sid = loadSession();
      if (sid) {
        try {
          const vault = await loadVault(sid);
          if (vault) {
            try {
              const { user: u } = await api.getUser(sid);
              setUser(u);
            } catch {
              setUser(publicUserFromVault(vault));
              setBackendOk(false);
            }
            setVaultSnapshot(vault);
            setView("wallet");
            return;
          }
          clearSession();
        } catch {
          /* fall through to gate */
        }
      }
      setView("gate");
    })();
  }

  const stageClass =
    guided && view === "wallet"
      ? "app__main app__main--stage app__main--with-systems"
      : "app__main app__main--with-systems";

  // Systems dock only on guided tour — keep Universal / Command center chrome clean.
  const showSystemsDock = demoMode && guided && view === "wallet";

  const systemsPanel = showSystemsDock ? (
    <SystemsTheater
      docked
      open={systemsOpen}
      onOpenChange={setSystemsOpen}
      event={systemsCurrent}
      history={systemsHistory}
      liveProofs={liveProofs}
      viewLabel={
        theaterFocus ? `${systemsViewLabel} · focus ${theaterFocus}` : systemsViewLabel
      }
      refreshKey={theaterKey}
    />
  ) : null;

  /** Twin phone sits in the main row (horizontal) when open; tab stays when closed */
  const systemsInline = systemsOpen ? systemsPanel : null;
  const systemsTab = !systemsOpen ? systemsPanel : null;

  if (view === "loading" && !booted) {
    return <BootLoading detail={loadDetail} />;
  }

  if (view === "gate") {
    return (
      <ProductGate
        backendOk={backendOk}
        onBackendOk={setBackendOk}
        onCreateAccount={() => {
          disableDemoMode();
          setDemoMode(false);
          setSystemsOpen(false);
          setView("onboarding");
        }}
        onBackToMenu={() => setView("menu")}
        onRestored={(u) => {
          disableDemoMode();
          setDemoMode(false);
          setSystemsOpen(false);
          setGuided(false);
          setUser(u);
          void loadVault(u.id).then(setVaultSnapshot);
          setView("wallet");
        }}
      />
    );
  }

  if (view === "intro") {
    return <IntroSplash onFinished={() => setView("welcome")} />;
  }

  if (view === "welcome") {
    return <WelcomeScreen onContinue={() => setView("menu")} />;
  }

  if (view === "menu") {
    return <MainMenu onSelect={handleMenuSelect} />;
  }

  if (view === "truth") {
    return (
      <JudgeTruthPanel
        proofMode={proofMode}
        proofServerOk={proofServerOk}
        lastSettleGrade={lastSettleGrade}
        onBack={() => setView("menu")}
        onOpenTour={() => {
          enterShowcase();
          setDirectorAuto("tour");
          setView("director");
        }}
      />
    );
  }

  if (view === "loading") {
    return <BootLoading detail={loadDetail} />;
  }

  return (
    <div className={`app app--atelier ${systemsOpen && showSystemsDock ? "app--systems-open" : ""}`}>
      <InstallPrompt />
      {systemsTab}
      <header className="app__brand">
        <img src="/glyph.png" alt="" className="app__brand-glyph" />
        <div className="app__brand-copy">
          <strong className="brand-mark">Circle</strong>
          <span>Confidential voice payments</span>
        </div>
        <button
          type="button"
          className="pill"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setDirectorAuto(null);
            setGuided(false);
            setSystemsOpen(false);
            setView("menu");
          }}
        >
          Menu
        </button>
        {user && (
          <button type="button" className="pill" style={{ cursor: "pointer" }} onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </header>

      {view === "merchant" && (
        <main className={stageClass}>
          <MerchantReceive
            onBack={() => setView(user ? "settings" : "menu")}
            onSystemsEvent={(e) => {
              setSystemsCurrent(e);
              setSystemsHistory((prev) => [e, ...prev].slice(0, 24));
            }}
          />
          {systemsInline}
        </main>
      )}

      {view === "credit" && user && (
        <main className={stageClass}>
          <CreditScreen
            user={user}
            onBack={() => setView("settings")}
            onSystemsEvent={(e) => {
              setSystemsCurrent(e);
              setSystemsHistory((prev) => [e, ...prev].slice(0, 24));
            }}
            onLiveProofs={setLiveProofs}
          />
          {systemsInline}
        </main>
      )}

      {view === "strategy" && user && (
        <main className={stageClass}>
          <StrategyScreen
            userId={user.id}
            onBack={() => setView("settings")}
            onSystemsEvent={(e) => {
              const ev = makeSystemsEvent(e);
              setSystemsCurrent(ev);
              setSystemsHistory((prev) => [ev, ...prev].slice(0, 24));
            }}
            onLiveProofs={setLiveProofs}
          />
          {systemsInline}
        </main>
      )}

      {view === "director" && (
        <main className={stageClass}>
          <DemoDirector
            autoLaunch={directorAuto}
            onReady={(u, mode) => {
              setUser(u);
              setDirectorAuto(null);
              pushSystems({
                source: "director",
                phase: "ready",
                title: "Demo wallet provisioned",
                detail: "KYC leaf published · Class 0 vault funded · circuits warm.",
                layer: "kyc",
                status: "settled",
                intensity: 0.6,
                circuits: ["publish_kyc_leaf", "prove_kyc_membership"],
              });
              if (mode === "tour") {
                setGuided(true);
                setView("wallet");
              } else {
                setGuided(false);
                setView("zk-demo");
              }
            }}
            onManual={() => {
              setDirectorAuto(null);
              setView("onboarding");
            }}
          />
          {systemsInline}
        </main>
      )}

      {view === "zk-demo" && user && (
        <main className={stageClass}>
          <ZkDemoTriptych
            onDone={() => {
              setTheaterKey((k) => k + 1);
              pushSystems({
                source: "zk-demo",
                phase: "done",
                title: "Circuit walkthrough complete",
                detail: "Membership · spend · session auth — opening voice wallet.",
                layer: "compact",
                status: "settled",
                intensity: 0.5,
              });
              setView("wallet");
            }}
          />
          {systemsInline}
        </main>
      )}

      {view === "universal" && (
        <main className={stageClass}>
          <UniversalAdapterDemo onBack={() => setView("menu")} />
          {systemsInline}
        </main>
      )}

      {(view === "boot" ||
        view === "onboarding" ||
        view === "wallet" ||
        view === "settings" ||
        view === "rails" ||
        view === "privacy" ||
        view === "terms" ||
        view === "judge" ||
        view === "recovery") && (
        <main className={stageClass}>
          {demoMode && guided && view === "wallet" && (
            <GuideFriend
              walletPhase={walletPhase}
              onAction={(action, step) => {
                if (step.theaterFocus) setTheaterFocus(step.theaterFocus);
                pushGuideAction(action);
              }}
              onTheaterFocus={setTheaterFocus}
              onComplete={() => {
                /* tour finished */
              }}
            />
          )}

          <PhoneFrame>
            {view === "boot" && (
              <div className="screen center">
                <img src="/glyph.png" alt="Circle" className="boot-glyph" />
              </div>
            )}
            {view === "onboarding" && (
              <Onboarding
                onComplete={(u) => {
                  setUser(u);
                  setGuided(false);
                  setSystemsOpen(false);
                  void loadVault(u.id).then(setVaultSnapshot);
                  setView("wallet");
                }}
                onShowZkDemo={
                  demoMode
                    ? (u) => {
                        setUser(u);
                        setView("zk-demo");
                      }
                    : undefined
                }
                onSystemsEvent={(e) => {
                  if (!demoMode) return;
                  setSystemsCurrent(e);
                  setSystemsHistory((prev) => [e, ...prev].slice(0, 24));
                }}
              />
            )}
            {view === "settings" && user && (
              <SettingsScreen
                user={user}
                vault={vaultSnapshot}
                onBack={() => setView("wallet")}
                onRecovery={() => setView("recovery")}
                onStrategy={() => setView("strategy")}
                onCredit={() => setView("credit")}
                onMerchant={() => setView("merchant")}
                onMoneyRails={() => setView("rails")}
                onPrivacy={() => setView("privacy")}
                onTerms={() => setView("terms")}
                onOpenShowcase={() => {
                  enterShowcase();
                  setView("menu");
                }}
                onSignOut={handleSignOut}
              />
            )}
            {view === "rails" && (
              <MoneyRailsScreen
                vault={vaultSnapshot}
                onVaultChange={setVaultSnapshot}
                onBack={() => setView("settings")}
              />
            )}
            {(view === "privacy" || view === "terms") && (
              <LegalScreen
                kind={view === "privacy" ? "privacy" : "terms"}
                onBack={() => setView("settings")}
              />
            )}
            {view === "judge" && (
              <JudgeCommandCenter onBack={() => setView("menu")} />
            )}
            {view === "wallet" && user && (
              <Wallet
                user={user}
                onUserChange={setUser}
                backendOk={backendOk}
                onOpenRecovery={() => setView("recovery")}
                onOpenSettings={() => {
                  void loadVault(user.id).then(setVaultSnapshot);
                  setView("settings");
                }}
                onLiveProofs={(proofs) => {
                  setLiveProofs(proofs);
                  if (demoMode && proofs.length) {
                    pushSystems({
                      source: "wallet",
                      phase: walletPhase,
                      title: proofs.map((p) => p.label).join(" · "),
                      detail: `Live circuits: ${proofs.map((p) => p.circuit).join(", ")}`,
                      layer: proofs.some((p) => p.circuit.includes("session"))
                        ? "proof-server"
                        : proofs.some(
                              (p) =>
                                p.circuit.includes("collateral") || p.circuit.includes("loan")
                            )
                          ? "pool"
                          : "compact",
                      status: "proving",
                      intensity: 0.9,
                      circuits: proofs.map((p) => p.circuit),
                    });
                  }
                }}
                guideCommand={demoMode && guided ? guideCommand : null}
                guideCommandKey={guideCommandKey}
                onPhaseChange={(phase, meta) => {
                  setWalletPhase(phase);
                  if (demoMode) pushSystems(narrativeForWalletPhase(phase, meta));
                }}
                onSettled={(grade, meta) => {
                  if (grade) setLastSettleGrade(grade);
                  setTheaterKey((k) => k + 1);
                  void loadVault(user.id).then(setVaultSnapshot);
                  if (demoMode) {
                    if (meta?.kind === "credit") {
                      pushSystems({
                        source: "credit",
                        phase: "loan-booked",
                        title: meta.label || "Loan booked",
                        detail:
                          "Collateral locked · pool disbursement · credit_identity — not a P2P payment settle.",
                        layer: "pool",
                        status: "settled",
                        intensity: 0.55,
                        circuits: liveProofs.map((p) => p.circuit),
                      });
                    } else {
                      pushSystems({
                        source: "settle",
                        phase: "settled",
                        title: grade
                          ? `Settlement · grade: ${grade}`
                          : "Settlement anchored on Midnight",
                        detail:
                          "SNARKs verified · nullifiers burned · Compact transfer count advanced.",
                        layer: "midnight",
                        status: "settled",
                        intensity: 0.55,
                        circuits: liveProofs.map((p) => p.circuit),
                      });
                    }
                  }
                }}
              />
            )}
            {view === "recovery" && user && (
              <Recovery
                user={user}
                onRecovered={setUser}
                onBack={() => setView("wallet")}
              />
            )}
          </PhoneFrame>
          {systemsInline}
        </main>
      )}
    </div>
  );
}
