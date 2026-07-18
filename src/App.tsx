import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneFrame } from "./components/PhoneFrame";
import { SystemsTheater } from "./components/SystemsTheater";
import { DemoDirector } from "./components/DemoDirector";
import { GuideFriend } from "./components/GuideFriend";
import { IntroSplash } from "./components/IntroSplash";
import { BootLoading } from "./components/BootLoading";
import { MainMenu, type MenuDestination } from "./components/MainMenu";
import { InstallPrompt } from "./components/InstallPrompt";
import { Onboarding } from "./screens/Onboarding";
import { Wallet, type WalletGuideCommand } from "./screens/Wallet";
import { Recovery } from "./screens/Recovery";
import { ZkDemoTriptych } from "./screens/ZkDemoTriptych";
import { MerchantReceive } from "./screens/MerchantReceive";
import { CreditScreen } from "./screens/Credit";
import { api, clearSession, loadSession, type PublicUser } from "./lib/api";
import { clearAllVaults, loadVault } from "./lib/deviceVault";
import type { GuideAction, GuideStep } from "./lib/guideScript";
import {
  makeSystemsEvent,
  narrativeForView,
  narrativeForWalletPhase,
  type SystemsEvent,
} from "./lib/systemsBus";
import "./styles/app.css";

type View =
  | "intro"
  | "menu"
  | "loading"
  | "boot"
  | "director"
  | "onboarding"
  | "zk-demo"
  | "wallet"
  | "recovery"
  | "merchant"
  | "credit";

