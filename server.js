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

// Firebase設定を配信するエンドポイント
app.get('/api/config', (req, res) => {
    try {
        const config = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            databaseURL: process.env.FIREBASE_DATABASE_URL
        };
        
        // 必要な設定が不足している場合はエラー
        if (!config.apiKey || !config.projectId) {
            return res.status(500).json({ error: 'Firebase configuration is incomplete' });
        }
        
        res.json(config);
    } catch (error) {
        console.error('Config error:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// 翻訳エンドポイント
app.post('/api/translate', async (req, res) => {
    try {
        const { text, targetLanguage, sourceLanguage = 'ja' } = req.body;
        
        console.log(`Translation request: "${text}" from ${sourceLanguage} to ${targetLanguage}`);
        
        // 入力検証
        if (!text || !targetLanguage) {
            return res.status(400).json({ 
                error: 'Missing required parameters: text and targetLanguage' 
            });
        }
        
        // 同じ言語の場合はそのまま返す
        if (sourceLanguage === targetLanguage) {
            return res.json({ translatedText: text });
        }
        
        // Gemini API キー確認
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
        }
        
        // 言語コード変換
        const sourceName = getLanguageFullName(sourceLanguage);
        const targetName = getLanguageFullName(targetLanguage);
        
        // 翻訳APIでは簡潔な言語名を使用
        const sourceNameSimple = sourceName.replace(' (Simplified)', '');
        const targetNameSimple = targetName.replace(' (Simplified)', '');
        
        // Gemini APIで翻訳
        const translatedText = await translateWithGemini(text, sourceNameSimple, targetNameSimple);
        
        console.log(`Translation result: "${translatedText}"`);
        
        res.json({ translatedText });
        
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ 
            error: 'Translation failed',
            message: error.message 
        });
    }
});

// AI Chat endpoint - 多言語対応を強化
app.post('/api/chat', async (req, res) => {
    try {
        const { message, context, language } = req.body; // language パラメータを追加

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Invalid message' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
        }

        // 言語設定を決定（優先順位：URL言語パラメータ > プロフィール言語 > デフォルト日本語）
        let responseLanguage = 'Japanese';
        let languageCode = 'ja';
        
        if (language) {
            languageCode = language;
            responseLanguage = getLanguageFullName(language);
        } else if (context?.userProfile?.primaryLanguage) {
            const profileLang = context.userProfile.primaryLanguage;
            responseLanguage = getLanguageFromProfileSelection(profileLang);
            languageCode = getLanguageCodeFromProfileSelection(profileLang);
        }

        console.log(`Chat request - Language: ${responseLanguage} (${languageCode}), Message: ${message.substring(0, 50)}...`);

        const response = await callGeminiAPI(message.trim(), context, responseLanguage, languageCode);
        
        res.json({ success: true, response, language: languageCode });

    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Chat request failed', message: error.message });
    }
});

// プロフィール選択値から言語名への変換（修正版）
function getLanguageFromProfileSelection(profileLanguage) {
    const languageMap = {
        '日本語': 'Japanese',
        'English': 'English',
        '한국어': 'Korean', 
        '中文': 'Chinese (Simplified)',
        'Español': 'Spanish',
        'Français': 'French',
        'Deutsch': 'German',
        'Italiano': 'Italian',
        'Português': 'Portuguese',
        'Русский': 'Russian'
    };
    return languageMap[profileLanguage] || 'Japanese';
}

// プロフィール選択値から言語コードへの変換（修正版）
function getLanguageCodeFromProfileSelection(profileLanguage) {
    const languageCodeMap = {
        '日本語': 'ja',
        'English': 'en',
        '한국어': 'ko',
        '中文': 'zh',
        'Español': 'es',
        'Français': 'fr',
        'Deutsch': 'de',
        'Italiano': 'it',
        'Português': 'pt',
        'Русский': 'ru'
    };
    return languageCodeMap[profileLanguage] || 'ja';
}

