import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RateLimiterMemory } from 'rate-limiter-flexible';
// firebase-admin はサーバー側では不要なため削除しました
// import admin from 'firebase-admin';

// 環境変数の読み込み
dotenv.config();

// ES6 modules で __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false
}));

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.RENDER_EXTERNAL_URL, `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`]
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
    points: 15,
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
        const { message, context } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Invalid message' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
        }

        // サーバー側ではユーザープロファイルは直接扱わず、クライアントから渡されたコンテキストのみ利用
        const response = await callGeminiAPI(message.trim(), context);
        
        res.json({ success: true, response });

    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Chat request failed', message: error.message });
    }
});

// 言語コード変換
function getLanguageCode(language) {
    const languageMap = {
        '日本語': 'Japanese',
        'English': 'English',
        '한국어': 'Korean', 
        '中文': 'Chinese',
        'Español': 'Spanish',
        'Français': 'French',
        'Deutsch': 'German',
        'Italiano': 'Italian',
        'Português': 'Portuguese',
        'Русский': 'Russian'
    };
    return languageMap[language] || 'Japanese';
}

// Gemini API call function
async function callGeminiAPI(message, context = {}) {
    const { userProfile, category, recentConversations } = context;
    
    let systemPrompt = `あなたは「Kotoha AI」という、愛媛県での滞在をサポートする非常に親切で有能なAIアシスタントです。`;

    // 言語設定の追加
    let responseLanguage = 'Japanese';
    if (userProfile && userProfile.primaryLanguage) {
        responseLanguage = getLanguageCode(userProfile.primaryLanguage);
        systemPrompt += `\n\n# 重要な言語指示\n**必ず${userProfile.primaryLanguage}で回答してください。質問が日本語で書かれていても、回答は${userProfile.primaryLanguage}で統一してください。**`;
    }

    if (userProfile) {
        systemPrompt += `\n\n# ユーザー情報\n`;
        if (userProfile.displayName) systemPrompt += `- 名前: ${userProfile.displayName}\n`;
        if (userProfile.nationality) systemPrompt += `- 国籍: ${userProfile.nationality}\n`;
        if (userProfile.primaryLanguage) systemPrompt += `- 使用言語: ${userProfile.primaryLanguage}\n`;
        if (userProfile.stayLocation) systemPrompt += `- 滞在地: ${userProfile.stayLocation}\n`;
        if (userProfile.stayPurpose) systemPrompt += `- 滞在目的: ${userProfile.stayPurpose}\n`;
    }
    
    // 会話履歴の追加
    if (recentConversations && recentConversations.length > 0) {
        systemPrompt += `\n\n# 過去の相談履歴\n`;
        systemPrompt += `このユーザーとの過去の会話履歴です。文脈を理解して、継続的なサポートを提供してください：\n\n`;
        
        recentConversations.forEach((conv, index) => {
            const date = new Date(conv.timestamp.seconds * 1000).toLocaleDateString('ja-JP');
            systemPrompt += `## ${index + 1}. ${date} (${conv.category})\n`;
            systemPrompt += `**ユーザー:** ${conv.userMessage}\n`;
            systemPrompt += `**AI回答:** ${conv.aiResponse.substring(0, 200)}...\n\n`;
        });
        
        systemPrompt += `上記の履歴を踏まえ、必要に応じて「前回ご相談いただいた〜について」などの言及をして、継続性のある回答をしてください。\n`;
    }
    
    if (category) {
        systemPrompt += `\n# 現在の相談カテゴリ\n- ${category}\n`;
    }

    systemPrompt += `\n# あなたの役割と指示\n- ユーザー情報と相談カテゴリを強く意識し、パーソナライズされた回答を生成してください。\n- 愛媛県の実情に合わせた、具体的で実践的なアドバイスを心がけてください。\n- 外国人ユーザーにも分かりやすいように、専門用語を避け、丁寧な言葉遣いで説明してください。\n- 回答はMarkdown形式で、見出しやリストを活用して分かりやすく構成してください。\n- 緊急性が高いと判断した場合は、必ず警察(110)や救急(119)などの公的な連絡先を案内してください。\n- 常に親しみやすく、ユーザーに寄り添う姿勢で回答してください。`;

    // 特定地域の情報を優先する指示を追加
    if (userProfile && userProfile.stayLocation) {
        systemPrompt += `\n- 特に${userProfile.stayLocation}の情報を優先して提供してください。一般的な愛媛県情報よりも、${userProfile.stayLocation}特有の情報があれば詳しく案内してください。`;
    }

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
