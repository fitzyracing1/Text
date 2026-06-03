import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORIES = [
  { id: "news",      label: "NEWS",      icon: "◎", color: "#60a5fa", prompt: "Give me 3 very brief breaking news items about Munich, Germany right now. Each item: headline (max 8 words) + one sentence detail. Be specific with real-sounding Munich locations, people, or events." },
  { id: "weather",   label: "WEATHER",   icon: "◈", color: "#34d399", prompt: "Give the current Munich weather snapshot: temperature in °C, conditions, wind speed, and a one-sentence forecast for the next 6 hours. Include a specific detail about today." },
  { id: "events",    label: "EVENTS",    icon: "◇", color: "#f59e0b", prompt: "List 3 events happening in Munich today or tonight. Format: event name · venue · time · one sentence description. Be specific with real Munich venues." },
  { id: "transport", label: "TRANSPORT", icon: "◉", color: "#a78bfa", prompt: "Give Munich public transport status: U-Bahn, S-Bahn, and tram. For each: one line status (normal/delayed/disrupted) and if disrupted, which lines and brief reason." },
];

const INTERVAL_OPTIONS = [
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
  { label: "2m",  value: 120000 },
];

const MOCK_MODE = !import.meta.env.VITE_USE_API;

const MOCK_RESPONSES = {
  news:      "◎ Flood warnings lifted for Isar river after water levels normalize\nBavarian State Office confirms no residential areas affected; clean-up crews deployed.\n\n◎ FC Bayern signs youth talent from 1860 München academy\nThe 19-year-old midfielder joins first-team training squad ahead of Bundesliga restart.\n\n◎ Oktoberfest 2026 tent permits under review by Munich city council\nMayor Reiter signals stricter sustainability requirements for operators this cycle.",
  weather:   "12°C · Partly cloudy · Wind 18 km/h from the northwest\nExpect clearing skies by early afternoon with highs reaching 16°C; Föhn conditions possible by evening, bringing strong gusts to the Alpine foothills.",
  events:    "◇ Munich Philharmonic · Gasteig HP8 · 20:00 · Mahler Symphony No. 5 conducted by Lahav Shani, featuring soprano Anna Lucia Richter.\n\n◇ Street Food Market · Wittelsbacherplatz · 11:00–22:00 · 40+ international vendors including Bavarian, Korean, and Lebanese specialties.\n\n◇ Glyptothek Night · Königsplatz · 19:00 · Special evening access to the Greek and Roman sculpture collection with live classical guitar.",
  transport: "U-Bahn: Normal operations on all lines\n\nS-Bahn: Minor delays (8–12 min) on S3 Pasing–Ostbahnhof due to a signal fault at Rosenheimer Platz. All other S lines running on schedule.\n\nTram: Normal operations. Tram 16 running on replacement bus service between Stachus and Sendlinger Tor for track maintenance.",
};

async function fetchMunich(category) {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
    return MOCK_RESPONSES[category.id];
  }

  const response = await fetch("/api/munich-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: category.id, prompt: category.prompt }),
  });
  const data = await response.json();
  return data.result || "No data received.";
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function FeedEntry({ entry, color }) {
  return (
    <div style={{
      borderLeft: `2px solid ${color}`,
      paddingLeft: 12,
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, marginBottom: 4 }}>
        {formatTime(entry.timestamp)} · {entry.status === "ok" ? "LIVE" : "ERR"}
      </div>
      <div style={{
        color: entry.status === "ok" ? "#d4d4d4" : "#f87171",
        fontSize: 12,
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        fontFamily: "'Courier New', monospace",
      }}>
        {entry.text}
      </div>
    </div>
  );
}

function CategoryPanel({ cat, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? `${cat.color}18` : "transparent",
        border: `1px solid ${active ? cat.color : "#222"}`,
        borderRadius: 6,
        padding: "6px 4px",
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 14, color: active ? cat.color : "#444" }}>{cat.icon}</span>
      <span style={{ fontSize: 8, color: active ? cat.color : "#444", letterSpacing: 1.5 }}>{cat.label}</span>
    </button>
  );
}

