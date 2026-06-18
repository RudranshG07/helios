import { useEffect, useState } from "react";
import { api, getUserId, type AgentState } from "./api.ts";
import { Landing } from "./components/Landing.tsx";
import { Onboarding } from "./components/Onboarding.tsx";
import { Dashboard } from "./components/Dashboard.tsx";

type Phase = "loading" | "landing" | "onboard" | "dashboard";

export function App() {
  const [phase, setPhase] = useState<Phase>("loading");
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

  if (phase === "loading") return <div className="center muted">connecting…</div>;
  if (phase === "landing")
    return (
      <Landing
        onStart={(services) => {
          if (services && services.length) setPreset(services);
          setPhase("onboard");
        }}
      />
    );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◎</span> Helios
        </div>
        <div className="tagline">autonomous · self-custody · verifiable</div>
      </header>
      {phase === "onboard" && <Onboarding preset={preset} onLaunched={() => setPhase("dashboard")} />}
      {phase === "dashboard" && <Dashboard initial={state} onStopped={() => setPhase("landing")} />}
    </div>
  );
}
