// Firebase v10.12.2 本番版 app.js - セキュア版 (最適化) - 多言語対応強化

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Firebase Configuration - サーバーから取得 ---
let app, auth, db;

// Firebase設定をサーバーから取得して初期化
async function initializeFirebase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error('Failed to get Firebase configuration');
    }
    
    const firebaseConfig = await response.json();
    
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log('Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    showMessage('設定の読み込みに失敗しました。ページを再読み込みしてください。', 'error');
    return false;
  }
}

let currentUser = null;
let currentSection = 1;
let selectedCategory = '';
let shouldStoreConsultation = true;
let isAIChatting = false;
let currentLanguage = 'ja'; // デフォルトは日本語
let translationCache = {}; // 翻訳キャッシュ

// グローバル関数として定義
function selectCategory(categoryValue) {
  console.log('Selecting category:', categoryValue);
  selectedCategory = categoryValue;
  
  const selectedCategoryBox = document.getElementById('selected-category');
  const selectedCategoryName = document.getElementById('selected-category-name');
  
  if (selectedCategoryBox) {
    selectedCategoryBox.style.display = 'block';
  }
  
  // カテゴリカードを視覚的に選択状態にする
  document.querySelectorAll('.category-card').forEach(card => {
    card.classList.remove('selected', 'active');
    if (card.getAttribute('data-category') === categoryValue) {
      card.classList.add('selected', 'active');
      
      if (selectedCategoryName) {
        // 動的翻訳でカテゴリー名を設定
        updateCategoryName(categoryValue, selectedCategoryName);
      }
    }
  });
  
  // 選択されたカテゴリーに応じてよくある質問を更新
  updateFAQQuestions(categoryValue);
  
  updateSendButton();
}

// カテゴリー名を動的翻訳で更新
async function updateCategoryName(categoryValue, element) {
  const categoryNamesJa = {
    transportation: '交通・移動',
    medical: '医療・健康',
    connectivity: 'ネット・通信',
    accommodation: '住居・宿泊',
    culture: '文化・マナー',
    general: '一般相談'
  };
  
  const jaName = categoryNamesJa[categoryValue] || categoryValue;
  
  if (currentLanguage === 'ja') {
    element.textContent = jaName;
  } else {
    const translatedName = await translateText(jaName, currentLanguage);
    element.textContent = translatedName;
  }
}

function updateSendButton() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  
  const inputValue = chatInput ? chatInput.value.trim() : '';
  const hasInput = inputValue.length > 0;
  
  // カテゴリが選択されていない場合は、入力内容から推測
  if (hasInput && !selectedCategory) {
    const guessedCategory = guessCategory(inputValue);
    selectCategory(guessedCategory);
  }
  
  const hasCategory = selectedCategory.length > 0;

  if (sendButton) {
    const shouldEnable = hasInput && hasCategory && !isAIChatting;
    sendButton.disabled = !shouldEnable;
    
    // 送信ボタンの見た目を改善
    if (shouldEnable) {
      sendButton.style.opacity = '1';
      sendButton.style.cursor = 'pointer';
    } else {
      sendButton.style.opacity = '0.5';
      sendButton.style.cursor = 'not-allowed';
    }
  }
}

// コンパクトな静的翻訳（UI要素のみ）
const translations = {
  ja: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: '愛媛県での滞在をサポートするAIアシスタント',
    welcomeTitle: 'ようこそ Kotoha AI へ',
    welcomeDesc: '愛媛県での滞在をより快適にするため、まずはアカウントを作成しましょう',
    loginTitle: 'ログイン',
    signupTitle: 'アカウント作成',
    email: 'メールアドレス',
    password: 'パスワード',
    passwordConfirm: 'パスワード確認',
    loginBtn: 'ログイン',
    signupBtn: 'アカウント作成',
    googleLoginBtn: 'Googleでログイン',
    guestLoginBtn: 'ゲストとして利用',
    showSignupBtn: 'アカウント作成',
    showLoginBtn: 'ログインに戻る',
    profileTitle: 'プロフィール設定',
    profileDesc: 'より適切なサポートを提供するため、基本情報を教えてください',
    displayName: '表示名',
    nationality: '国籍',
    primaryLanguage: '使用する言語',
    stayLocation: '滞在地域',
    stayPurpose: '滞在目的',
    stayPeriod: '滞在期間',
    saveProfileBtn: 'プロフィール保存',
    consultationTitle: 'AI相談',
    consultationDesc: 'カテゴリを選択して、気軽にご質問ください',
    categoryTitle: '相談カテゴリ',
    frequentlyAskedQuestions: 'よくある質問',
    historyTitle: '相談履歴',
    historyDesc: '過去の相談内容を確認できます',
    backToConsultation: '相談に戻る',
    exportHistory: '履歴をエクスポート',
    noHistory: 'まだ相談履歴はありません。',
    logout: 'ログアウト',
    select: '選択してください'
  },
  en: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'AI Assistant for Your Stay in Ehime Prefecture',
    welcomeTitle: 'Welcome to Kotoha AI',
    welcomeDesc: 'Create an account to make your stay in Ehime Prefecture more comfortable',
    loginTitle: 'Sign In',
    signupTitle: 'Create Account',
    email: 'Email',
    password: 'Password',
    passwordConfirm: 'Confirm Password',
    loginBtn: 'Sign In',
    signupBtn: 'Create Account',
    googleLoginBtn: 'Sign in with Google',
    guestLoginBtn: 'Use as Guest',
    showSignupBtn: 'Create Account',
    showLoginBtn: 'Back to Login',
    profileTitle: 'Profile Setup',
    profileDesc: 'Please provide your basic information for better support',
    displayName: 'Display Name',
    nationality: 'Nationality',
    primaryLanguage: 'Primary Language',
    stayLocation: 'Stay Location',
    stayPurpose: 'Purpose',
    stayPeriod: 'Stay Period',
    saveProfileBtn: 'Save Profile',
    consultationTitle: 'AI Consultation',
    consultationDesc: 'Select a category and feel free to ask questions',
    categoryTitle: 'Category',
    frequentlyAskedQuestions: 'Frequently Asked Questions',
    historyTitle: 'Consultation History',
    historyDesc: 'View your past consultation records',
    backToConsultation: 'Back to Consultation',
    exportHistory: 'Export History',
    noHistory: 'No consultation history yet.',
    logout: 'Logout',
    select: 'Select'
  }
};

// よくある質問（日本語版のみ - 他言語は動的翻訳）
const faqQuestionsJa = {
  transportation: [
    'バスの乗り方は？',
    '電車の乗り換え方法は？',
    'ICカードはどこで買える？',
    'タクシーの呼び方は？',
    '松山空港からのアクセスは？'
  ],
  medical: [
    '病院の予約は必要？',
    '保険証は使える？',
    '薬局はどこにある？',
    '救急病院はどこ？',
    '英語対応の病院は？'
  ],
  connectivity: [
    'Wi-Fi利用場所は？',
    'SIMカードはどこで買える？',
    'インターネットカフェは？',
    'データプランのおすすめは？',
    '通信速度が遅い時は？'
  ],
  accommodation: [
    'ホテルの予約方法は？',
    '民泊の利用方法は？',
    '長期滞在向けの住居は？',
    'チェックイン時間は？',
    '宿泊税はかかる？'
  ],
  culture: [
    '日本のマナーは？',
    'お辞儀の仕方は？',
    '靴を脱ぐ場所は？',
    '食事のマナーは？',
    '温泉の入り方は？'
  ],
  general: [
    '緊急時の連絡先は？',
    '観光スポットのおすすめは？',
    '愛媛の名物は？',
    '銀行の営業時間は？',
    '天気予報の確認方法は？'
  ]
};

