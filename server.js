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

// Firebase Admin 初期化
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'kotoha-personalize-app',
  });
}
const db = admin.firestore();

// Security
app.use(helmet({ contentSecurityPolicy: false })); // 本番は要調整
// CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.RENDER_EXTERNAL_URL]
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limit
const rateLimiter = new RateLimiterMemory({ keyPrefix: 'middleware', points: 15, duration: 60 });
const rateLimiterMiddleware = (req, res, next) => {
  rateLimiter.consume(req.ip).then(() => next()).catch(() => res.status(429).json({ error: 'Too many requests.' }));
};

// Static
app.use(express.static(path.join(__dirname, '.'), {
  setHeaders: (res, p) => { if (p.endsWith('.js')) res.set('Content-Type', 'application/javascript; charset=utf-8'); }
}));

// API routes
app.use('/api', rateLimiterMiddleware);

// ============ Chat ============ //
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context, userId } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid message' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
    }

    let userProfile = null;
    if (userId) {
      const snap = await db.collection('kotoha_users').doc(userId).get();
      if (snap.exists) userProfile = snap.data().profile || null;
    }

    const response = await callGeminiAPI(message.trim(), { ...(context || {}), userProfile });
    res.json({ success: true, response });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Chat request failed', message: error.message });
  }
});

// -------- Gemini API呼び出し -------- //
async function callGeminiAPI(message, context = {}) {
  const { userProfile, category } = context;

  // City-first 方針を強く明示
  const stayLocation = (userProfile && userProfile.stayLocation) ? String(userProfile.stayLocation) : '';
  const displayName  = (userProfile && userProfile.displayName) ? String(userProfile.displayName) : '';
  const nationality  = (userProfile && userProfile.nationality) ? String(userProfile.nationality) : '';
  const languagesArr = (userProfile && Array.isArray(userProfile.languages)) ? userProfile.languages : [];

  let systemPrompt = `
あなたは「Kotoha AI」。愛媛県での滞在をサポートする非常に親切で有能なAIアシスタントです。

# ユーザー情報
- 名前: ${displayName || '（未設定）'}
- 国籍: ${nationality || '（未設定）'}
- 滞在地: ${stayLocation || '（未設定）'}
- 使用言語: ${languagesArr.length ? languagesArr.join(', ') : '（未設定）'}

# 相談カテゴリ
- ${category || 'general'}

# 回答ポリシー（最重要）
1) ユーザーの「滞在地（市区町村）」に合致する情報を**最優先**で返してください。
2) 市区町村レベルの確かな情報がなければ、**県内の代替策**を提示してください。
3) それでも不十分な場合は、**一般的なガイダンス**を補います。
4) 滞在地が未設定・あいまい・情報が薄い場合は、最初に**1つだけ簡単な確認質問**を行い、即回答に続けてください（質問で会話が止まらないように）。
5) 重要情報は誤解を避けるため、日本語を基本に、必要なら最後に英語補足を簡潔に付けても構いません。

# 出力フォーマット
必ず以下の見出しで返してください（該当が無い見出しは省略OK）：
## 市内向け（${stayLocation || '滞在地未設定'})
- （市内での具体的行動、窓口、移動手段、施設の探し方 等）

## 県内の代替
- （同カテゴリで県内ならこう動ける、調べ方、代表的な機関 等）

## 追加ガイダンス
- （注意点、持ち物、問い合わせ先（警察110/消防・救急119等）、次の一手）

# 生成ルール
- 愛媛県の文脈に合わせ、観光客/長期滞在者が**今すぐ取れる行動**を具体化。
- 固有名詞が不確かな場合は「例：～」「公式サイト/市役所に確認」で表現。
- 緊急性が高い場合は、必ず110/119など公的連絡先を明記。
- Markdownで簡潔に。箇条書き主体。
`.trim();

  // Few-shot（市区町村優先の出し分け例）
  if (stayLocation) {
    systemPrompt += `

# 参考スタイル例（市区町村優先の出し分け）
ユーザー: 「バスの乗り方が分からない」
アシスタント（良い例）:
## 市内向け（${stayLocation}）
- まずは市内の主要駅・バスターミナルの案内所を活用
- 交通ICカードや一日乗車券の有無を確認
## 県内の代替
- ${stayLocation}発のJR/路線バスの一般的な探し方
## 追加ガイダンス
- 英語表記が少ない場合の対処、困った時の連絡手段 など
`.trim();
  }

  const requestBody = {
    contents: [{ parts: [{ text: systemPrompt + "\n\n# ユーザーからの質問\n" + message }] }],
    generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 }
  };

  const fetch = (await import('node-fetch')).default;
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
  );

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(\`API request failed with status \${resp.status}: \${t}\`);
  }

  const data = await resp.json();
  if (data.candidates?.length && data.candidates[0].content?.parts?.length) {
    return data.candidates[0].content.parts[0].text;
  }
  return '申し訳ありません、その質問にはお答えできません。別の質問を試してみてください。';
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
    geminiApi: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
  });
});

// Fallback to frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: 'サーバー内部エラーが発生しました。' });
});

app.listen(PORT, () => {
  console.log(`🚀 Kotoha AI server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