export default function App() {
  const [view, setView] = useState<View>("intro");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [loadDetail, setLoadDetail] = useState("Warming Midnight demo…");
  const [settledOnce, setSettledOnce] = useState(false);
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
  const [menuIntent, setMenuIntent] = useState<MenuDestination | null>(null);
  const [systemsHistory, setSystemsHistory] = useState<SystemsEvent[]>([]);
  const [systemsCurrent, setSystemsCurrent] = useState<SystemsEvent | null>(null);
  const [systemsOpen, setSystemsOpen] = useState(true);

  const pushSystems = useCallback((partial: Omit<SystemsEvent, "id" | "at">) => {
    const ev = makeSystemsEvent(partial);
    setSystemsCurrent(ev);
    setSystemsHistory((prev) => [ev, ...prev].slice(0, 24));
  }, []);

  useEffect(() => {
    if (view === "intro" || view === "menu" || view === "loading") return;
    setSystemsOpen(true);
    pushSystems(narrativeForView(view));
  }, [view, pushSystems]);

  const systemsViewLabel = useMemo(() => {
    const labels: Record<string, string> = {
      wallet: "Voice wallet",
      credit: "Circled Credit",
      merchant: "Merchant receive",
      onboarding: "ZK-KYC onboarding",
      recovery: "Social recovery",
      director: "Demo director",
      "zk-demo": "Circuit triptych",
      loading: "Boot",
      boot: "Boot",
    };
    return labels[view] ?? view;
  }, [view]);

  /** After menu “Voice pay” — health check + restore session or open hub */
  useEffect(() => {
    if (view !== "loading") return;
    let alive = true;
    (async () => {
      try {
        setLoadDetail("Checking Midnight systems…");
        await api.health();
        if (!alive) return;
        setBackendOk(true);

        if (menuIntent === "pay") {
          setLoadDetail("Opening Class 0 vault…");
          const sid = loadSession();
          if (sid) {
            try {
              const vault = await loadVault(sid);
              if (!vault) {
                clearSession();
              } else {
                const { user: u } = await api.getUser(sid);
                if (!alive) return;
                setUser(u);
                setGuided(false);
                setLoadDetail("Restoring your demo…");
                await new Promise((r) => setTimeout(r, 420));
                if (!alive) return;
                setMenuIntent(null);
                setView("wallet");
                return;
              }
            } catch {
              clearSession();
            }
          }
          setLoadDetail("Opening demo hub…");
          await new Promise((r) => setTimeout(r, 400));
          if (!alive) return;
          setDirectorAuto(null);
          setMenuIntent(null);
          setView("director");
          return;
        }

        setLoadDetail("Launching…");
        await new Promise((r) => setTimeout(r, 360));
        if (!alive) return;
        setMenuIntent(null);
        setView("director");
      } catch {
        if (alive) {
          setBackendOk(false);
          setLoadDetail("Backend offline — opening demo shell…");
          await new Promise((r) => setTimeout(r, 500));
          if (alive) {
            setMenuIntent(null);
            setView("director");
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [view, menuIntent]);

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

  function handleMenuSelect(dest: MenuDestination) {
    setMenuIntent(dest);
    if (dest === "pay") {
      setView("loading");
      return;
    }
    if (dest === "tour") {
      setDirectorAuto("tour");
      setView("director");
      return;
    }
    if (dest === "zk") {
      setDirectorAuto("explore");
      setView("director");
      return;
    }
    if (dest === "merchant") {
      setDirectorAuto(null);
      setView("merchant");
      return;
    }
    if (dest === "credit") {
      setDirectorAuto(null);
      if (user || loadSession()) {
        void (async () => {
          const sid = loadSession();
          if (sid && !user) {
            try {
              const { user: u } = await api.getUser(sid);
              setUser(u);
              setView("credit");
              return;
            } catch {
              /* fall through */
            }
          }
          if (user) {
            setView("credit");
            return;
          }
          setView("onboarding");
        })();
        return;
      }
      setView("onboarding");
      return;
    }
    if (dest === "onboarding") {
      setDirectorAuto(null);
      setView("onboarding");
      return;
    }
    if (dest === "recovery") {
      setDirectorAuto(null);
      if (user || loadSession()) {
        void (async () => {
          const sid = loadSession();
          if (sid && !user) {
            try {
              const { user: u } = await api.getUser(sid);
              setUser(u);
              setView("recovery");
              return;
            } catch {
              /* fall through */
            }
          }
          if (user) {
            setView("recovery");
            return;
          }
          setView("onboarding");
        })();
        return;
      }
      setView("onboarding");
      return;
    }
    setDirectorAuto(null);
    setView("director");
  }

  const stageClass =
    guided && view === "wallet"
      ? "app__main app__main--stage app__main--with-systems"
      : "app__main app__main--with-systems";

  const showSystemsDock =
    view !== "intro" && view !== "menu" && view !== "loading";

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

  if (view === "intro") {
    return <IntroSplash onFinished={() => setView("menu")} />;
  }

  if (view === "menu") {
    return <MainMenu onSelect={handleMenuSelect} />;
  }

  if (view === "loading") {
    return <BootLoading detail={loadDetail} />;
  }

  return (
    <div className={`app app--atelier ${systemsOpen && showSystemsDock ? "app--systems-open" : ""}`}>
      <InstallPrompt />
      {systemsPanel}
      <header className="app__brand">
        <img src="/glyph.png" alt="" className="app__brand-glyph" />
        <div className="app__brand-copy">
          <p className="atelier-kicker">
            {guided ? "Judge stage · guided" : "Midnight · Preprod"}
          </p>
          <strong className="brand-mark">Circled</strong>
          <span>
            {guided ? "Private money, spoken softly" : "Confidential voice payments"}
          </span>
        </div>
        {backendOk === false && <em className="pill warn">backend offline</em>}
        {backendOk && <em className="pill ok">systems live</em>}
        {settledOnce && <em className="pill ok">settlement proven</em>}
        {guided && view === "wallet" && (
          <button
            type="button"
            className="pill"
            style={{ cursor: "pointer" }}
            onClick={() => setGuided(false)}
          >
            Hide guide
          </button>
        )}
        {!guided && view === "wallet" && user && (
          <button
            type="button"
            className="pill"
            style={{ cursor: "pointer" }}
            onClick={() => setGuided(true)}
          >
            Show guide
          </button>
        )}
        <button
          type="button"
          className="pill"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setDirectorAuto(null);
            setMenuIntent(null);
            setView("menu");
          }}
        >
          Menu
        </button>
        <button
          type="button"
          className="pill"
          style={{ cursor: "pointer" }}
          onClick={() => {
            clearSession();
            clearAllVaults();
            setUser(null);
            setLiveProofs([]);
            setSystemsHistory([]);
            setSystemsCurrent(null);
            setSettledOnce(false);
            setGuided(false);
            setGuideCommand(null);
            setTheaterFocus(null);
            setDirectorAuto(null);
            setView("menu");
          }}
        >
          Reset demo
        </button>
      </header>

      {view === "merchant" && (
        <main className={stageClass}>
          <MerchantReceive
            onBack={() => setView("menu")}
            onSystemsEvent={(e) => {
              setSystemsCurrent(e);
              setSystemsHistory((prev) => [e, ...prev].slice(0, 24));
            }}
          />
        </main>
      )}

      {view === "credit" && user && (
        <main className={stageClass}>
          <CreditScreen
            user={user}
            onBack={() => setView("menu")}
            onSystemsEvent={(e) => {
              setSystemsCurrent(e);
              setSystemsHistory((prev) => [e, ...prev].slice(0, 24));
            }}
            onLiveProofs={setLiveProofs}
          />
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
        </main>
      )}

      {(view === "boot" ||
        view === "onboarding" ||
        view === "wallet" ||
        view === "recovery") && (
        <main className={stageClass}>
          {guided && view === "wallet" && (
            <GuideFriend
              walletPhase={walletPhase}
              onAction={(action, step) => {
                if (step.theaterFocus) setTheaterFocus(step.theaterFocus);
                pushGuideAction(action);
              }}
              onTheaterFocus={setTheaterFocus}
              onComplete={() => {
                /* tour finished — keep stage open for Q&A */
              }}
            />
          )}

          <PhoneFrame>
            {view === "boot" && (
              <div className="screen center">
                <img src="/glyph.png" alt="Circled" className="boot-glyph" />
              </div>
            )}
            {view === "onboarding" && (
              <Onboarding
                onComplete={(u) => {
                  setUser(u);
                  setView("wallet");
                }}
                onShowZkDemo={(u) => {
                  setUser(u);
                  setView("zk-demo");
                }}
                onSystemsEvent={(e) => {
                  setSystemsCurrent(e);
                  setSystemsHistory((prev) => [e, ...prev].slice(0, 24));
                }}
              />
            )}
            {view === "wallet" && user && (
              <Wallet
                user={user}
                onUserChange={setUser}
                onOpenRecovery={() => setView("recovery")}
                onLiveProofs={(proofs) => {
                  setLiveProofs(proofs);
                  if (proofs.length) {
                    pushSystems({
                      source: "wallet",
                      phase: walletPhase,
                      title: proofs.map((p) => p.label).join(" · "),
                      detail: `Live circuits: ${proofs.map((p) => p.circuit).join(", ")}`,
                      layer:
                        proofs.some((p) => p.circuit.includes("session"))
                          ? "proof-server"
                          : proofs.some((p) => p.circuit.includes("collateral") || p.circuit.includes("loan"))
                            ? "pool"
                            : "compact",
                      status: "proving",
                      intensity: 0.9,
                      circuits: proofs.map((p) => p.circuit),
                    });
                  }
                }}
                guideCommand={guided ? guideCommand : null}
                guideCommandKey={guideCommandKey}
                onPhaseChange={(phase) => {
                  setWalletPhase(phase);
                  pushSystems(narrativeForWalletPhase(phase));
                }}
                onSettled={() => {
                  setSettledOnce(true);
                  setTheaterKey((k) => k + 1);
                  pushSystems({
                    source: "settle",
                    phase: "settled",
                    title: "Settlement anchored on Midnight",
                    detail: "SNARKs verified · nullifiers burned · Compact transfer count advanced.",
                    layer: "midnight",
                    status: "settled",
                    intensity: 0.55,
                    circuits: liveProofs.map((p) => p.circuit),
                  });
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
        </main>
      )}
    </div>
  );
}
