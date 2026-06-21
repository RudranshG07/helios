import { useState } from "react";
import { api } from "../api.ts";

export function AgentChat() {
  const [msgs, setMsgs] = useState<{ role: "you" | "agent"; text: string }[]>([
    { role: "agent", text: "Ask me anything — my current read, why I'm in stable or a position, or how my risk limits work." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "you", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await api.chat(q);
      setMsgs((m) => [...m, { role: "agent", text: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "agent", text: "(couldn't reach the agent)" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Talk to the agent</h3>
      <div className="chat-log">
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
        ))}
        {busy && <div className="chat-msg agent muted">thinking…</div>}
      </div>
      <div className="chat-input">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Why are you in stable right now?" />
        <button className="primary" onClick={send} disabled={busy}>Ask</button>
      </div>
    </div>
  );
}
