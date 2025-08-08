// server.js — 愛媛限定回答＋任意ログ保存（Firebaseは環境変数があれば自動有効）
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- 基本設定（同一オリジン想定のためCORSなし）----
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname)); // ルート直下の index.html を配信

// ---- Firestore（任意：FIREBASE_SERVICE_ACCOUNT があれば有効化）----
let db = null;
let admin = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (raw) {
    // 依存が無い環境でも落ちないように動的 import
    admin = (await import("firebase-admin")).default;
    const sa = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    db = admin.firestore();
    console.log("Firestore enabled");
  } else {
    console.log("Firestore disabled (no FIREBASE_SERVICE_ACCOUNT)");
  }
} catch (e) {
  // 依存未インストール or JSON不正でもアプリは起動させる
  db = null;
  console.warn("Firestore init skipped:", e?.message || e);
}

// ---- ヘルスチェック ----
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

// ---- AI相談（愛媛限定＋プロファイル反映＋任意ログ保存）----
// 入力: { message, userId?, profile?: { stayArea?, lang? } }
// 出力: { success: boolean, response?: string, error?: string }
app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "GEMINI_API_KEY not set" });
    }

    const userMsg = (req.body?.message || "").toString().trim();
    if (!userMsg) {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    const profile = req.body?.profile || {};
    const stayArea = (profile.stayArea || "愛媛県").toString();
    const language = (profile.lang || "ja").toLowerCase();

    const system = [
      "あなたは愛媛県の滞在者支援アシスタントです。",
      "回答は原則として愛媛県内の情報に限定してください。県外情報は参考程度の注意喚起に留めます。",
      "行政・医療・安全に関わる情報は、できるだけ公式の窓口・電話番号・検索語など、次の行動に繋がる形で簡潔に案内してください。",
      "不明な点は推測せず『分かりません』と述べ、問い合わせ先や確認方法を提案してください。",
      `ユーザーの滞在地（優先すべきエリア）: ${stayArea}`,
      language === "en"
        ? "If the user writes in English, answer in English. Otherwise, use concise Japanese."
        : "基本は日本語で、短く・具体的に回答してください。"
    ].join("\n");

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        { role: "user", parts: [{ text: `${system}\n\nユーザーの質問: ${userMsg}` }] }
      ],
      generationConfig: { temperature: 0.6, maxOutputTokens: 400 }
    };

    // タイムアウト 15s
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15000);

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    clearTimeout(timeout);

    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      return res.status(502).json({ success: false, error: `gemini ${r.status}`, detail: errTxt });
    }

    const data = await r.json().catch(() => ({}));
    let text = "";
    try {
      const parts = data?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) if (typeof p.text === "string") text += p.text;
    } catch {}
    text = (text || "").trim();
    if (!text) return res.status(500).json({ success: false, error: "empty_response" });

    // 任意ログ保存（dbが有効な時のみ）
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

// ---- ルート & SPAキャッチオール（常に index.html を返す）----
app.get("*", (_req, res) => {
  const idx = path.join(__dirname, "index.html");
  if (fs.existsSync(idx)) return res.sendFile(idx);
  return res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
