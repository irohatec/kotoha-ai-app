import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import admin from 'firebase-admin';

// 環境変数の読み込み
dotenv.config();

// ES6 modules で __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.join(__filename, '..')); // プロジェクトルートを指すように調整

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin初期化
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'kotoha-personalize-app',
    });
}

const db = admin.firestore();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Renderでのデプロイを容易にするため、一旦無効化。本番では要調整
}));

// CORS configuration
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

// Rate limiting
const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'middleware',
    points: 15, // 少し緩和
    duration: 60,
});

const rateLimiterMiddleware = (req, res, next) => {
    rateLimiter.consume(req.ip)
        .then(() => next())
        .catch(() => res.status(429).json({ error: 'Too many requests.' }));
};

// Static files
app.use(express.static(path.join(__dirname, '.'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) res.set('Content-Type', 'application/javascript; charset=utf-8');
    }
}));

// API Routes
app.use('/api', rateLimiterMiddleware);

// AI Chat endpoint
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
            const userDoc = await db.collection('kotoha_users').doc(userId).get();
            if (userDoc.exists) userProfile = userDoc.data().profile;
        }

        const response = await callGeminiAPI(message.trim(), { ...context, userProfile });
        
        res.json({ success: true, response });

    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Chat request failed', message: error.message });
    }
});

// Gemini API call function
async function callGeminiAPI(message, context = {}) {
    const { userProfile, category } = context;
    
    let systemPrompt = `あなたは「Kotoha AI」という、愛媛県での滞在をサポートする非常に親切で有能なAIアシスタントです。`;

    if (userProfile) {
        systemPrompt += `\n\n# ユーザー情報\n`;
        if (userProfile.displayName) systemPrompt += `- 名前: ${userProfile.displayName}\n`;
        if (userProfile.nationality) systemPrompt += `- 国籍: ${userProfile.nationality}\n`;
        if (userProfile.stayLocation) systemPrompt += `- 滞在地: ${userProfile.stayLocation}\n`;
        if (userProfile.languages && userProfile.languages.length > 0) systemPrompt += `- 使用言語: ${userProfile.languages.join(', ')}\n`;
    }
    
    if (category) {
        systemPrompt += `\n# 相談カテゴリ\n- ${category}\n`;
    }

    systemPrompt += `\n# あなたの役割と指示\n- ユーザー情報と相談カテゴリを強く意識し、パーソナライズされた回答を生成してください。\n- 愛媛県の実情に合わせた、具体的で実践的なアドバイスを心がけてください。\n- 外国人ユーザーにも分かりやすいように、専門用語を避け、丁寧な言葉遣いで説明してください。\n- 回答はMarkdown形式で、見出しやリストを活用して分かりやすく構成してください。\n- 緊急性が高いと判断した場合は、必ず警察(110)や救急(119)などの公的な連絡先を案内してください。\n- 常に親しみやすく、ユーザーに寄り添う姿勢で回答してください。`;

    const requestBody = {
        contents: [{ parts: [{ text: systemPrompt + "\n\n# ユーザーからの質問\n" + message }] }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
    };

    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, 
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        return '申し訳ありません、その質問にはお答えできません。別の質問を試してみてください。';
    }
}

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
        geminiApi: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
    });
});

// Serve frontend files
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: 'サーバー内部エラーが発生しました。'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Kotoha AI server running on port ${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