// 言語コード変換（既存の関数を拡張）
function getLanguageCode(language) {
    const languageMap = {
        '日本語': 'Japanese',
        'English': 'English',
        '한국어': 'Korean', 
        '中文': 'Chinese (Simplified)',
        'Español': 'Spanish',
        'Français': 'French',
        'Deutsch': 'German',
        'Italiano': 'Italian',
        'Português': 'Portuguese',
        'Русский': 'Russian'
    };
    return languageMap[language] || 'Japanese';
}

// 言語コードから正式名称への変換（翻訳用）
function getLanguageFullName(langCode) {
    const languageNames = {
        'ja': 'Japanese',
        'en': 'English',
        'ko': 'Korean',
        'zh': 'Chinese (Simplified)',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian'
    };
    return languageNames[langCode] || 'Japanese';
}

// 翻訳専用のGemini API呼び出し関数
async function translateWithGemini(text, sourceLang, targetLang) {
    try {
        const prompt = `Translate the following ${sourceLang} text to ${targetLang}. 
Rules:
- Return ONLY the translated text
- Do not include quotes, explanations, or additional formatting
- Maintain the same tone and style as the original
- Keep the original meaning precisely
- For technical terms or proper nouns, use the most appropriate translation

Text to translate: ${text}`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1, // 翻訳なので低めに設定
                topK: 1,
                topP: 0.8,
                maxOutputTokens: 1024,
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
            throw new Error(`Translation API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            let translatedText = data.candidates[0].content.parts[0].text.trim();
            
            // 余分な引用符や説明文を除去
            translatedText = translatedText
                .replace(/^["'`]|["'`]$/g, '') // 先頭と末尾の引用符を除去
                .replace(/^Translation:\s*/i, '') // "Translation: " プレフィックスを除去
                .replace(/^Translated text:\s*/i, '') // "Translated text: " プレフィックスを除去
                .trim();
            
            return translatedText;
        } else {
            throw new Error('No valid translation response from Gemini API');
        }
        
    } catch (error) {
        console.error('Gemini translation error:', error);
        throw error;
    }
}