// 翻訳関数（Gemini API使用）
async function translateText(text, targetLanguage) {
  // 日本語の場合はそのまま返す
  if (targetLanguage === 'ja') {
    return text;
  }
  
  // キャッシュをチェック
  const cacheKey = `${text}_${targetLanguage}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }
  
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        targetLanguage: targetLanguage,
        sourceLanguage: 'ja'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const translatedText = data.translatedText || text;
      
      // キャッシュに保存
      translationCache[cacheKey] = translatedText;
      return translatedText;
    } else {
      console.warn(`Translation API error: ${response.status}`);
    }
  } catch (error) {
    console.warn('Translation API failed:', error);
  }
  
  // 翻訳に失敗した場合は元のテキストを返す
  translationCache[cacheKey] = text;
  return text;
}

// 言語切り替え関数（強化版）
function switchLanguage(langCode) {
  console.log('Switching language to:', langCode);
  const previousLanguage = currentLanguage;
  currentLanguage = langCode;
  
  // ヘッダーボタンの状態更新
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const langBtn = document.getElementById(`lang-${langCode}`);
  if (langBtn) {
    langBtn.classList.add('active');
  }
  
  // 複数回更新で確実に反映
  setTimeout(async () => {
    console.log('Language switch: First update');
    updatePageTexts();
    await updateFAQQuestions(selectedCategory);
  }, 50);
  
  setTimeout(async () => {
    console.log('Language switch: Second update');
    await updateChatWelcomeMessage();
  }, 200);
  
  setTimeout(async () => {
    console.log('Language switch: Final update');
    updatePageTexts();
    await updateFAQQuestions(selectedCategory);
    await updateChatWelcomeMessage();
  }, 500);
  
  console.log('Language switched from', previousLanguage, 'to', currentLanguage);
}

// ページテキスト更新関数（静的翻訳部分のみ）
function updatePageTexts() {
  const t = translations[currentLanguage] || translations['ja'];
  
  // ヘッダー
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) subtitle.textContent = t.headerSubtitle;
  
  // 認証画面
  const welcomeTitle = document.querySelector('#section-1 h2');
  if (welcomeTitle) welcomeTitle.textContent = t.welcomeTitle;
  
  const welcomeDesc = document.querySelector('#section-1 .section-header p');
  if (welcomeDesc) welcomeDesc.textContent = t.welcomeDesc;
  
  // ログインフォーム
  const loginFormTitle = document.querySelector('#login-form h3');
  if (loginFormTitle) loginFormTitle.textContent = t.loginTitle;
  
  const emailLabel1 = document.querySelector('label[for="login-email"]');
  if (emailLabel1) emailLabel1.textContent = t.email;
  
  const passwordLabel1 = document.querySelector('label[for="login-password"]');
  if (passwordLabel1) passwordLabel1.textContent = t.password;
  
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.textContent = t.loginBtn;
  
  const showSignupBtn = document.getElementById('show-signup-btn');
  if (showSignupBtn) showSignupBtn.textContent = t.showSignupBtn;
  
  const googleBtn = document.querySelector('#google-login-btn span');
  if (googleBtn) googleBtn.textContent = t.googleLoginBtn;
  
  const guestBtn = document.getElementById('guest-login-btn');
  if (guestBtn) guestBtn.textContent = t.guestLoginBtn;
  
  // サインアップフォーム
  const signupFormTitle = document.querySelector('#signup-form h3');
  if (signupFormTitle) signupFormTitle.textContent = t.signupTitle;
  
  const emailLabel2 = document.querySelector('label[for="signup-email"]');
  if (emailLabel2) emailLabel2.textContent = t.email;
  
  const passwordLabel2 = document.querySelector('label[for="signup-password"]');
  if (passwordLabel2) passwordLabel2.textContent = t.password;
  
  const passwordConfirmLabel = document.querySelector('label[for="signup-password-confirm"]');
  if (passwordConfirmLabel) passwordConfirmLabel.textContent = t.passwordConfirm;
  
  const signupBtn = document.getElementById('signup-btn');
  if (signupBtn) signupBtn.textContent = t.signupBtn;
  
  const showLoginBtn = document.getElementById('show-login-btn');
  if (showLoginBtn) showLoginBtn.textContent = t.showLoginBtn;
  
  // プロフィール画面
  const profileTitle = document.querySelector('#section-2 h2');
  if (profileTitle) profileTitle.textContent = t.profileTitle;
  
  const profileDesc = document.querySelector('#section-2 .section-header p');
  if (profileDesc) profileDesc.textContent = t.profileDesc;
  
  const displayNameLabel = document.querySelector('label[for="display-name"]');
  if (displayNameLabel) displayNameLabel.textContent = t.displayName;
  
  const nationalityLabel = document.querySelector('label[for="nationality"]');
  if (nationalityLabel) nationalityLabel.textContent = t.nationality;
  
  const languageLabel = document.querySelector('label[for="primary-language"]');
  if (languageLabel) languageLabel.textContent = t.primaryLanguage;
  
  const locationLabel = document.querySelector('label[for="stay-location"]');
  if (locationLabel) locationLabel.textContent = t.stayLocation;
  
  const purposeLabel = document.querySelector('label[for="stay-purpose"]');
  if (purposeLabel) purposeLabel.textContent = t.stayPurpose;
  
  const periodLabel = document.querySelector('label[for="stay-period"]');
  if (periodLabel) periodLabel.textContent = t.stayPeriod;
  
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) saveBtn.textContent = t.saveProfileBtn;
  
  // 相談画面
  const consultationTitle = document.querySelector('#section-3 h2');
  if (consultationTitle) consultationTitle.textContent = t.consultationTitle;
  
  const consultationDesc = document.querySelector('#section-3 .section-header p');
  if (consultationDesc) consultationDesc.textContent = t.consultationDesc;
  
  const categoryTitle = document.querySelector('.category-selector h3');
  if (categoryTitle) categoryTitle.textContent = t.categoryTitle;
  
  // 履歴画面
  const historyTitle = document.querySelector('#section-4 h2');
  if (historyTitle) historyTitle.textContent = t.historyTitle;
  
  const historyDesc = document.querySelector('#section-4 .section-header p');
  if (historyDesc) historyDesc.textContent = t.historyDesc;
  
  // 履歴画面のボタン
  const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
  if (backToConsultationBtn) backToConsultationBtn.textContent = t.backToConsultation;
  
  const exportHistoryBtn = document.getElementById('export-history-btn');
  if (exportHistoryBtn) exportHistoryBtn.textContent = t.exportHistory;
  
  // ログアウトボタン
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.textContent = t.logout;
  
  // よくある質問タイトル
  const faqTitle = document.querySelector('.frequently-asked-questions h3');
  if (faqTitle) faqTitle.textContent = `💡 ${t.frequentlyAskedQuestions}`;
  
  // セレクトボックスのデフォルトオプション
  document.querySelectorAll('select option[value=""]').forEach(option => {
    option.textContent = t.select;
  });
  
  // 履歴画面が表示されている場合は再読み込み
  if (currentSection === 4) {
    setTimeout(loadConsultationHistory, 100);
  }
}

// よくある質問更新関数（動的翻訳対応）
async function updateFAQQuestions(category = null) {
  console.log('=== updateFAQQuestions called ===');
  console.log('Category:', category);
  console.log('Current language:', currentLanguage);
  
  const questionContainer = document.querySelector('.frequently-asked-questions .question-chips') || 
                          document.querySelector('.question-chips');
  
  if (!questionContainer) {
    console.error('No question container found!');
    return;
  }
  
  let questionsToShow = [];
  
  if (category && faqQuestionsJa[category]) {
    questionsToShow = faqQuestionsJa[category];
  } else {
    const categories = ['transportation', 'medical', 'connectivity', 'culture', 'general'];
    questionsToShow = categories.map(cat => 
      faqQuestionsJa[cat] ? faqQuestionsJa[cat][0] : ''
    ).filter(q => q);
  }
  
  console.log('Questions to show (Japanese):', questionsToShow);
  questionContainer.innerHTML = '';
  
  // 各質問を翻訳して表示
  for (const questionJa of questionsToShow) {
    const questionTranslated = currentLanguage === 'ja' ? 
      questionJa : await translateText(questionJa, currentLanguage);
    
    const chip = document.createElement('button');
    chip.className = 'question-chip';
    chip.textContent = questionTranslated;
    chip.setAttribute('data-question', questionJa); // 元の日本語版を保存
    
    chip.addEventListener('click', () => {
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = questionTranslated;
        const relatedCategory = guessCategory(questionJa);
        if (relatedCategory) {
          selectCategory(relatedCategory);
        }
        updateSendButton();
        chatInput.focus();
      }
    });
    
    questionContainer.appendChild(chip);
  }
  
  console.log('FAQ update completed');
}

// チャット初期メッセージ表示関数
async function initializeChatWithWelcomeMessage() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const welcomeMessageJa = 'こんにちは！Kotoha AIです。愛媛県での滞在に関するご質問に、なんでもお答えします。<br>上記のサンプル質問をクリックするか、直接ご質問を入力してください。';
  
  const welcomeMessage = currentLanguage === 'ja' ? 
    welcomeMessageJa : await translateText(welcomeMessageJa.replace(/<br>/g, '\n'), currentLanguage);
  
  const formattedMessage = welcomeMessage.replace(/\n/g, '<br>');
  
  chatMessages.innerHTML = `
    <div class="message ai-message">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="message-bubble">
                ${formattedMessage}
            </div>
            <div class="message-time">Kotoha AI</div>
        </div>
    </div>
  `;
  
  // スクロールを調整
  setTimeout(() => {
    scrollToBottom();
  }, 100);
}

// チャット初期メッセージ更新関数
async function updateChatWelcomeMessage() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  // 既存の初期メッセージを探して更新
  const existingWelcome = chatMessages.querySelector('.ai-message .message-bubble');
  if (existingWelcome && existingWelcome.innerHTML.includes('Kotoha AI')) {
    const welcomeMessageJa = 'こんにちは！Kotoha AIです。愛媛県での滞在に関するご質問に、なんでもお答えします。上記のサンプル質問をクリックするか、直接ご質問を入力してください。';
    
    const welcomeMessage = currentLanguage === 'ja' ? 
      welcomeMessageJa : await translateText(welcomeMessageJa, currentLanguage);
    
    const formattedMessage = welcomeMessage.replace(/\n/g, '<br>');
    existingWelcome.innerHTML = formattedMessage;
  }
}

// 質問からカテゴリを推測する関数（多言語対応強化）
function guessCategory(userMessage) {
  const message = userMessage.toLowerCase();
  
  // 交通関連キーワード（多言語）
  if (message.includes('バス') || message.includes('電車') || message.includes('交通') || 
      message.includes('移動') || message.includes('タクシー') || message.includes('アクセス') ||
      message.includes('train') || message.includes('bus') || message.includes('transport') ||
      message.includes('airport') || message.includes('station')) {
    return 'transportation';
  }
  
  // 医療関連キーワード（多言語）
  if (message.includes('病院') || message.includes('医療') || message.includes('薬') || 
      message.includes('体調') || message.includes('風邪') || message.includes('怪我') ||
      message.includes('hospital') || message.includes('doctor') || message.includes('medicine') ||
      message.includes('pharmacy') || message.includes('health')) {
    return 'medical';
  }
  
  // ネット関連キーワード（多言語）
  if (message.includes('wifi') || message.includes('wi-fi') || message.includes('インターネット') || 
      message.includes('sim') || message.includes('スマホ') || message.includes('通信') ||
      message.includes('internet') || message.includes('network') || message.includes('data')) {
    return 'connectivity';
  }
  
  // 宿泊関連キーワード（多言語）
  if (message.includes('宿泊') || message.includes('ホテル') || message.includes('民泊') || 
      message.includes('住居') || message.includes('部屋') ||
      message.includes('hotel') || message.includes('accommodation') || message.includes('room') ||
      message.includes('stay') || message.includes('lodging')) {
    return 'accommodation';
  }
  
  // 文化関連キーワード（多言語）
  if (message.includes('文化') || message.includes('マナー') || message.includes('習慣') || 
      message.includes('礼儀') || message.includes('作法') || message.includes('お辞儀') ||
      message.includes('culture') || message.includes('manner') || message.includes('etiquette') ||
      message.includes('custom') || message.includes('tradition')) {
    return 'culture';
  }
  
  // デフォルトは一般相談
  return 'general';
}

// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing enhanced app...');
  
  // Firebase初期化を最初に実行
  const firebaseInitialized = await initializeFirebase();
  if (!firebaseInitialized) {
    console.error('Firebase initialization failed, cannot proceed');
    return;
  }
  
  // --- UI Element References ---
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authContainer = document.getElementById('auth-container');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const showSignupBtn = document.getElementById('show-signup-btn');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const guestLoginBtn = document.getElementById('guest-login-btn');
  const signupEmailInput = document.getElementById('signup-email');
  const signupPasswordInput = document.getElementById('signup-password');
  const signupPasswordConfirmInput = document.getElementById('signup-password-confirm');
  const signupBtn = document.getElementById('signup-btn');
  const showLoginBtn = document.getElementById('show-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo = document.getElementById('user-info');
  const userDisplay = document.getElementById('user-display-name');

  // --- Section Navigation Buttons ---
  const stepIndicators = document.querySelectorAll('.step');
  
  // ステップナビゲーションの改良版セットアップ
  function setupStepNavigation() {
    console.log('Setting up enhanced step navigation...');
    stepIndicators.forEach((step, idx) => {
      // 既存のイベントリスナーを削除
      const newStep = step.cloneNode(true);
      step.parentNode.replaceChild(newStep, step);
      
      newStep.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const targetSection = idx + 1;
        console.log(`Step ${targetSection} clicked`);
        
        if (!currentUser && targetSection > 1) {
          showMessage('この機能を利用するにはログインが必要です。', 'warning');
          return;
        }
        
        showSection(targetSection);
      });
      
      // ホバー効果を追加
      newStep.addEventListener('mouseenter', () => {
        if (currentUser || idx === 0) {
          newStep.style.transform = 'scale(1.05)';
          newStep.style.transition = 'transform 0.2s ease';
        }
      });
      
      newStep.addEventListener('mouseleave', () => {
        newStep.style.transform = '';
      });
    });
  }

  // 初期化時にステップナビゲーションをセットアップ
  setupStepNavigation();

  // --- 言語切り替えボタンのイベントリスナー ---
  const langJaBtn = document.getElementById('lang-ja');
  const langEnBtn = document.getElementById('lang-en');
  
  if (langJaBtn) {
    langJaBtn.addEventListener('click', () => switchLanguage('ja'));
  }
  
  if (langEnBtn) {
    langEnBtn.addEventListener('click', () => switchLanguage('en'));
  }

  // --- プロフィールの言語選択時の自動切り替え ---
  const primaryLanguageSelect = document.getElementById('primary-language');
  if (primaryLanguageSelect) {
    primaryLanguageSelect.addEventListener('change', async (e) => {
      const selectedLang = e.target.value;
      console.log('Language selected:', selectedLang);
      
      // 言語コードマッピング
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
      
      const langCode = languageCodeMap[selectedLang];
      console.log('Mapped language code:', langCode);
      
      if (langCode) {
        currentLanguage = langCode;
        console.log('Current language set to:', currentLanguage);
        
        // 即座に更新
        setTimeout(async () => {
          console.log('Starting immediate update after language change');
          updatePageTexts();
          await updateFAQQuestions(selectedCategory);
        }, 50);
      }
    });
  }

  // --- Profile Section ---
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  
  // --- Consultation Section ---
  const categoryCards = document.querySelectorAll('.category-card');
  const selectedCategoryBox = document.getElementById('selected-category');
  const selectedCategoryName = document.getElementById('selected-category-name');
  const clearCategoryBtn = document.getElementById('clear-category-btn');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const storeConsultationCheckbox = document.getElementById('store-consultation');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  
  // --- History Section ---
  const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
  const exportHistoryBtn = document.getElementById('export-history-btn');

  // チャット領域の高さを調整
  function adjustChatHeight() {
    if (chatMessages) {
      const viewportHeight = window.innerHeight;
      const otherElementsHeight = 400;
      const availableHeight = viewportHeight - otherElementsHeight;
      const minHeight = 300;
      const maxHeight = 600;
      
      const chatHeight = Math.max(minHeight, Math.min(maxHeight, availableHeight));
      chatMessages.style.height = `${chatHeight}px`;
      chatMessages.style.minHeight = `${minHeight}px`;
      chatMessages.style.maxHeight = `${maxHeight}px`;
    }
  }

  // 初期高さ設定とリサイズイベント
  adjustChatHeight();
  window.addEventListener('resize', adjustChatHeight);

  // --- Form Switching Logic ---
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', () => {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
    });
  }
  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', () => {
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
    });
  }

  // --- Authentication Functions ---
  const handleEmailLogin = () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    if (!email || !password) {
      showMessage('メールアドレスとパスワードを入力してください。', 'error');
      return;
    }
    signInWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        showMessage('ログインしました。', 'success');
      })
      .catch(handleAuthError);
  };

  const handleCreateAccount = () => {
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    const confirmPassword = signupPasswordConfirmInput.value;
    if (!email || !password) {
      showMessage('メールアドレスとパスワードを入力してください。', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('パスワードは6文字以上で入力してください。', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showMessage('パスワードが一致しません。', 'error');
      return;
    }
    createUserWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        showMessage('アカウントを作成しました。', 'success');
      })
      .catch(handleAuthError);
  };

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    signInWithPopup(auth, provider).catch(error => {
      if (error.code === 'auth/popup-blocked') {
        showMessage('ポップアップがブロックされました。リダイレクトを試みます。', 'warning');
        signInWithRedirect(auth, provider);
      } else {
        handleAuthError(error);
      }
    });
  };

  const handleGuestLogin = () => {
    signInAnonymously(auth).catch(handleAuthError);
  };

  const handleLogout = () => {
    if (!confirm('ログアウトしますか？')) return;
    signOut(auth)
      .then(() => {
        showMessage('ログアウトしました。', 'success');
      })
      .catch(error => {
        showMessage(`ログアウトエラー: ${error.message}`, 'error');
      });
  };

  // --- Auth Event Listeners ---
  if (loginBtn) loginBtn.addEventListener('click', handleEmailLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleCreateAccount);
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
  if (guestLoginBtn) guestLoginBtn.addEventListener('click', handleGuestLogin);

  // --- Logout Button Setup ---
  const setupLogoutButton = () => {
    const btn = document.getElementById('logout-btn');
    if (btn) {
      btn.style.position = 'relative';
      btn.style.zIndex = '9999';
      btn.style.pointerEvents = 'auto';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleLogout();
      });
    }
  };

  // --- Auth State Change Listener ---
  onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
    
    if (user) {
      currentUser = user;
      const displayName = user.displayName || user.email || 'ゲスト';
      if (userInfo) userInfo.style.display = 'flex';
      if (userDisplay) userDisplay.textContent = displayName;
      if (authContainer) authContainer.style.display = 'none';
      
      setTimeout(setupLogoutButton, 100);
      
      // Firestoreへのユーザーデータ保存
      const userRef = doc(db, 'kotoha_users', user.uid);
      try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            createdAt: new Date(),
            isAnonymous: user.isAnonymous,
            profile: null
          });
        }
      } catch (dbError) {
        console.error("Firestore操作エラー:", dbError);
      }
      
      await loadProfileFormFromFirestore();
      showSection(2);
    } else {
      currentUser = null;
      if (userInfo) userInfo.style.display = 'none';
      if (authContainer) authContainer.style.display = 'block';
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
      
      [loginEmailInput, loginPasswordInput, signupEmailInput,
        signupPasswordInput, signupPasswordConfirmInput].forEach(input => {
        if (input) input.value = '';
      });
      
      clearProfileForm();
      
      try {
        localStorage.removeItem('kotoha_user_profile');
        localStorage.removeItem('kotoha_consultation_history');
        localStorage.removeItem('kotoha_current_session');
        sessionStorage.clear();
      } catch (error) { }
      
      showSection(1);
    }
  });

  getRedirectResult(auth).catch(error => {
    handleAuthError(error);
  });

  // --- プロフィール保存（強化版） ---
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!currentUser) {
        showMessage('ログインが必要です。', 'error');
        return;
      }
      
      const displayName = document.getElementById('display-name')?.value ?? '';
      const nationality = document.getElementById('nationality')?.value ?? '';
      const primaryLanguage = document.getElementById('primary-language')?.value ?? '';
      const stayLocation = document.getElementById('stay-location')?.value ?? '';
      const stayPurpose = document.getElementById('stay-purpose')?.value ?? '';
      const stayFrom = document.getElementById('stay-from')?.value ?? '';
      const stayTo = document.getElementById('stay-to')?.value ?? '';
      
      // 選択された言語に基づいて、即座にアプリの言語を切り替え
      if (primaryLanguage) {
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
        
        const langCode = languageCodeMap[primaryLanguage];
        if (langCode && langCode !== currentLanguage) {
          console.log('Profile save: Changing language from', currentLanguage, 'to', langCode);
          currentLanguage = langCode;
          
          // 言語ボタンの状態更新
          document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          const langBtn = document.getElementById(`lang-${langCode}`);
          if (langBtn) {
            langBtn.classList.add('active');
          }
          
          // UI即座更新
          setTimeout(async () => {
            console.log('Profile save: Updating UI for new language');
            updatePageTexts();
            await updateFAQQuestions(selectedCategory);
            await updateChatWelcomeMessage();
          }, 100);
        }
      }
      
      const userRef = doc(db, 'kotoha_users', currentUser.uid);
      try {
        const profileData = {
          displayName,
          nationality,
          primaryLanguage,
          stayLocation,
          stayPurpose,
          stayFrom,
          stayTo,
        };
        
        await setDoc(userRef, {
          profile: profileData
        }, { merge: true });
        
        // 成功メッセージも多言語対応
        const successMessages = {
          'ja': 'プロフィールを保存しました。',
          'en': 'Profile saved successfully.',
          'ko': '프로필이 저장되었습니다.',
          'zh': '个人资料已保存。',
          'es': 'Perfil guardado exitosamente.',
          'fr': 'Profil sauvegardé avec succès.',
          'de': 'Profil erfolgreich gespeichert.',
          'it': 'Profilo salvato con successo.',
          'pt': 'Perfil salvo com sucesso.',
          'ru': 'Профиль успешно сохранен.'
        };
        
        const successMsg = successMessages[currentLanguage] || successMessages['ja'];
        showMessage(successMsg, 'success');
        showSection(3);
      } catch (e) {
        console.error('Profile save error:', e);
        
        // エラーメッセージも多言語対応
        const errorMessages = {
          'ja': 'プロフィール保存に失敗しました: ',
          'en': 'Failed to save profile: ',
          'ko': '프로필 저장에 실패했습니다: ',
          'zh': '个人资料保存失败：',
          'es': 'Error al guardar perfil: ',
          'fr': 'Échec de la sauvegarde du profil: ',
          'de': 'Profil speichern fehlgeschlagen: ',
          'it': 'Salvataggio profilo fallito: ',
          'pt': 'Falha ao salvar perfil: ',
          'ru': 'Не удалось сохранить профиль: '
        };
        
        const errorMsg = errorMessages[currentLanguage] || errorMessages['ja'];
        showMessage(errorMsg + e.message, 'error');
      }
    });
  }

  // --- プロフィール編集ボタン ---
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Edit profile button clicked');
      showSection(2);
    });
  }

  // --- 戻るボタン（履歴→相談）---
  if (backToConsultationBtn) {
    backToConsultationBtn.addEventListener('click', () => {
      console.log('Back to consultation clicked');
      showSection(3);
    });
  }

  // --- 履歴データの読み込み ---
  async function loadConsultationHistory() {
    const historyContainer = document.getElementById('consultation-history');
    if (!historyContainer || !currentUser) return;

    try {
      const conversations = await getAllConversations();
      
      if (conversations.length === 0) {
        const t = translations[currentLanguage] || translations['ja'];
        historyContainer.innerHTML = `
          <div class="no-history">
            <p>${t.noHistory}</p>
          </div>
        `;
        return;
      }

      // 履歴の表示
      let historyHTML = '';
      for (const conv of conversations) {
        const date = new Date(conv.timestamp.seconds * 1000);
        const formattedDate = date.toLocaleDateString(currentLanguage === 'ja' ? 'ja-JP' : 'en-US');
        const formattedTime = date.toLocaleTimeString(currentLanguage === 'ja' ? 'ja-JP' : 'en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        // カテゴリ名を動的翻訳
        const categoryNamesJa = {
          'transportation': '交通・移動',
          'medical': '医療・健康',
          'connectivity': 'ネット・通信',
          'accommodation': '住居・宿泊',
          'culture': '文化・マナー',
          'general': '一般相談'
        };
        
        const categoryJa = categoryNamesJa[conv.category] || conv.category;
        const categoryName = currentLanguage === 'ja' ? 
          categoryJa : await translateText(categoryJa, currentLanguage);
        
        historyHTML += `
          <div class="history-item">
            <div class="history-header">
              <span class="history-date">${formattedDate} ${formattedTime}</span>
              <span class="history-category">${categoryName}</span>
            </div>
            <div class="history-content">
              <div class="history-question">
                <strong>Q:</strong> ${conv.userMessage}
              </div>
              <div class="history-answer">
                <strong>A:</strong> ${conv.aiResponse.substring(0, 200)}${conv.aiResponse.length > 200 ? '...' : ''}
              </div>
            </div>
          </div>
        `;
      }
      
      historyContainer.innerHTML = historyHTML;
      
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
      historyContainer.innerHTML = `
        <div class="no-history">
          <p>履歴の読み込みに失敗しました。</p>
          <p>Failed to load history.</p>
        </div>
      `;
    }
  }

  // --- セクション表示時の履歴読み込み ---
  const originalShowSection = showSection;
  showSection = function(sectionNum) {
    originalShowSection(sectionNum);
    
    // 履歴画面表示時に履歴を読み込み
    if (sectionNum === 4) {
      setTimeout(loadConsultationHistory, 100);
    }
    
    // 相談画面表示時によくある質問を更新
    if (sectionNum === 3) {
      setTimeout(async () => {
        console.log('Section 3 shown, updating FAQ');
        await updateFAQQuestions(selectedCategory);
      }, 200);
    }
  };

  // --- 相談カテゴリ選択 ---
  categoryCards.forEach((card, index) => {
    card.addEventListener('click', async () => {
      const categoryValue = card.getAttribute('data-category');
      selectCategory(categoryValue);
      
      // カテゴリ名を動的翻訳
      const categoryNamesJa = {
        transportation: '交通・移動',
        medical: '医療・健康',
        connectivity: 'ネット・通信',
        accommodation: '住居・宿泊',
        culture: '文化・マナー',
        general: '一般相談'
      };
      
      const categoryJa = categoryNamesJa[categoryValue] || categoryValue;
      const categoryName = currentLanguage === 'ja' ? 
        categoryJa : await translateText(categoryJa, currentLanguage);
      
      const selectedMessage = currentLanguage === 'ja' ? 
        `${categoryName} を選択しました。` : 
        await translateText(`${categoryJa} を選択しました。`, currentLanguage);
      
      showMessage(selectedMessage, 'info');
    });
  });

  // --- カテゴリ解除 ---
  if (clearCategoryBtn) {
    clearCategoryBtn.addEventListener('click', () => {
      selectedCategory = '';
      if (selectedCategoryBox) {
        selectedCategoryBox.style.display = 'none';
      }
      document.querySelectorAll('.category-card').forEach(c => {
        c.classList.remove('selected', 'active');
      });
      
      // デフォルトのよくある質問に戻す
      updateFAQQuestions();
      
      updateSendButton();
    });
  }

  // --- チャット入力・送信ボタン制御 ---
  function updateSendButtonLocal() {
    updateSendButton();
  }

  // チャット入力のイベントリスナー
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      updateSendButtonLocal();
    });

    // Enterキーで送信
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
          handleSendMessage();
        }
      }
    });
  }

  // --- 相談内容の保存チェック ---
  if (storeConsultationCheckbox) {
    storeConsultationCheckbox.addEventListener('change', () => {
      shouldStoreConsultation = storeConsultationCheckbox.checked;
    });
  }

  // --- AIチャット送信（サーバーAPI使用版）- 多言語対応を強化 ---
  async function handleSendMessage() {
    if (!chatInput || !chatInput.value.trim() || isAIChatting) {
      return;
    }
    
    const userMessage = chatInput.value.trim();
    console.log('Sending message to AI:', userMessage);
    console.log('Current language:', currentLanguage);
    
    // カテゴリが選択されていない場合は推測
    if (!selectedCategory) {
      const guessedCategory = guessCategory(userMessage);
      selectCategory(guessedCategory);
    }
    
    // ユーザーメッセージを表示
    appendChatMessage('user', userMessage);
    
    // 入力欄をクリア
    chatInput.value = '';
    isAIChatting = true;
    updateSendButton();
    
    // タイピングインジケーター表示
    appendTypingIndicator();
    
    try {
      // プロフィール情報を取得
      let userProfile = null;
      if (currentUser) {
        const userRef = doc(db, 'kotoha_users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().profile) {
          userProfile = userSnap.data().profile;
        }
      }
      
      // 最近の会話履歴を取得
      const recentConversations = await getRecentConversations(3);
      console.log('Recent conversations:', recentConversations);
      
      // サーバーのAI APIを呼び出し（プロフィール情報と履歴、言語情報を含む）
      console.log('Calling API with language:', currentLanguage);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          userId: currentUser ? currentUser.uid : null,
          language: currentLanguage, // 必ず現在の言語を送信
          context: {
            category: selectedCategory,
            userProfile: userProfile,
            recentConversations: recentConversations
          }
        }),
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'サーバーでエラーが発生しました。');
      }

      const data = await response.json();
      console.log('API response received:', { 
        responseLength: data.response?.length, 
        language: data.language,
        firstChars: data.response?.substring(0, 100) 
      });
      
      // Markdownを適用してAIレスポンスを表示
      let formattedResponse = formatMarkdownResponse(data.response);
      
      appendChatMessage('ai', formattedResponse);
      
      // 会話履歴を保存（ユーザー設定に応じて）
      await saveConversation(userMessage, data.response, selectedCategory);

    } catch (error) {
      console.error('AI chat error:', error);
      removeTypingIndicator();
      
      // フォールバック：言語対応ローカルレスポンス
      const fallbackResponse = generateBetterResponse(userMessage, selectedCategory, currentLanguage);
      const formattedFallback = formatMarkdownResponse(fallbackResponse);
      appendChatMessage('ai', formattedFallback);
      
      // フォールバック応答も保存
      await saveConversation(userMessage, fallbackResponse, selectedCategory);
      
      // エラーメッセージも多言語対応
      const errorMessages = {
        'ja': 'AI接続エラー。ローカル応答を表示しています。',
        'en': 'AI connection error. Showing local response.',
        'ko': 'AI 연결 오류. 로컬 응답을 표시합니다.',
        'zh': 'AI连接错误。显示本地响应。',
        'es': 'Error de conexión AI. Mostrando respuesta local.',
        'fr': 'Erreur de connexion AI. Affichage de la réponse locale.',
        'de': 'AI-Verbindungsfehler. Lokale Antwort wird angezeigt.',
        'it': 'Errore di connessione AI. Visualizzazione della risposta locale.',
        'pt': 'Erro de conexão AI. Exibindo resposta local.',
        'ru': 'Ошибка подключения ИИ. Показ локального ответа.'
      };
      
      const errorMsg = errorMessages[currentLanguage] || errorMessages['ja'];
      showMessage(errorMsg, 'warning');
    } finally {
      isAIChatting = false;
      updateSendButton();
    }
  }

  if (sendButton) {
    sendButton.addEventListener('click', handleSendMessage);
  }

  // --- チャットクリア ---
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('チャットをクリアしますか？')) {
        initializeChatWithWelcomeMessage();
      }
    });
  }
  
  // --- 初期表示時のテキスト更新 ---
  updatePageTexts();
  
  // よくある質問の初期化（少し遅延させて確実に）
  setTimeout(async () => {
    console.log('Initializing FAQ with language:', currentLanguage);
    await updateFAQQuestions();
  }, 300);
  
  // チャット画面の初期化
  setTimeout(async () => {
    await initializeChatWithWelcomeMessage();
  }, 500);
});

// --- 会話履歴管理機能 ---

// 会話履歴を保存
async function saveConversation(userMessage, aiResponse, category) {
  if (!currentUser || !shouldStoreConsultation) {
    console.log('会話履歴保存スキップ:', { hasUser: !!currentUser, shouldStore: shouldStoreConsultation });
    return;
  }

  try {
    // ユーザープロフィールを取得
    const userRef = doc(db, 'kotoha_users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userProfile = userSnap.exists() ? userSnap.data().profile : null;

    // 会話データを作成
    const conversationData = {
      timestamp: new Date(),
      category: category || 'general',
      userMessage: userMessage.substring(0, 1000), // 1000文字制限
      aiResponse: aiResponse.substring(0, 2000), // 2000文字制限
      userLanguage: userProfile?.primaryLanguage || '日本語',
      stayLocation: userProfile?.stayLocation || ''
    };

    // Firestoreに保存
    const conversationsRef = collection(db, 'kotoha_users', currentUser.uid, 'conversations');
    await addDoc(conversationsRef, conversationData);
    
    console.log('会話履歴を保存しました:', conversationData);

    // 古い履歴の削除（10件を超えた場合）
    await cleanOldConversations();

  } catch (error) {
    console.error('会話履歴保存エラー:', error);
  }
}

// 古い会話履歴をクリーンアップ（最新10件のみ保持）
async function cleanOldConversations() {
  try {
    const conversationsRef = collection(db, 'kotoha_users', currentUser.uid, 'conversations');
    const q = query(conversationsRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.size > 10) {
      // 10件を超えた分を削除
      const docsToDelete = [];
      snapshot.docs.slice(10).forEach(doc => {
        docsToDelete.push(deleteDoc(doc.ref));
      });
      await Promise.all(docsToDelete);
      console.log(`古い会話履歴を${docsToDelete.length}件削除しました`);
    }
  } catch (error) {
    console.error('会話履歴クリーンアップエラー:', error);
  }
}

// 最近の会話履歴を取得（AI文脈用）
async function getRecentConversations(limitCount = 3) {
  if (!currentUser) return [];

  try {
    const conversationsRef = collection(db, 'kotoha_users', currentUser.uid, 'conversations');
    const q = query(conversationsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    const conversations = [];
    snapshot.forEach(doc => {
      conversations.push({ id: doc.id, ...doc.data() });
    });
    
    return conversations.reverse(); // 時系列順に並び替え
  } catch (error) {
    console.error('会話履歴取得エラー:', error);
    return [];
  }
}

// 全ての会話履歴を取得（履歴画面用）
async function getAllConversations() {
  if (!currentUser) return [];

  try {
    const conversationsRef = collection(db, 'kotoha_users', currentUser.uid, 'conversations');
    const q = query(conversationsRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    
    const conversations = [];
    snapshot.forEach(doc => {
      conversations.push({ id: doc.id, ...doc.data() });
    });
    
    return conversations;
  } catch (error) {
    console.error('全会話履歴取得エラー:', error);
    return [];
  }
}

// --- Markdown処理関数 ---
function formatMarkdownResponse(text) {
  try {
    // marked.jsが利用可能な場合
    if (typeof marked !== 'undefined' && marked.parse) {
      // marked.jsの設定
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      return marked.parse(text);
    }
  } catch (error) {
    console.warn('marked.js parsing failed:', error);
  }
  
  // フォールバック：手動でMarkdownをHTMLに変換
  return manualMarkdownToHTML(text);
}

// 手動Markdown変換関数
function manualMarkdownToHTML(text) {
  let html = text;
  
  // 見出し変換 (### → <h3>、## → <h2>、# → <h1>)
  html = html.replace(/^### (.+)$/gm, '<h3 class="ai-heading3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="ai-heading2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="ai-heading1">$1</h1>');
  
  // 太字変換 (**text** → <strong>)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="ai-bold">$1</strong>');
  
  // リスト変換
  html = html.replace(/^[-•]\s(.+)$/gm, '<li class="ai-list-item">$1</li>');
  html = html.replace(/(<li class="ai-list-item">.*<\/li>)/s, '<ul class="ai-list">$1</ul>');
  
  // 改行変換
  html = html.replace(/\n\n/g, '</p><p class="ai-paragraph">');
  html = html.replace(/\n/g, '<br>');
  
  // 段落でラップ
  if (!html.includes('<p') && !html.includes('<h') && !html.includes('<ul')) {
    html = `<p class="ai-paragraph">${html}</p>`;
  } else if (!html.startsWith('<')) {
    html = `<p class="ai-paragraph">${html}`;
  }
  
  return html;
}

function appendTypingIndicator() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const indicatorHTML = `
    <div class="message ai-message" id="typing-indicator">
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-bubble">
          <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  chatMessages.insertAdjacentHTML('beforeend', indicatorHTML);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

// --- 改良されたレスポンス生成（フォールバック用）- 多言語対応 ---
function generateBetterResponse(userMessage, category, language = 'ja') {
  const responses = {
    ja: {
      transportation: [
        "愛媛県の公共交通についてお答えします！\n\n松山市内では「伊予鉄バス」と「市内電車（路面電車）」が主要な交通手段です。\n\n【おすすめの移動方法】\n🚌 バス：ICカード「い～カード」が便利\n🚃 市内電車：道後温泉や松山城へのアクセスに最適\n🚗 タクシー：深夜や荷物が多い時に\n\n料金や時刻表は伊予鉄道の公式サイトで確認できます。",
        "愛媛での交通手段について詳しくご案内します。\n\n【エリア別アクセス】\n• 松山市内：市内電車・バスで十分\n• 今治・新居浜：JR予讃線が便利\n• しまなみ海道：レンタサイクルがおすすめ\n\n【お得情報】\n1日乗車券や観光パスもあります！\n具体的な目的地があれば、ルートをお調べしますよ。"
      ],
      medical: [
        "愛媛県での医療についてサポートします！\n\n【主要病院】\n🏥 愛媛大学医学部附属病院（東温市）\n🏥 松山赤十字病院（松山市）\n🏥 済生会松山病院（松山市）\n\n【受診の流れ】\n1. 保険証持参（国民健康保険なら3割負担）\n2. 受付で問診票記入\n3. 診察・検査\n4. 会計\n\n【緊急時】救急：119番\n医療相談：#7119（24時間）"
      ],
      general: [
        "愛媛での生活・観光についてお答えします！\n\n【観光スポット】\n🏯 松山城：市内中心の歴史ある城\n♨️ 道後温泉：日本最古の温泉地\n🌉 しまなみ海道：サイクリングで有名\n\n【愛媛グルメ】\n🐟 鯛めし（郷土料理）\n🐠 じゃこ天（練り物）\n🍊 愛媛みかん（11-3月が旬）\n\n【ショッピング】\n大街道・銀天街が松山の繁華街です！"
      ]
    },
    en: {
      transportation: [
        "I'll help you with public transportation in Ehime Prefecture!\n\n**Main Transportation in Matsuyama City:**\n- Iyotetsu Bus\n- City Tram (Streetcar)\n\n**Recommended Transportation Methods:**\n🚌 Bus: IC card \"i-Card\" is convenient\n🚃 City Tram: Perfect for accessing Dogo Onsen and Matsuyama Castle\n🚗 Taxi: For late nights or when carrying luggage\n\nYou can check fares and schedules on the Iyotetsu official website."
      ],
      medical: [
        "I'll support you with medical services in Ehime Prefecture!\n\n**Major Hospitals:**\n🏥 Ehime University Hospital (Toon City)\n🏥 Matsuyama Red Cross Hospital (Matsuyama City)\n🏥 Saiseikai Matsuyama Hospital (Matsuyama City)\n\n**Medical Visit Process:**\n1. Bring insurance card (30% co-payment with national health insurance)\n2. Fill out medical questionnaire at reception\n3. Examination and tests\n4. Payment\n\n**Emergency:** Ambulance: 119\nMedical Consultation: #7119 (24 hours)"
      ],
      general: [
        "I'll help you with life and tourism in Ehime!\n\n**Tourist Spots:**\n🏯 Matsuyama Castle: Historic castle in city center\n♨️ Dogo Onsen: Japan's oldest hot spring resort\n🌉 Shimanami Kaido: Famous for cycling\n\n**Ehime Cuisine:**\n🐟 Tai-meshi (local sea bream rice dish)\n🐠 Jakoten (fish cake)\n🍊 Ehime Mikan (citrus, in season Nov-Mar)\n\n**Shopping:**\nOkaido and Gintengai are Matsuyama's main shopping districts!"
      ]
    },
    zh: {
      transportation: [
        "我来为您介绍爱媛县的公共交通！\n\n**松山市内主要交通工具：**\n- 伊予铁巴士\n- 市内电车（有轨电车）\n\n**推荐交通方式：**\n🚌 巴士：IC卡"i-Card"很方便\n🚃 市内电车：前往道后温泉和松山城的最佳选择\n🚗 出租车：深夜或行李较多时\n\n可在伊予铁道官网查看票价和时刻表。"
      ],
      medical: [
        "我来为您介绍爱媛县的医疗服务！\n\n**主要医院：**\n🏥 爱媛大学医学部附属医院（东温市）\n🏥 松山红十字医院（松山市）\n🏥 济生会松山医院（松山市）\n\n**就诊流程：**\n1. 携带保险证（国民健康保险自付30%）\n2. 在接待处填写问诊表\n3. 诊察・检查\n4. 结算\n\n**紧急情况：**急救：119\n医疗咨询：#7119（24小时）"
      ],
      general: [
        "我来为您介绍爱媛的生活和观光！\n\n**观光景点：**\n🏯 松山城：市中心的历史古城\n♨️ 道后温泉：日本最古老的温泉地\n🌉 濑户内海道：以骑行闻名\n\n**爱媛美食：**\n🐟 鲷鱼饭（乡土料理）\n🐠 鱼糕天（鱼糕）\n🍊 爱媛蜜柑（11-3月为旺季）\n\n**购物：**\n大街道・银天街是松山的繁华街区！"
      ]
    },
    ko: {
      transportation: [
        "에히메현의 대중교통에 대해 안내드리겠습니다!\n\n**마츠야마시내 주요 교통수단:**\n- 이요테츠 버스\n- 시내전차(노면전차)\n\n**추천 교통수단:**\n🚌 버스: IC카드 \"i-Card\"가 편리\n🚃 시내전차: 도고온천과 마츠야마성 접근에 최적\n🚗 택시: 심야시간이나 짐이 많을 때\n\n요금과 시간표는 이요테츠도 공식 사이트에서 확인할 수 있습니다."
      ],
      medical: [
        "에히메현의 의료 서비스에 대해 도와드리겠습니다!\n\n**주요 병원:**\n🏥 에히메대학 의학부 부속병원(도온시)\n🏥 마츠야마 적십자병원(마츠야마시)\n🏥 사이세이카이 마츠야마병원(마츠야마시)\n\n**진료 과정:**\n1. 보험증 지참(국민건강보험 시 30% 본인부담)\n2. 접수처에서 문진표 작성\n3. 진찰・검사\n4. 수납\n\n**응급상황:** 구급차: 119\n의료 상담: #7119(24시간)"
      ],
      general: [
        "에히메의 생활과 관광에 대해 안내드리겠습니다!\n\n**관광 명소:**\n🏯 마츠야마성: 시내 중심의 역사적인 성\n♨️ 도고온천: 일본 최고(最古)의 온천지\n🌉 시마나미 해도: 사이클링으로 유명\n\n**에히메 음식:**\n🐟 도미밥(향토요리)\n🐠 자코텐(어묵)\n🍊 에히메 귤(11-3월이 제철)\n\n**쇼핑:**\n오카이도・긴텐가이가 마츠야마의 번화가입니다!"
      ]
    }
  };

  // 언어 폴백: 지정 언어가 없는 경우는 일본어
  const langResponses = responses[language] || responses['ja'];
  const categoryResponses = langResponses[category] || langResponses['general'] || responses['ja']['general'];
  const randomIndex = Math.floor(Math.random() * categoryResponses.length);
  return categoryResponses[randomIndex];
}

// --- フォームクリア関数 ---
function clearProfileForm() {
  const displayNameInput = document.getElementById('display-name');
  const nationalitySelect = document.getElementById('nationality');
  const primaryLanguageSelect = document.getElementById('primary-language');
  const stayLocationSelect = document.getElementById('stay-location');
  const stayPurposeSelect = document.getElementById('stay-purpose');
  const stayFromInput = document.getElementById('stay-from');
  const stayToInput = document.getElementById('stay-to');
  
  if (displayNameInput) displayNameInput.value = '';
  if (nationalitySelect) nationalitySelect.value = '';
  if (primaryLanguageSelect) primaryLanguageSelect.value = '';
  if (stayLocationSelect) stayLocationSelect.value = '';
  if (stayPurposeSelect) stayPurposeSelect.value = '';
  if (stayFromInput) stayFromInput.value = '';
  if (stayToInput) stayToInput.value = '';
}

// --- Firestore→フォーム反映関数（強化版） ---
async function loadProfileFormFromFirestore() {
  if (!currentUser) return;
  
  try {
    const userRef = doc(getFirestore(), 'kotoha_users', currentUser.uid);
    const snap = await getDoc(userRef);
    
    if (snap.exists() && snap.data().profile) {
      const data = snap.data().profile;
      
      const displayNameField = document.getElementById('display-name');
      const nationalityField = document.getElementById('nationality');
      const primaryLanguageField = document.getElementById('primary-language');
      const stayLocationField = document.getElementById('stay-location');
      const stayPurposeField = document.getElementById('stay-purpose');
      const stayFromField = document.getElementById('stay-from');
      const stayToField = document.getElementById('stay-to');
      
      if (displayNameField) displayNameField.value = data.displayName ?? '';
      if (nationalityField) nationalityField.value = data.nationality ?? '';
      if (primaryLanguageField) primaryLanguageField.value = data.primaryLanguage ?? '';
      if (stayLocationField) stayLocationField.value = data.stayLocation ?? '';
      if (stayPurposeField) stayPurposeField.value = data.stayPurpose ?? '';
      if (stayFromField) stayFromField.value = data.stayFrom ?? '';
      if (stayToField) stayToField.value = data.stayTo ?? '';
      
      // 言語設定があれば自動でページ言語も切り替え（確実に実行）
      if (data.primaryLanguage) {
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
        
        const langCode = languageCodeMap[data.primaryLanguage];
        if (langCode) {
          console.log('Profile load: Setting language to:', langCode, 'from profile:', data.primaryLanguage);
          
          // 即座に言語を変更
          currentLanguage = langCode;
          
          // ヘッダーボタンの状態更新
          document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          const langBtn = document.getElementById(`lang-${langCode}`);
          if (langBtn) {
            langBtn.classList.add('active');
          }
          
          // 段階的にUI更新（確実に反映するため）
          setTimeout(async () => {
            console.log('Profile load: First language update');
            updatePageTexts();
          }, 50);
          
          setTimeout(async () => {
            console.log('Profile load: FAQ update');
            await updateFAQQuestions(selectedCategory);
          }, 150);
          
          setTimeout(async () => {
            console.log('Profile load: Chat welcome update');
            await updateChatWelcomeMessage();
          }, 250);
          
          setTimeout(async () => {
            console.log('Profile load: Final comprehensive update');
            updatePageTexts();
            await updateFAQQuestions(selectedCategory);
            await updateChatWelcomeMessage();
          }, 400);
        }
      }
    } else {
      clearProfileForm();
    }
  } catch (error) {
    console.error('Profile loading error:', error);
  }
}

// --- Section・Step Utility ---
function showSection(sectionNum) {
  console.log(`Showing section ${sectionNum}`);
  
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  
  const target = document.getElementById(`section-${sectionNum}`);
  if (target) {
    target.classList.add('active');
    currentSection = sectionNum;
    updateProgress();
    updateStepIndicators();
    console.log(`Successfully shown section ${sectionNum}`);
  } else {
    console.error(`Section ${sectionNum} not found`);
  }
}

function updateStepIndicators() {
  console.log('Updating step indicators for section:', currentSection);
  document.querySelectorAll('.step').forEach(step => {
    const stepNum = parseInt(step.getAttribute('data-step'));
    const shouldBeActive = stepNum === currentSection;
    step.classList.toggle('active', shouldBeActive);
  });
}

function updateProgress() {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    const progressPercentage = currentSection > 1 ? ((currentSection - 1) / 3) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
  }
}

