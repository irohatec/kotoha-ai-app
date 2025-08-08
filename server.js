import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname（ESM）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- 基盤強化 ----
app.use(express.json({ limit: "1mb" })); // JSONボディ受け取り
// CORS（依存を増やさずヘッダで許可）
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// ---- ここまで ----

// 静的配信（public 配下）
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// ヘルスチェック
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// API動作確認
app.get("/api/ping", (_req, res) => {
  res.status(200).json({ pong: true, time: new Date().toISOString() });
});

// 環境変数の存在チェック（値は返さない）
app.get("/api/env-check", (_req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  res.status(200).json({ hasGeminiKey });
});

// Gemini API 接続テスト（GET）
app.get("/api/gemini-test", async (_req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "GEMINI_API_KEY not set" });

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: "Reply with exactly: PONG" }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 20 }
    };

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 12000);

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    clearTimeout(timeout);

    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, status: r.status, err: errTxt });
    }

    const data = await r.json().catch(() => ({}));
    let text = "";
    try {
      const cands = data?.candidates ?? [];
      if (cands[0]?.content?.parts?.length) {
        for (const p of cands[0].content.parts) if (typeof p.text === "string") text += p.text;
      }
    } catch {}

    return res.status(200).json({ ok: true, model, text });
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return res.status(500).json({ ok: false, error: isAbort ? "timeout" : String(e) });
  }
});

// ★ 新規：SNS最小生成API（POST）
// 入力: { "prompt": "短いテーマ" }
// 出力: { ok: true, text: "<短文>" }
app.post("/api/generate-sns", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: "GEMINI_API_KEY not set" });

    const userPrompt = (req.body?.prompt || "").toString().trim();
    const topic = userPrompt || "中小企業のDX推進に関する短い一文";

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // 最小要件：日本語・短文・装飾なし
    const systemInstruction =
      "日本語で、短く1文だけを出力してください。絵文字やハッシュタグ、記号、前置きは不要です。出力はテキストのみ。";

    const body = {
      contents: [
        { role: "user", parts: [{ text: `${systemInstruction}\nテーマ: ${topic}` }] }
      ],
      generationConfig: { temperature: 0.6, maxOutputTokens: 80 }
    };

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
      return res.status(502).json({ ok: false, status: r.status, err: errTxt });
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
    if (!text) return res.status(500).json({ ok: false, error: "empty_response" });

    return res.status(200).json({ ok: true, model, text });
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    return res.status(500).json({ ok: false, error: isAbort ? "timeout" : String(e) });
  }
});

// ルート & SPAキャッチオール
app.get("*", (_req, res) => {
  const indexPath = path.join(publicDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>セットアップ中</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans JP",sans-serif;line-height:1.6;padding:24px}code{background:#f3f4f6;padding:2px 6px;border-radius:6px}</style>
</head><body>
<h1>✅ サーバは稼働中</h1>
<p><code>/healthz</code> は <strong>ok</strong> を返します。</p>
<p>API確認：<code>/api/ping</code> にアクセスするとJSONを返します。</p>
</body></html>`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
