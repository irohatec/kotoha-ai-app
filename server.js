import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import { RateLimiterMemory } from "rate-limiter-flexible";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ───────────────────────────────
// 1. Helmet セキュリティ設定
// ───────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://www.googletagmanager.com"],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://generativelanguage.googleapis.com",
          process.env.RENDER_EXTERNAL_URL || ""
        ],
        imgSrc: ["'self'", "data:", "https://www.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: ["'self'", "https://www.gstatic.com"],
      },
    },
  })
);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: "2mb" }));

// ───────────────────────────────
// 2. レートリミッター
// ───────────────────────────────
const rateLimiter = new RateLimiterMemory({
  points: 30, // 30 requests
  duration: 60, // per minute
});

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: "Too many requests" }));
});

// ───────────────────────────────
// 3. Firebase Admin 初期化
// ───────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || "kotoha-personalize-app",
  });
}
const db = admin.firestore();

// ───────────────────────────────
// 4. Gemini API 初期化
// ───────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY が設定されていません。");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ───────────────────────────────
// 5. AIチャットエンドポイント
// ───────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Geminiへリクエスト
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(message);

    const aiResponse = result.response.text();

    // Firestoreに履歴保存
    if (userId) {
      await db.collection("chatHistory").add({
        userId,
        message,
        aiResponse,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ response: aiResponse });
  } catch (error) {
    console.error("AIチャットエラー:", error);
    res.status(500).json({ error: "AIチャットの処理中にエラーが発生しました。" });
  }
});

// ───────────────────────────────
// 6. 動作確認用
// ───────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    gemini: !!process.env.GEMINI_API_KEY,
    firebase: !!process.env.FIREBASE_PROJECT_ID
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
