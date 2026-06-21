import { useEffect, useState } from "react";
import { api, getUserId, type AgentState } from "./api.ts";
import { Landing } from "./components/Landing.tsx";
import { Onboarding } from "./components/Onboarding.tsx";
import { Dashboard } from "./components/Dashboard.tsx";
import { Docs } from "./components/Docs.tsx";

type Phase = "loading" | "landing" | "onboard" | "dashboard" | "docs";

export function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [back, setBack] = useState<Phase>("landing");
  const [state, setState] = useState<AgentState | null>(null);
  const [preset, setPreset] = useState<string[]>([]);

  useEffect(() => {
    if (!getUserId()) {
      setPhase("landing");
      return;
    }
    api
      .me()
      .then((s) => {
        setState(s);
        setPhase(s.running ? "dashboard" : "onboard");
      })
      .catch(() => setPhase("landing"));
  }, []);

  const openDocs = (from: Phase) => {
    setBack(from);
    setPhase("docs");
  };

  if (phase === "loading") return <div className="center muted">connecting…</div>;
  if (phase === "docs") return <div className="app"><Docs onBack={() => setPhase(back)} /></div>;
  if (phase === "landing")
    return (
      <Landing
        onStart={(services) => {
          if (services && services.length) setPreset(services);
          setPhase("onboard");
        }}
        onDocs={() => openDocs("landing")}
      />
    );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◎</span> Helios
        </div>
        <div className="tagline">autonomous · self-custody · verifiable</div>
        <div className="spacer" style={{ flex: 1 }} />
        <button className="ghost" style={{ padding: "6px 14px" }} onClick={() => openDocs(phase)}>Docs</button>
      </header>
      {phase === "onboard" && <Onboarding preset={preset} onLaunched={() => setPhase("dashboard")} />}
      {phase === "dashboard" && <Dashboard initial={state} onStopped={() => setPhase("landing")} />}
    </div>
  );
}
