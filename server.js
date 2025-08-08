// server.js — 愛媛限定回答＋任意でFirestore記録（環境変数が無ければ自動スキップ）
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from "firebase-admin"; // 依存はpackage.jsonにある想定

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------- 基本設定 -------
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname)); // ルート直下のindex.htmlを返す

// ------- Firestore (任意) -------
let db = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  const json = raw ? JSON.parse(raw) : null;   // RenderにサービスアカウントJSONをそのまま貼る想定
  if (json) {
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(json) });
    db = admin.firestore();
    console.log("Firestore enabled");
  } else {
    console.log("Firestore disabled (no FIREBASE_SERVICE_ACCOUNT)");
  }
} catch (e) {
  console.warn("Firestore init skipped:", e?.message || e);
}

// ------- ヘルスチェック -------
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: db ? "connected" : "disabled",
    geminiApi: process.env.GEMINI_API_KEY ? "configured" : "missing",
  });
});

// ------- AI相談（愛媛限定＋任意ログ） -------
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: "GEMINI_API_KEY not set" });

    const userMsg = (req.body?.message || "").toString().trim() || "自己紹介してください。";
    const profile = req.body?.profile || {};
    const stayArea = profile?.stayArea || "愛媛県"; // 例: "松山市", "今治市" でもOK
    const language = profile?.lang || "ja";

    const system = [
      "あなたは愛媛県の滞在者支援アシスタントです。",
      "回答は原則として愛媛県内の情報に限定してください（県外は簡単な注意や参考URLに留める）。",
      "安全・行政・医療などは公式情報を優先。分からない時は正直に『分かりません』と答える。",
      `ユーザー滞在地: ${stayArea}`,
      language === "en" ? "Please answer in English if the user asks in English." : "通常は日本語で簡潔に回答。"
    ].join("\n");

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: `${system}\n\nユーザーの質問: ${userMsg}` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 400 }
    };

    // 15秒タイムアウト
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: ac.signal
    });
    clearTimeout(t);

    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      return res.status(502).json({ success: false, error: `gemini ${r.status}`, detail: errTxt });
    }

    const data = await r.json().catch(() => ({}));
    let text = "";
    try {
      const c = data?.candidates?.[0]?.content?.parts || [];
      for (const p of c) if (typeof p.text === "string") text += p.text;
    } catch {}
    text = (text || "").trim();
    if (!text) return res.status(500).json({ success: false, error: "empty_response" });

    // 任意ログ（dbがある時だけ記録、無ければスキップ）
    try {
      if (db) {
        await db.collection("kotoha_chat_logs").add({
          ts: admin.firestore.FieldValue.serverTimestamp(),
          userId: req.body?.userId || null,
          stayArea,
          message: userMsg,
          response: text.slice(0, 4000)
        });
      }
    } catch (e) {
      console.warn("log skipped:", e?.message || e);
    }

    return res.status(200).json({ success: true, response: text });
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return res.status(500).json({ success: false, error: isAbort ? "timeout" : String(e) });
  }
});

// ------- ルート/SPAs -------
app.get("*", (_req, res) => {
  const idx = path.join(__dirname, "index.html");
  if (fs.existsSync(idx)) return res.sendFile(idx);
  return res.status(404).send("Not Found");
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
