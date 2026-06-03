require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const MUNICH_PROMPTS = {
  news:      "Give me 3 very brief breaking news items about Munich, Germany right now. Each item: headline (max 8 words) + one sentence detail. Be specific with real-sounding Munich locations, people, or events.",
  weather:   "Give the current Munich weather snapshot: temperature in °C, conditions, wind speed, and a one-sentence forecast for the next 6 hours. Include a specific detail about today.",
  events:    "List 3 events happening in Munich today or tonight. Format: event name · venue · time · one sentence description. Be specific with real Munich venues.",
  transport: "Give Munich public transport status: U-Bahn, S-Bahn, and tram. For each: one line status (normal/delayed/disrupted) and if disrupted, which lines and brief reason.",
};

app.post("/api/munich-search", async (req, res) => {
  const { category, prompt } = req.body;
  const systemPrompt = MUNICH_PROMPTS[category] || prompt;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: "You are a real-time Munich city intelligence feed. Be concise, specific, and factual-sounding. No disclaimers.",
      messages: [{ role: "user", content: systemPrompt }],
    }),
  });

  const data = await response.json();
  res.json({ result: data.content?.map((b) => b.text || "").join("") || "No data." });
});

app.post("/api/messages", async (req, res) => {
  const { messages, system } = req.body;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages,
    }),
  });

  const data = await response.json();
  res.json(data);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