// Gemini API call function - 言語対応を大幅強化
async function callGeminiAPI(message, context = {}, responseLanguage = 'Japanese', languageCode = 'ja') {
    const { userProfile, category, recentConversations } = context;
    
    // 言語別のシステムプロンプトベース
    const systemPromptBase = {
        'Japanese': 'あなたは「Kotoha AI」という、愛媛県での滞在をサポートする非常に親切で有能なAIアシスタントです。',
        'English': 'You are "Kotoha AI", a very helpful and capable AI assistant that supports stays in Ehime Prefecture.',
        'Korean': '당신은 에히메현에서의 체류를 지원하는 매우 친절하고 유능한 AI 어시스턴트인 "Kotoha AI"입니다.',
        'Chinese (Simplified)': '您是"Kotoha AI"，一个为在爱媛县逗留提供支持的非常友好且能干的AI助手。',
        'Spanish': 'Eres "Kotoha AI", un asistente de IA muy útil y capaz que ayuda con las estancias en la Prefectura de Ehime.',
        'French': 'Vous êtes "Kotoha AI", un assistant IA très utile et compétent qui aide pour les séjours dans la préfecture d\'Ehime.',
        'German': 'Sie sind "Kotoha AI", ein sehr hilfreicher und fähiger KI-Assistent, der Aufenthalte in der Präfektur Ehime unterstützt.',
        'Italian': 'Sei "Kotoha AI", un assistente IA molto utile e capace che supporta i soggiorni nella Prefettura di Ehime.',
        'Portuguese': 'Você é "Kotoha AI", um assistente de IA muito útil e capaz que apoia estadias na Prefeitura de Ehime.',
        'Russian': 'Вы - "Kotoha AI", очень полезный и способный ИИ-помощник, который поддерживает пребывание в префектуре Эхимэ.'
    };

    let systemPrompt = systemPromptBase[responseLanguage] || systemPromptBase['Japanese'];

    // 重要: 必ず指定言語で回答するよう強く指示
    const languageInstructions = {
        'Japanese': '',
        'English': '\n\n# CRITICAL LANGUAGE INSTRUCTION\n**You MUST respond ONLY in English. Even if the question is asked in Japanese or any other language, your response must be entirely in English.**',
        'Korean': '\n\n# 중요한 언어 지시사항\n**반드시 한국어로만 응답해야 합니다. 질문이 일본어나 다른 언어로 작성되어 있어도, 답변은 전적으로 한국어로 통일해 주세요.**',
        'Chinese (Simplified)': '\n\n# 重要语言指示\n**您必须仅用中文回答。即使问题是用日语或其他语言提出的，您的回答也必须完全使用中文。**',
        'Spanish': '\n\n# INSTRUCCIÓN CRÍTICA DE IDIOMA\n**DEBE responder ÚNICAMENTE en español. Incluso si la pregunta se hace en japonés u otro idioma, su respuesta debe ser completamente en español.**',
        'French': '\n\n# INSTRUCTION LINGUISTIQUE CRITIQUE\n**Vous DEVEZ répondre UNIQUEMENT en français. Même si la question est posée en japonais ou dans une autre langue, votre réponse doit être entièrement en français.**',
        'German': '\n\n# KRITISCHE SPRACHANWEISUNG\n**Sie MÜSSEN NUR auf Deutsch antworten. Auch wenn die Frage auf Japanisch oder in einer anderen Sprache gestellt wird, muss Ihre Antwort vollständig auf Deutsch sein.**',
        'Italian': '\n\n# ISTRUZIONE LINGUISTICA CRITICA\n**DEVI rispondere SOLO in italiano. Anche se la domanda è posta in giapponese o in un\'altra lingua, la tua risposta deve essere interamente in italiano.**',
        'Portuguese': '\n\n# INSTRUÇÃO CRÍTICA DE IDIOMA\n**Você DEVE responder APENAS em português. Mesmo que a pergunta seja feita em japonês ou outro idioma, sua resposta deve ser totalmente em português.**',
        'Russian': '\n\n# КРИТИЧЕСКАЯ ЯЗЫКОВАЯ ИНСТРУКЦИЯ\n**Вы ДОЛЖНЫ отвечать ТОЛЬКО на русском языке. Даже если вопрос задан на японском или другом языке, ваш ответ должен быть полностью на русском языке.**'
    };

    systemPrompt += languageInstructions[responseLanguage] || '';

    if (userProfile) {
        const userInfoHeaders = {
            'Japanese': '\n\n# ユーザー情報',
            'English': '\n\n# User Information',
            'Korean': '\n\n# 사용자 정보',
            'Chinese (Simplified)': '\n\n# 用户信息',
            'Spanish': '\n\n# Información del Usuario',
            'French': '\n\n# Informations Utilisateur',
            'German': '\n\n# Benutzerinformationen',
            'Italian': '\n\n# Informazioni Utente',
            'Portuguese': '\n\n# Informações do Usuário',
            'Russian': '\n\n# Информация о пользователе'
        };

        systemPrompt += userInfoHeaders[responseLanguage] || userInfoHeaders['Japanese'];
        systemPrompt += `\n`;
        if (userProfile.displayName) systemPrompt += `- Name: ${userProfile.displayName}\n`;
        if (userProfile.nationality) systemPrompt += `- Nationality: ${userProfile.nationality}\n`;
        if (userProfile.primaryLanguage) systemPrompt += `- Language: ${userProfile.primaryLanguage}\n`;
        if (userProfile.stayLocation) systemPrompt += `- Location: ${userProfile.stayLocation}\n`;
        if (userProfile.stayPurpose) systemPrompt += `- Purpose: ${userProfile.stayPurpose}\n`;
    }
    
    // 会話履歴の追加
    if (recentConversations && recentConversations.length > 0) {
        const historyHeaders = {
            'Japanese': '\n\n# 過去の相談履歴\nこのユーザーとの過去の会話履歴です。文脈を理解して、継続的なサポートを提供してください：',
            'English': '\n\n# Previous Consultation History\nHere is the conversation history with this user. Please understand the context and provide continuous support:',
            'Korean': '\n\n# 이전 상담 기록\n이 사용자와의 과거 대화 기록입니다. 맥락을 이해하고 지속적인 지원을 제공해 주세요:',
            'Chinese (Simplified)': '\n\n# 以往咨询历史\n这是与该用户的过往对话记录。请理解上下文并提供持续支持：',
            'Spanish': '\n\n# Historial de Consultas Previas\nEste es el historial de conversación con este usuario. Por favor comprenda el contexto y proporcione apoyo continuo:',
            'French': '\n\n# Historique des Consultations Précédentes\nVoici l\'historique de conversation avec cet utilisateur. Veuillez comprendre le contexte et fournir un soutien continu:',
            'German': '\n\n# Vorherige Beratungshistorie\nHier ist die Gesprächshistorie mit diesem Benutzer. Bitte verstehen Sie den Kontext und bieten Sie kontinuierliche Unterstützung:',
            'Italian': '\n\n# Storico delle Consultazioni Precedenti\nQuesta è la cronologia delle conversazioni con questo utente. Si prega di comprendere il contesto e fornire supporto continuo:',
            'Portuguese': '\n\n# Histórico de Consultas Anteriores\nEste é o histórico de conversas com este usuário. Compreenda o contexto e forneça suporte contínuo:',
            'Russian': '\n\n# История предыдущих консультаций\nВот история разговоров с этим пользователем. Пожалуйста, поймите контекст и обеспечьте непрерывную поддержку:'
        };

        systemPrompt += historyHeaders[responseLanguage] || historyHeaders['Japanese'];
        systemPrompt += `\n\n`;
        
        recentConversations.forEach((conv, index) => {
            const date = new Date(conv.timestamp.seconds * 1000).toLocaleDateString();
            systemPrompt += `## ${index + 1}. ${date} (${conv.category})\n`;
            systemPrompt += `**User:** ${conv.userMessage}\n`;
            systemPrompt += `**AI:** ${conv.aiResponse.substring(0, 200)}...\n\n`;
        });
    }
    
    if (category) {
        const categoryHeaders = {
            'Japanese': '\n# 現在の相談カテゴリ',
            'English': '\n# Current Consultation Category',
            'Korean': '\n# 현재 상담 카테고리',
            'Chinese (Simplified)': '\n# 当前咨询类别',
            'Spanish': '\n# Categoría de Consulta Actual',
            'French': '\n# Catégorie de Consultation Actuelle',
            'German': '\n# Aktuelle Beratungskategorie',
            'Italian': '\n# Categoria di Consultazione Attuale',
            'Portuguese': '\n# Categoria de Consulta Atual',
            'Russian': '\n# Текущая категория консультации'
        };

        systemPrompt += categoryHeaders[responseLanguage] || categoryHeaders['Japanese'];
        systemPrompt += `\n- ${category}\n`;
    }

    // 役割と指示を言語別に追加
    const roleInstructions = {
        'Japanese': '\n# あなたの役割と指示\n- ユーザー情報と相談カテゴリを強く意識し、パーソナライズされた回答を生成してください。\n- 愛媛県の実情に合わせた、具体的で実践的なアドバイスを心がけてください。\n- 外国人ユーザーにも分かりやすいように、専門用語を避け、丁寧な言葉遣いで説明してください。\n- 回答はMarkdown形式で、見出しやリストを活用して分かりやすく構成してください。\n- 緊急性が高いと判断した場合は、必ず警察(110)や救急(119)などの公的な連絡先を案内してください。\n- 常に親しみやすく、ユーザーに寄り添う姿勢で回答してください。',
        'English': '\n# Your Role and Instructions\n- Strongly consider user information and consultation categories to generate personalized responses.\n- Provide specific and practical advice tailored to the actual situation in Ehime Prefecture.\n- Explain clearly for foreign users, avoiding technical terms and using polite language.\n- Structure your responses in Markdown format using headings and lists for clarity.\n- If you determine high urgency, always provide official contact information such as police (110) or emergency services (119).\n- Always maintain a friendly and supportive attitude toward users.',
        'Korean': '\n# 당신의 역할과 지시사항\n- 사용자 정보와 상담 카테고리를 강하게 의식하여 개인화된 답변을 생성해 주세요.\n- 에히메현의 실정에 맞는 구체적이고 실용적인 조언을 제공해 주세요.\n- 외국인 사용자도 이해하기 쉽도록 전문용어를 피하고 정중한 언어로 설명해 주세요.\n- 답변은 마크다운 형식으로, 제목과 목록을 활용하여 이해하기 쉽게 구성해 주세요.\n- 긴급성이 높다고 판단되는 경우, 반드시 경찰(110)이나 응급서비스(119) 등의 공적 연락처를 안내해 주세요.\n- 항상 친근하고 사용자에게 다가가는 자세로 답변해 주세요.',
        'Chinese (Simplified)': '\n# 您的角色和指示\n- 强烈关注用户信息和咨询类别，生成个性化的回答。\n- 提供符合爱媛县实际情况的具体实用建议。\n- 为了让外国用户也能理解，请避免专业术语，使用礼貌的语言进行说明。\n- 答案采用Markdown格式，利用标题和列表使其易于理解。\n- 如果判断紧急性较高，务必提供警察(110)或急救(119)等公共联系方式。\n- 始终保持亲切友好、贴近用户的态度回答。',
        'Spanish': '\n# Su Rol e Instrucciones\n- Considere fuertemente la información del usuario y las categorías de consulta para generar respuestas personalizadas.\n- Proporcione consejos específicos y prácticos adaptados a la situación real en la Prefectura de Ehime.\n- Explique claramente para usuarios extranjeros, evitando términos técnicos y usando lenguaje cortés.\n- Estructure sus respuestas en formato Markdown usando encabezados y listas para mayor claridad.\n- Si determina alta urgencia, siempre proporcione información de contacto oficial como policía (110) o servicios de emergencia (119).\n- Siempre mantenga una actitud amigable y de apoyo hacia los usuarios.',
        'French': '\n# Votre Rôle et Instructions\n- Considérez fortement les informations utilisateur et les catégories de consultation pour générer des réponses personnalisées.\n- Fournissez des conseils spécifiques et pratiques adaptés à la situation réelle dans la préfecture d\'Ehime.\n- Expliquez clairement pour les utilisateurs étrangers, en évitant les termes techniques et en utilisant un langage poli.\n- Structurez vos réponses en format Markdown en utilisant des titres et des listes pour plus de clarté.\n- Si vous déterminez une haute urgence, fournissez toujours les informations de contact officielles comme la police (110) ou les services d\'urgence (119).\n- Maintenez toujours une attitude amicale et soutenante envers les utilisateurs.',
        'German': '\n# Ihre Rolle und Anweisungen\n- Berücksichtigen Sie stark die Benutzerinformationen und Beratungskategorien, um personalisierte Antworten zu generieren.\n- Bieten Sie spezifische und praktische Ratschläge, die an die tatsächliche Situation in der Präfektur Ehime angepasst sind.\n- Erklären Sie klar für ausländische Benutzer, vermeiden Sie Fachbegriffe und verwenden Sie höfliche Sprache.\n- Strukturieren Sie Ihre Antworten im Markdown-Format mit Überschriften und Listen für Klarheit.\n- Wenn Sie hohe Dringlichkeit feststellen, geben Sie immer offizielle Kontaktinformationen wie Polizei (110) oder Notdienste (119) an.\n- Behalten Sie immer eine freundliche und unterstützende Haltung gegenüber den Benutzern bei.',
        'Italian': '\n# Il Suo Ruolo e Istruzioni\n- Consideri fortemente le informazioni dell\'utente e le categorie di consultazione per generare risposte personalizzate.\n- Fornisca consigli specifici e pratici adattati alla situazione reale nella Prefettura di Ehime.\n- Spieghi chiaramente per gli utenti stranieri, evitando termini tecnici e usando un linguaggio cortese.\n- Strutturi le sue risposte in formato Markdown usando intestazioni e elenchi per chiarezza.\n- Se determina alta urgenza, fornisca sempre informazioni di contatto ufficiali come polizia (110) o servizi di emergenza (119).\n- Mantenga sempre un atteggiamento amichevole e di supporto verso gli utenti.',
        'Portuguese': '\n# Seu Papel e Instruções\n- Considere fortemente as informações do usuário e categorias de consulta para gerar respostas personalizadas.\n- Forneça conselhos específicos e práticos adaptados à situação real na Prefeitura de Ehime.\n- Explique claramente para usuários estrangeiros, evitando termos técnicos e usando linguagem cortês.\n- Estruture suas respostas em formato Markdown usando cabeçalhos e listas para clareza.\n- Se determinar alta urgência, sempre forneça informações de contato oficiais como polícia (110) ou serviços de emergência (119).\n- Sempre mantenha uma atitude amigável e de apoio em relação aos usuários.',
        'Russian': '\n# Ваша роль и инструкции\n- Сильно учитывайте информацию о пользователе и категории консультации для создания персонализированных ответов.\n- Предоставляйте конкретные и практические советы, адаптированные к реальной ситуации в префектуре Эхимэ.\n- Объясняйте ясно для иностранных пользователей, избегая технических терминов и используя вежливый язык.\n- Структурируйте свои ответы в формате Markdown, используя заголовки и списки для ясности.\n- Если вы определите высокую срочность, всегда предоставляйте официальную контактную информацию, такую как полиция (110) или службы экстренного реагирования (119).\n- Всегда поддерживайте дружелюбное и поддерживающее отношение к пользователям.'
    };

    systemPrompt += roleInstructions[responseLanguage] || roleInstructions['Japanese'];

    // 特定地域の情報を優先する指示を追加
    if (userProfile && userProfile.stayLocation) {
        const locationHeaders = {
            'Japanese': `\n- 特に${userProfile.stayLocation}の情報を優先して提供してください。一般的な愛媛県情報よりも、${userProfile.stayLocation}特有の情報があれば詳しく案内してください。`,
            'English': `\n- Please prioritize information about ${userProfile.stayLocation}. If there is specific information unique to ${userProfile.stayLocation} rather than general Ehime Prefecture information, please provide detailed guidance.`,
            'Korean': `\n- 특히 ${userProfile.stayLocation}의 정보를 우선적으로 제공해 주세요. 일반적인 에히메현 정보보다 ${userProfile.stayLocation} 특유의 정보가 있다면 자세히 안내해 주세요.`,
            'Chinese (Simplified)': `\n- 请优先提供${userProfile.stayLocation}的信息。如果有比一般爱媛县信息更具体的${userProfile.stayLocation}特有信息，请详细介绍。`,
            'Spanish': `\n- Por favor priorice la información sobre ${userProfile.stayLocation}. Si hay información específica única de ${userProfile.stayLocation} en lugar de información general de la Prefectura de Ehime, proporcione orientación detallada.`,
            'French': `\n- Veuillez prioriser les informations sur ${userProfile.stayLocation}. S'il y a des informations spécifiques uniques à ${userProfile.stayLocation} plutôt que des informations générales sur la préfecture d'Ehime, veuillez fournir des conseils détaillés.`,
            'German': `\n- Bitte priorisieren Sie Informationen über ${userProfile.stayLocation}. Wenn es spezifische Informationen gibt, die einzigartig für ${userProfile.stayLocation} sind, anstatt allgemeine Informationen über die Präfektur Ehime, geben Sie bitte detaillierte Anleitungen.`,
            'Italian': `\n- Si prega di dare priorità alle informazioni su ${userProfile.stayLocation}. Se ci sono informazioni specifiche uniche per ${userProfile.stayLocation} piuttosto che informazioni generali sulla Prefettura di Ehime, fornisca una guida dettagliata.`,
            'Portuguese': `\n- Por favor, priorize informações sobre ${userProfile.stayLocation}. Se há informações específicas únicas para ${userProfile.stayLocation} em vez de informações gerais da Prefeitura de Ehime, forneça orientação detalhada.`,
            'Russian': `\n- Пожалуйста, приоритизируйте информацию о ${userProfile.stayLocation}. Если есть специфическая информация, уникальная для ${userProfile.stayLocation}, а не общая информация о префектуре Эхимэ, предоставьте подробное руководство.`
        };

        systemPrompt += locationHeaders[responseLanguage] || locationHeaders['Japanese'];
    }

    // 質問セクションのヘッダーを言語別に
    const questionHeaders = {
        'Japanese': '\n\n# ユーザーからの質問\n',
        'English': '\n\n# User Question\n',
        'Korean': '\n\n# 사용자 질문\n',
        'Chinese (Simplified)': '\n\n# 用户问题\n',
        'Spanish': '\n\n# Pregunta del Usuario\n',
        'French': '\n\n# Question de l\'Utilisateur\n',
        'German': '\n\n# Benutzerfrage\n',
        'Italian': '\n\n# Domanda dell\'Utente\n',
        'Portuguese': '\n\n# Pergunta do Usuário\n',
        'Russian': '\n\n# Вопрос пользователя\n'
    };

    const finalPrompt = systemPrompt + (questionHeaders[responseLanguage] || questionHeaders['Japanese']) + message;

    console.log(`Gemini API call - Language: ${responseLanguage}, Prompt length: ${finalPrompt.length}`);

    const requestBody = {
        contents: [{ parts: [{ text: finalPrompt }] }],
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
        const aiResponse = data.candidates[0].content.parts[0].text;
        console.log(`Gemini response length: ${aiResponse.length}, first 100 chars: ${aiResponse.substring(0, 100)}`);
        return aiResponse;
    } else {
        // フォールバック応答も言語別に
        const fallbackResponses = {
            'Japanese': '申し訳ありません、その質問にはお答えできません。別の質問を試してみてください。',
            'English': 'I apologize, but I cannot answer that question. Please try a different question.',
            'Korean': '죄송합니다. 그 질문에는 답할 수 없습니다. 다른 질문을 시도해 보세요.',
            'Chinese (Simplified)': '抱歉，我无法回答这个问题。请尝试其他问题。',
            'Spanish': 'Lo siento, no puedo responder esa pregunta. Por favor, intente con otra pregunta.',
            'French': 'Je m\'excuse, mais je ne peux pas répondre à cette question. Veuillez essayer une autre question.',
            'German': 'Es tut mir leid, aber ich kann diese Frage nicht beantworten. Bitte versuchen Sie eine andere Frage.',
            'Italian': 'Mi scuso, ma non posso rispondere a quella domanda. Si prega di provare un\'altra domanda.',
            'Portuguese': 'Peço desculpas, mas não posso responder essa pergunta. Por favor, tente outra pergunta.',
            'Russian': 'Извините, но я не могу ответить на этот вопрос. Пожалуйста, попробуйте другой вопрос.'
        };

        return fallbackResponses[responseLanguage] || fallbackResponses['Japanese'];
    }
}

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        geminiApi: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
        firebaseConfig: process.env.FIREBASE_API_KEY ? 'configured' : 'missing'
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