// --- Chat表示ユーティリティ（改良版） ---
function appendChatMessage(type, htmlContent) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const isAI = type === 'ai';
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isAI ? 'ai-message' : 'user-message'}`;
  
  const avatar = isAI ? '🤖' : '🧑';
  const senderName = isAI ? 'Kotoha AI' : 'You';
  
  // HTMLコンテンツをそのまま使用（Markdownが既に適用済み）
  const contentToShow = isAI ? htmlContent : htmlContent.replace(/\n/g, '<br>');
  
  messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-bubble">${contentToShow}</div>
      <div class="message-time">${senderName} • ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `;
  
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// --- 改善された自動スクロール関数 ---
function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    const lastMessage = chatMessages.lastElementChild;
    if (lastMessage) {
      lastMessage.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest' 
      });
    }
  }, 100);
  
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 300);
}

// --- メッセージ表示関数（改良版） ---
function showMessage(text, type = 'info') {
  console.log(`Message: ${text} (${type})`);
  
  // より良いメッセージ表示（必要に応じてカスタムUIに変更）
  const el = document.createElement('div');
  el.textContent = text;
  
  let bgColor;
  switch (type) {
    case 'error': bgColor = '#d32f2f'; break;
    case 'success': bgColor = '#2e7d32'; break;
    case 'warning': bgColor = '#f57c00'; break;
    default: bgColor = '#1976d2';
  }
  
  el.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${bgColor};
    color: white;
    padding: 1rem;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    max-width: 90%;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(el);
  
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-20px)';
    el.addEventListener('transitionend', () => el.remove());
  }, 5000);
}

// --- エラーハンドリング ---
function handleAuthError(error) {
  console.error('Auth error:', error);
  let msg = 'エラーが発生しました。';
  if (error.code) {
    switch (error.code) {
      case 'auth/user-not-found':
        msg = 'ユーザーが存在しません。';
        break;
      case 'auth/wrong-password':
        msg = 'パスワードが間違っています。';
        break;
      case 'auth/email-already-in-use':
        msg = 'このメールアドレスは既に使われています。';
        break;
      case 'auth/invalid-email':
        msg = '無効なメールアドレスです。';
        break;
      case 'auth/weak-password':
        msg = 'パスワードは6文字以上で入力してください。';
        break;
      default:
        msg = error.message;
    }
  }
  showMessage(msg, 'error');
}
