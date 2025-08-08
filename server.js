// server.js  —— Firebaseなし・AI相談最優先の暫定版
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- 基本設定 ----
app.use(express.json({ limit: "1mb" }));

// 静的配信（ルート直下の index.html を返す）
app.use(express.static(__dirname));

// ---- ヘルスチェック ----
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: "disabled",                         // ← 今は使わない
    geminiApi: process.env.GEMINI_API_KEY ? "configured" : "missing"
  });
});

// ---- AI相談（Gemini 直叩き）----
// 入力: { message: "..." }  出力: { success, response }
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: "GEMINI_API_KEY not set" });

    const userMsg = (req.body?.message || "").toString().trim() || "自己紹介してください。";
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
    };

    // 15秒タイムアウト
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    clearTimeout(t);

    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      return res.status(502).json({ success: false, error: `gemini ${r.status}`, detail: errTxt });
    }

    const data = await r.json().catch(() => ({}));
    let text = "";
    try {
      const cands = data?.candidates ?? [];
      if (cands[0]?.content?.parts?.length) {
        for (const p of cands[0].content.parts) if (typeof p.text === "string") text += p.text;
      }
    } catch {}
    text = (text || "").trim();
    if (!text) return res.status(500).json({ success: false, error: "empty_response" });

    return res.status(200).json({ success: true, response: text });
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return res.status(500).json({ success: false, error: isAbort ? "timeout" : String(e) });
  }
});

// ---- ルート & SPAキャッチオール（常に index.html を返す）----
app.get("*", (_req, res) => {
  const idx = path.join(__dirname, "index.html");
  if (fs.existsSync(idx)) return res.sendFile(idx);
  return res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
