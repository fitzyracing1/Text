import { useState, useRef, useEffect } from "react";

const AUTONOMY_LABELS = ["", "REACTIVE", "PROACTIVE", "AUTONOMOUS"];
const AUTONOMY_COLORS = ["", "#4ade80", "#facc15", "#f97316"];
const AUTONOMY_DESC = [
  "",
  "Responding to what you said",
  "Responding + surfacing one thing unprompted",
  "Responding + taking two steps ahead on your behalf",
];

function buildSystemPrompt(level) {
  const base = `You are a text-message AI assistant. Be concise — this is SMS-style. Keep responses SHORT (2-4 sentences max per section).`;

  if (level === 1) {
    return `${base}

AUTONOMY LEVEL 1 — REACTIVE:
Respond directly and helpfully to what the user said. Nothing more.

Format your response as plain text. No headers.`;
  }

  if (level === 2) {
    return `${base}

AUTONOMY LEVEL 2 — PROACTIVE:
Do two things:
1. Respond directly to what the user said (1-3 sentences)
2. Then on a new line starting with "→ " take ONE autonomous step: surface something useful the user didn't ask for but would benefit from knowing given what they said.

Keep the autonomous step brief (1-2 sentences).`;
  }

  if (level === 3) {
    return `${base}

AUTONOMY LEVEL 3 — AUTONOMOUS:
Do three things:
1. Respond directly to what the user said (1-3 sentences)
2. Then on a new line starting with "→ " take one autonomous step: surface something useful they didn't ask for.
3. Then on a new line starting with "→→ " take a second autonomous step: anticipate what they'll likely need next and address it proactively.

Keep each part brief (1-2 sentences each).`;
  }
}

async function callClaude(messages, level) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: buildSystemPrompt(level),
      messages,
    }),
  });
  const data = await response.json();
  return data.content?.map((b) => b.text || "").join("") || "…";
}

function parseSegments(text, level) {
  if (level === 1) return [{ type: "reactive", text }];
  if (level === 2) {
    const parts = text.split(/\n→ /);
    const segs = [{ type: "reactive", text: parts[0].trim() }];
    if (parts[1]) segs.push({ type: "proactive", text: parts[1].trim() });
    return segs;
  }
  if (level === 3) {
    const p1 = text.split(/\n→→ /);
    const p2 = p1[0].split(/\n→ /);
    const segs = [{ type: "reactive", text: p2[0].trim() }];
    if (p2[1]) segs.push({ type: "proactive", text: p2[1].trim() });
    if (p1[1]) segs.push({ type: "autonomous", text: p1[1].trim() });
    return segs;
  }
  return [{ type: "reactive", text }];
}

const segStyle = {
  reactive: { borderLeft: "2px solid #4ade80", paddingLeft: 8 },
  proactive: { borderLeft: "2px solid #facc15", paddingLeft: 8 },
  autonomous: { borderLeft: "2px solid #f97316", paddingLeft: 8 },
};