export default function MunichBot() {
  const [activeCategory, setActiveCategory] = useState("news");
  const [feeds, setFeeds] = useState(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, []]))
  );
  const [loading, setLoading] = useState(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, false]))
  );
  const [running, setRunning] = useState(true);
  const [interval, setIntervalMs] = useState(30000);
  const [nextTick, setNextTick] = useState(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const [countdown, setCountdown] = useState(0);
  const feedRef = useRef(null);

  const runSearch = useCallback(async (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    if (!cat) return;

    setLoading((l) => ({ ...l, [catId]: true }));
    try {
      const text = await fetchMunich(cat);
      setFeeds((f) => ({
        ...f,
        [catId]: [{ text, timestamp: new Date(), status: "ok" }, ...f[catId]].slice(0, 20),
      }));
    } catch {
      setFeeds((f) => ({
        ...f,
        [catId]: [{ text: "Search failed — will retry next cycle.", timestamp: new Date(), status: "err" }, ...f[catId]].slice(0, 20),
      }));
    }
    setLoading((l) => ({ ...l, [catId]: false }));
  }, []);

  const runAllSearches = useCallback(() => {
    CATEGORIES.forEach((cat) => runSearch(cat.id));
  }, [runSearch]);

  // Initial load
  useEffect(() => {
    runAllSearches();
  }, []);

  // Auto-refresh loop
  useEffect(() => {
    if (!running) {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
      return;
    }

    const nextAt = Date.now() + interval;
    setNextTick(nextAt);
    setCountdown(Math.ceil(interval / 1000));

    timerRef.current = setInterval(() => {
      runAllSearches();
      setNextTick(Date.now() + interval);
    }, interval);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : Math.ceil(interval / 1000)));
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [running, interval, runAllSearches]);

  // Scroll feed to top on category change
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeCategory]);

  const cat = CATEGORIES.find((c) => c.id === activeCategory);
  const activeFeed = feeds[activeCategory];
  const isLoading = loading[activeCategory];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      fontFamily: "'Courier New', monospace",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Header */}
      <div style={{
        width: "100%",
        maxWidth: 520,
        background: "#0d0d0d",
        borderBottom: "1px solid #1a1a1a",
        padding: "14px 20px 12px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>
              MUNICH.BOT
            </div>
            <div style={{ color: "#555", fontSize: 9, marginTop: 2, letterSpacing: 1 }}>
              LIVE CITY INTELLIGENCE
              {MOCK_MODE && <span style={{ color: "#333", marginLeft: 6 }}>· DEMO</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Interval selector */}
            <div style={{ display: "flex", gap: 4 }}>
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIntervalMs(opt.value)}
                  style={{
                    background: interval === opt.value ? "#1a1a1a" : "transparent",
                    border: `1px solid ${interval === opt.value ? "#333" : "#1a1a1a"}`,
                    borderRadius: 4,
                    color: interval === opt.value ? "#888" : "#333",
                    fontSize: 9,
                    padding: "3px 6px",
                    cursor: "pointer",
                    letterSpacing: 0.5,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Run/Pause */}
            <button
              onClick={() => setRunning((r) => !r)}
              style={{
                background: running ? "#1a1a1a" : "#0f1a0f",
                border: `1px solid ${running ? "#333" : "#1a3a1a"}`,
                borderRadius: 6,
                color: running ? "#f87171" : "#4ade80",
                fontSize: 9,
                padding: "4px 10px",
                cursor: "pointer",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {running ? "PAUSE" : "RUN"}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {CATEGORIES.map((c) => (
            <CategoryPanel
              key={c.id}
              cat={c}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        width: "100%",
        maxWidth: 520,
        padding: "6px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #111",
        background: "#080808",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isLoading ? cat.color : (running ? "#333" : "#1a1a1a"),
            boxShadow: isLoading ? `0 0 6px ${cat.color}` : "none",
            animation: isLoading ? "blink 0.8s infinite" : "none",
          }} />
          <style>{`@keyframes blink { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
          <span style={{ fontSize: 9, color: "#444", letterSpacing: 1 }}>
            {isLoading ? `SEARCHING ${cat.label}…` : `${activeFeed.length} RESULT${activeFeed.length !== 1 ? "S" : ""}`}
          </span>
        </div>
        {running && (
          <span style={{ fontSize: 9, color: "#333", letterSpacing: 0.5 }}>
            NEXT REFRESH IN {countdown}s
          </span>
        )}
        {!running && (
          <span style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>PAUSED</span>
        )}
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        style={{
          width: "100%",
          maxWidth: 520,
          flex: 1,
          padding: "20px 20px 40px",
          overflowY: "auto",
          minHeight: "calc(100vh - 200px)",
        }}
      >
        {activeFeed.length === 0 && !isLoading && (
          <div style={{ textAlign: "center", color: "#222", fontSize: 11, paddingTop: 60, letterSpacing: 1 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{cat.icon}</div>
            <div>SEARCHING MUNICH…</div>
          </div>
        )}

        {isLoading && activeFeed.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ color: cat.color, fontSize: 24, marginBottom: 12 }}>{cat.icon}</div>
            <div style={{ color: "#444", fontSize: 10, letterSpacing: 2 }}>FETCHING LIVE DATA…</div>
          </div>
        )}

        {activeFeed.map((entry, i) => (
          <FeedEntry key={i} entry={entry} color={i === 0 ? cat.color : "#222"} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        width: "100%",
        maxWidth: 520,
        borderTop: "1px solid #111",
        padding: "8px 20px",
        display: "flex",
        gap: 16,
        justifyContent: "center",
        background: "#080808",
      }}>
        {CATEGORIES.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: loading[c.id] ? c.color : "#1a1a1a",
              boxShadow: loading[c.id] ? `0 0 4px ${c.color}` : "none",
              transition: "all 0.3s",
            }} />
            <span style={{ fontSize: 8, color: loading[c.id] ? c.color : "#2a2a2a", letterSpacing: 1 }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
