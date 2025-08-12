import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 環境変数の読み込み
dotenv.config();

// ES6 modules で __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "https://www.gstatic.com", "https://cdnjs.cloudflare.com"],
            "connect-src": ["'self'", "https://generativelanguage.googleapis.com", "https://*.firebaseio.com", "https://www.googleapis.com", "https://firestore.googleapis.com"],
            "frame-src": ["'self'", "https://kotoha-personalize-app.firebaseapp.com"],
            "img-src": ["'self'", "data:", "https://www.google.com"],
        },
    },
}));

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.RENDER_EXTERNAL_URL
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5500'],
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
    points: 20,
    duration: 60,
});

// --- API Routes ---
// IMPORTANT: All API routes must be defined BEFORE the static file serving.
const apiRouter = express.Router();
apiRouter.use(rateLimiterMiddleware);

// Health check endpoint for Render
apiRouter.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        geminiApi: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
    });
});

// Endpoint to provide Firebase config to the client
apiRouter.get('/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
});

// AI Chat endpoint
apiRouter.post('/chat', async (req, res) => {
    try {
        const { message, context } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Invalid message' });
        }
        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not set in environment variables.');
            return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
        }
        const response = await callGeminiAPI(message.trim(), context);
        res.json({ success: true, response });
    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Chat request failed', message: error.message });
    }
});

// Use the API router
app.use('/api', apiRouter);


// --- Frontend Serving ---
// Serve static files like CSS, JS, images, etc.
app.use(express.static(path.join(__dirname, '.'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) res.set('Content-Type', 'application/javascript; charset=utf-8');
    }
}));

// For any other request that doesn't match an API route or a static file,
// send the index.html file. This must be the LAST route.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: 'サーバー内部で予期せぬエラーが発生しました。'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Kotoha AI server running on port ${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});


// --- Helper Functions ---
function getLanguageCode(language) {
    const languageMap = {
        '日本語': 'Japanese', 'English': 'English', '한국어': 'Korean', '中文': 'Chinese',
        'Español': 'Spanish', 'Français': 'French', 'Deutsch': 'German', 'Italiano': 'Italian',
        'Português': 'Portuguese', 'Русский': 'Russian'
    };
    return languageMap[language] || 'Japanese';
}

async function callGeminiAPI(message, context = {}) {
    const { userProfile, category, recentConversations } = context;
    let systemPrompt = `あなたは「Kotoha AI」という、愛媛県での滞在をサポートする非常に親切で有能なAIアシスタントです。`;

    if (userProfile?.primaryLanguage) {
        systemPrompt += `\n\n# 重要な言語指示\n**必ず${userProfile.primaryLanguage}で回答してください。質問が日本語で書かれていても、回答は${userProfile.primaryLanguage}で統一してください。**`;
    }
    if (userProfile) {
        const profileDetails = [
            userProfile.displayName && `- 名前: ${userProfile.displayName}`,
            userProfile.nationality && `- 国籍: ${userProfile.nationality}`,
            userProfile.primaryLanguage && `- 使用言語: ${userProfile.primaryLanguage}`,
            userProfile.stayLocation && `- 滞在地: ${userProfile.stayLocation}`,
            userProfile.stayPurpose && `- 滞在目的: ${userProfile.stayPurpose}`
        ].filter(Boolean).join('\n');
        systemPrompt += `\n\n# ユーザー情報\n${profileDetails}`;
    }
    if (recentConversations?.length > 0) {
        const history = recentConversations.map((conv, index) => {
            const date = new Date(conv.timestamp.seconds * 1000).toLocaleDateString('ja-JP');
            return `## ${index + 1}. ${date} (${conv.category})\n**ユーザー:** ${conv.userMessage}\n**AI回答:** ${conv.aiResponse.substring(0, 200)}...`;
        }).join('\n\n');
        systemPrompt += `\n\n# 過去の相談履歴\nこのユーザーとの過去の会話履歴です。文脈を理解して、継続的なサポートを提供してください：\n\n${history}\n\n上記の履歴を踏まえ、必要に応じて「前回ご相談いただいた〜について」などの言及をして、継続性のある回答をしてください。`;
    }
    if (category) {
        systemPrompt += `\n\n# 現在の相談カテゴリ\n- ${category}`;
    }
    systemPrompt += `\n\n# あなたの役割と指示\n- ユーザー情報と相談カテゴリを強く意識し、パーソナライズされた回答を生成してください。\n- 愛媛県の実情に合わせた、具体的で実践的なアドバイスを心がけてください。\n- 外国人ユーザーにも分かりやすいように、専門用語を避け、丁寧な言葉遣いで説明してください。\n- 回答はMarkdown形式で、見出しやリストを活用して分かりやすく構成してください。\n- 緊急性が高いと判断した場合は、必ず警察(110)や救急(119)などの公的な連絡先を案内してください。\n- 常に親しみやすく、ユーザーに寄り添う姿勢で回答してください。`;
    if (userProfile?.stayLocation) {
        systemPrompt += `\n- 特に${userProfile.stayLocation}の情報を優先して提供してください。一般的な愛媛県情報よりも、${userProfile.stayLocation}特有の情報があれば詳しく案内してください。`;
    }
    const fullPrompt = `${systemPrompt}\n\n# ユーザーからの質問\n${message}`;
    const requestBody = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
            temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048,
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
        console.error(`Gemini API Error: ${response.status}`, errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        console.warn('No content returned from Gemini API:', JSON.stringify(data, null, 2));
        return '申し訳ありません、現在AIからの応答を取得できません。しばらくしてからもう一度お試しください。';
    }
}
