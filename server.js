import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import admin from 'firebase-admin';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Firebase Admin ----
if (!admin.apps.length) {
  // ※ Renderなどでサービスアカウント未設定でもprojectIdだけで初期化できる構成
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'kotoha-personalize-app',
  });
}
const db = admin.firestore();

// ---- Security / Middlewares ----
app.use(helmet({ contentSecurityPolicy: false })); // 必要に応じて厳格化
app.use(compression());

// CORS（必要に応じて許可ドメインを追加）
const corsOrigins =
  process.env.NODE_ENV === 'production'
    ? [process.env.RENDER_EXTERNAL_URL].filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- Rate Limit ----
const rateLimiter = new RateLimiterMemory({ keyPrefix: 'middleware', points: 15, duration: 60 });
const rateLimiterMiddleware = (req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests.' }));
};

app.use('/api', rateLimiterMiddleware);

// ---- Static ----
app.use(
  express.static(path.join(__dirname, '.'), {
    setHeaders: (res, p) => {
      if (p.endsWith('.js')) res.set('Content-Type', 'application/javascript; charset=utf-8');
    },
  })
);

// ======================= API =======================

// City-first応答のAI相談
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context, userId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid message' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
    }

    let userProfile = null;
    if (userId) {
      const snap = await db.collection('kotoha_users').doc(userId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        userProfile = data.profile || null;
      }
    }

    const aiText = await callGeminiAPI(message.trim(), {
      ...(context || {}),
      userProfile,
    });

    return res.json({ success: true, response: aiText });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Chat request failed', message: err.message });
  }
});

// ---- Gemini API call (uses global fetch on Node 18+) ----
async function callGeminiAPI(message, context = {}) {
  const { userProfile, category } = context;

  const stayLocation =
    userProfile && userProfile.stayLocation ? String(userProfile.stayLocation) : '';
  const displayName =
    userProfile && userProfile.displayName ? String(userProfile.displayName) : '';
  const nationality =
    userProfile && userProfile.nationality ? String(userProfile.nationality) : '';
  const languagesArr =
    userProfile && Array.isArray(userProfile.languages) ? userProfile.languages : [];

  let systemPrompt = `
You are "Kotoha AI", a helpful assistant for long/short stay visitors in Ehime, Japan.

# User Profile
- displayName: ${displayName || '(unset)'}
- nationality: ${nationality || '(unset)'}
- stayLocation: ${stayLocation || '(unset)'}
- languages: ${languagesArr.length ? languagesArr.join(', ') : '(unset)'}

# Category
- ${category || 'general'}

# Answering Policy (VERY IMPORTANT)
1) If stayLocation (city/ward/town) is available, answer **city-first** with concrete, actionable steps.
2) If reliable city-level info is not available, give **prefecture-level alternatives** (in Ehime).
3) If still insufficient, give **general guidance** (how to proceed safely).
4) If stayLocation is missing/unclear, ask **ONE quick clarifying question** first, then proceed to answer (do NOT block the flow).
5) Use concise Markdown with bullet points. Japanese first; add brief English notes only if helpful.

# Output Sections (use these headings; omit if not applicable)
## 市内向け（${stayLocation || '滞在地未設定'}）
- ...

## 県内の代替
- ...

## 追加ガイダンス
- ...
`.trim();

  if (stayLocation) {
    systemPrompt += `

# Style Example (city-first split)
User: バスの乗り方が分からない
Assistant:
## 市内向け（${stayLocation}）
- 市内の主要駅・バスターミナル案内を活用
- 交通ICカードや一日乗車券の有無を確認
## 県内の代替
- ${stayLocation}発のJR/路線バスの一般的な探し方
## 追加ガイダンス
- 英語表記が少ない場合の対処、困った時の連絡手段
`.trim();
  }

  const requestBody = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n# ユーザーからの質問\n${message}` }] }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    const t = await resp.text();
    // ← ここがテンプレートリテラル（バックスティック）です。エスケープ不要／そのままにしてください。
    throw new Error(`API request failed with status ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  if (data.candidates?.length && data.candidates[0].content?.parts?.length) {
    return data.candidates[0].content.parts[0].text;
  }
  return '申し訳ありません、その質問にはお答えできません。別の質問を試してみてください。';
}

// ---- Healthcheck ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
    geminiApi: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
  });
});

// ---- Fallback to frontend ----
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Kotoha AI server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