const segLabel = {
  reactive: null,
  proactive: "→ unprompted",
  autonomous: "→→ ahead",
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [turn, setTurn] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const apiHistory = useRef([]);

  const currentLevel = (turn % 3) + 1;
  const nextLevel = ((turn + 1) % 3) + 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", text, id: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    apiHistory.current.push({ role: "user", content: text });

    try {
      const reply = await callClaude(apiHistory.current, currentLevel);
      apiHistory.current.push({ role: "assistant", content: reply });

      const segments = parseSegments(reply, currentLevel);
      const aiMsg = { role: "ai", segments, level: currentLevel, id: Date.now() + 1 };
      setMessages((m) => [...m, aiMsg]);
      setTurn((t) => t + 1);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "ai", segments: [{ type: "reactive", text: "Error reaching Claude." }], level: currentLevel, id: Date.now() + 1 },
      ]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      fontFamily: "'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 0 0 0",
    }}>
      {/* Header */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "#111",
        borderBottom: "1px solid #222",
        padding: "16px 20px 12px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#fff", fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>AUTONOMY.AI</div>
            <div style={{ color: "#555", fontSize: 10, marginTop: 2 }}>text-first · background-processing</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 10,
              color: AUTONOMY_COLORS[currentLevel],
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: "bold",
            }}>
              LVL {currentLevel} · {AUTONOMY_LABELS[currentLevel]}
            </div>
            <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
              next: {AUTONOMY_LABELS[nextLevel]}
            </div>
          </div>
        </div>

        {/* Level bar */}
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {[1, 2, 3].map((l) => (
            <div key={l} style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: l === currentLevel ? AUTONOMY_COLORS[l] : "#222",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        width: "100%",
        maxWidth: 480,
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: "calc(100vh - 180px)",
      }}>
        {messages.length === 0 && (
          <div style={{
            margin: "auto",
            textAlign: "center",
            color: "#333",
            fontSize: 12,
            letterSpacing: 1,
            paddingTop: 60,
          }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>◌</div>
            <div>TEXT ANYTHING</div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#222", lineHeight: 1.8 }}>
              level 1 → react<br />
              level 2 → react + surface<br />
              level 3 → react + surface + anticipate
            </div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#e5e5e5",
                borderRadius: "12px 12px 2px 12px",
                padding: "10px 14px",
                fontSize: 13,
                maxWidth: "75%",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={msg.id} style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{
                  fontSize: 9,
                  color: AUTONOMY_COLORS[msg.level],
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginLeft: 2,
                }}>
                  LVL {msg.level} · {AUTONOMY_LABELS[msg.level]}
                </div>

                <div style={{
                  background: "#111",
                  border: `1px solid ${AUTONOMY_COLORS[msg.level]}22`,
                  borderRadius: "2px 12px 12px 12px",
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}>
                  {msg.segments.map((seg, i) => (
                    <div key={i} style={segStyle[seg.type]}>
                      {segLabel[seg.type] && (
                        <div style={{
                          fontSize: 9,
                          color: seg.type === "proactive" ? "#facc15" : "#f97316",
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 3,
                        }}>
                          {segLabel[seg.type]}
                        </div>
                      )}
                      <div style={{
                        color: "#d4d4d4",
                        fontSize: 13,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                      }}>
                        {seg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              background: "#111",
              border: `1px solid ${AUTONOMY_COLORS[currentLevel]}33`,
              borderRadius: "2px 12px 12px 12px",
              padding: "10px 16px",
              display: "flex",
              gap: 5,
              alignItems: "center",
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: AUTONOMY_COLORS[currentLevel],
                  animation: `pulse 1s ${i * 0.2}s infinite`,
                  opacity: 0.6,
                }} />
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Level legend */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        padding: "0 16px 8px",
        display: "flex",
        gap: 12,
        justifyContent: "center",
      }}>
        {[1, 2, 3].map((l) => (
          <div key={l} style={{
            fontSize: 9,
            color: l === currentLevel ? AUTONOMY_COLORS[l] : "#333",
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "color 0.3s",
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: l === currentLevel ? AUTONOMY_COLORS[l] : "#222",
              transition: "background 0.3s",
            }} />
            {AUTONOMY_DESC[l]}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        padding: "10px 16px 20px",
        background: "#0a0a0a",
        borderTop: "1px solid #1a1a1a",
      }}>
        <div style={{
          display: "flex",
          gap: 8,
          background: "#111",
          border: `1px solid ${AUTONOMY_COLORS[currentLevel]}44`,
          borderRadius: 12,
          padding: "8px 12px",
          transition: "border-color 0.4s",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Message · level ${currentLevel} active…`}
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e5e5e5",
              fontSize: 13,
              fontFamily: "'Courier New', monospace",
              resize: "none",
              lineHeight: 1.5,
              paddingTop: 2,
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? AUTONOMY_COLORS[currentLevel] : "#1a1a1a",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: input.trim() && !loading ? "pointer" : "default",
              color: input.trim() && !loading ? "#000" : "#333",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.3s",
              alignSelf: "center",
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#2a2a2a", textAlign: "center", marginTop: 6, letterSpacing: 1 }}>
          ENTER TO SEND · SHIFT+ENTER FOR NEWLINE
        </div>
      </div>
    </div>
  );
}
