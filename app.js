// Firebase v10.12.2 - Secure Initialization

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
  deleteDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// --- Global Variables ---
let auth, db;
let currentUser = null;
let currentSection = 1;
let selectedCategory = '';
let shouldStoreConsultation = true;
let isAIChatting = false;
let currentLanguage = 'ja'; // Default language

// --- Translations ---
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
    historyTitle: 'Consultation History',
    historyDesc: 'View your past consultation records',
    backToConsultation: 'Back to Consultation',
    exportHistory: 'Export History',
    noHistory: 'No consultation history yet.',
    logout: 'Logout',
    select: 'Select'
  },
  // Add other languages here...
  ko: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: '에히메현 체류를 지원하는 AI 어시스턴트',
    welcomeTitle: 'Kotoha AI에 오신 것을 환영합니다',
    welcomeDesc: '에히메현에서의 체류를 더욱 편안하게 하기 위해 먼저 계정을 만들어 주세요',
    loginTitle: '로그인',
    signupTitle: '계정 생성',
    email: '이메일 주소',
    password: '비밀번호',
    passwordConfirm: '비밀번호 확인',
    loginBtn: '로그인',
    signupBtn: '계정 생성',
    googleLoginBtn: 'Google로 로그인',
    guestLoginBtn: '게스트로 이용',
    showSignupBtn: '계정 생성',
    showLoginBtn: '로그인으로 돌아가기',
    profileTitle: '프로필 설정',
    profileDesc: '더 적절한 지원을 제공하기 위해 기본 정보를 알려주세요',
    displayName: '표시 이름',
    nationality: '국적',
    primaryLanguage: '사용 언어',
    stayLocation: '체류 지역',
    stayPurpose: '체류 목적',
    stayPeriod: '체류 기간',
    saveProfileBtn: '프로필 저장',
    consultationTitle: 'AI 상담',
    consultationDesc: '카테고리를 선택하고 편하게 질문해 주세요',
    categoryTitle: '상담 카테고리',
    historyTitle: '상담 이력',
    historyDesc: '과거 상담 내용을 확인할 수 있습니다',
    backToConsultation: '상담으로 돌아가기',
    exportHistory: '이력 내보내기',
    noHistory: '아직 상담 이력이 없습니다.',
    logout: '로그아웃',
    select: '선택해 주세요'
  },
  zh: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: '支持爱媛县居留的AI助理',
    welcomeTitle: '欢迎使用 Kotoha AI',
    welcomeDesc: '为了让您在爱媛县的居留更加舒适，请先创建账户',
    loginTitle: '登录',
    signupTitle: '创建账户',
    email: '电子邮箱',
    password: '密码',
    passwordConfirm: '确认密码',
    loginBtn: '登录',
    signupBtn: '创建账户',
    googleLoginBtn: 'Google登录',
    guestLoginBtn: '作为访客使用',
    showSignupBtn: '创建账户',
    showLoginBtn: '返回登录',
    profileTitle: '个人资料设置',
    profileDesc: '为了提供更合适的支持，请告诉我们您的基本信息',
    displayName: '显示姓名',
    nationality: '国籍',
    primaryLanguage: '使用语言',
    stayLocation: '居留地区',
    stayPurpose: '居留目的',
    stayPeriod: '居留期间',
    saveProfileBtn: '保存个人资料',
    consultationTitle: 'AI咨询',
    consultationDesc: '请选择类别，随时提问',
    categoryTitle: '咨询类别',
    historyTitle: '咨询历史',
    historyDesc: '您可以查看过往的咨询内容',
    backToConsultation: '返回咨询',
    exportHistory: '导出历史',
    noHistory: '还没有咨询历史。',
    logout: '退出登录',
    select: '请选择'
  },
  es: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Asistente de IA para tu estancia en la Prefectura de Ehime',
    welcomeTitle: 'Bienvenido a Kotoha AI',
    welcomeDesc: 'Crea una cuenta para hacer tu estancia en la Prefectura de Ehime más cómoda',
    loginTitle: 'Iniciar Sesión',
    signupTitle: 'Crear Cuenta',
    email: 'Correo Electrónico',
    password: 'Contraseña',
    passwordConfirm: 'Confirmar Contraseña',
    loginBtn: 'Iniciar Sesión',
    signupBtn: 'Crear Cuenta',
    googleLoginBtn: 'Iniciar con Google',
    guestLoginBtn: 'Usar como Invitado',
    showSignupBtn: 'Crear Cuenta',
    showLoginBtn: 'Volver a Iniciar Sesión',
    profileTitle: 'Configuración del Perfil',
    profileDesc: 'Proporcione su información básica para un mejor soporte',
    displayName: 'Nombre para Mostrar',
    nationality: 'Nacionalidad',
    primaryLanguage: 'Idioma Principal',
    stayLocation: 'Ubicación de Estancia',
    stayPurpose: 'Propósito',
    stayPeriod: 'Período de Estancia',
    saveProfileBtn: 'Guardar Perfil',
    consultationTitle: 'Consulta AI',
    consultationDesc: 'Selecciona una categoría y haz preguntas libremente',
    categoryTitle: 'Categoría',
    historyTitle: 'Historial de Consultas',
    historyDesc: 'Ver tus registros de consultas anteriores',
    backToConsultation: 'Volver a Consulta',
    exportHistory: 'Exportar Historial',
    noHistory: 'Aún no hay historial de consultas.',
    logout: 'Cerrar Sesión',
    select: 'Seleccionar'
  },
  fr: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Assistant IA pour votre séjour dans la Préfecture d\'Ehime',
    welcomeTitle: 'Bienvenue sur Kotoha AI',
    welcomeDesc: 'Créez un compte pour rendre votre séjour dans la Préfecture d\'Ehime plus confortable',
    loginTitle: 'Se Connecter',
    signupTitle: 'Créer un Compte',
    email: 'Adresse Email',
    password: 'Mot de Passe',
    passwordConfirm: 'Confirmer le Mot de Passe',
    loginBtn: 'Se Connecter',
    signupBtn: 'Créer un Compte',
    googleLoginBtn: 'Se connecter avec Google',
    guestLoginBtn: 'Utiliser comme Invité',
    showSignupBtn: 'Créer un Compte',
    showLoginBtn: 'Retour à la Connexion',
    profileTitle: 'Configuration du Profil',
    profileDesc: 'Veuillez fournir vos informations de base pour un meilleur support',
    displayName: 'Nom d\'Affichage',
    nationality: 'Nationalité',
    primaryLanguage: 'Langue Principale',
    stayLocation: 'Lieu de Séjour',
    stayPurpose: 'Objectif',
    stayPeriod: 'Période de Séjour',
    saveProfileBtn: 'Sauvegarder le Profil',
    consultationTitle: 'Consultation IA',
    consultationDesc: 'Sélectionnez une catégorie et posez vos questions librement',
    categoryTitle: 'Catégorie',
    historyTitle: 'Historique des Consultations',
    historyDesc: 'Voir vos enregistrements de consultations précédentes',
    backToConsultation: 'Retour à la Consultation',
    exportHistory: 'Exporter l\'Historique',
    noHistory: 'Aucun historique de consultation pour le moment.',
    logout: 'Se Déconnecter',
    select: 'Sélectionner'
  },
  de: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'KI-Assistent für Ihren Aufenthalt in der Präfektur Ehime',
    welcomeTitle: 'Willkommen bei Kotoha AI',
    welcomeDesc: 'Erstellen Sie ein Konto, um Ihren Aufenthalt in der Präfektur Ehime komfortabler zu gestalten',
    loginTitle: 'Anmelden',
    signupTitle: 'Konto Erstellen',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    passwordConfirm: 'Passwort Bestätigen',
    loginBtn: 'Anmelden',
    signupBtn: 'Konto Erstellen',
    googleLoginBtn: 'Mit Google anmelden',
    guestLoginBtn: 'Als Gast verwenden',
    showSignupBtn: 'Konto Erstellen',
    showLoginBtn: 'Zurück zur Anmeldung',
    profileTitle: 'Profil-Einrichtung',
    profileDesc: 'Bitte geben Sie Ihre grundlegenden Informationen für bessere Unterstützung an',
    displayName: 'Anzeigename',
    nationality: 'Nationalität',
    primaryLanguage: 'Hauptsprache',
    stayLocation: 'Aufenthaltsort',
    stayPurpose: 'Zweck',
    stayPeriod: 'Aufenthaltsdauer',
    saveProfileBtn: 'Profil Speichern',
    consultationTitle: 'KI-Beratung',
    consultationDesc: 'Wählen Sie eine Kategorie und stellen Sie frei Fragen',
    categoryTitle: 'Kategorie',
    historyTitle: 'Beratungshistorie',
    historyDesc: 'Sehen Sie Ihre vorherigen Beratungsaufzeichnungen',
    backToConsultation: 'Zurück zur Beratung',
    exportHistory: 'Historie Exportieren',
    noHistory: 'Noch keine Beratungshistorie vorhanden.',
    logout: 'Abmelden',
    select: 'Auswählen'
  },
  it: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Assistente AI per il tuo soggiorno nella Prefettura di Ehime',
    welcomeTitle: 'Benvenuto in Kotoha AI',
    welcomeDesc: 'Crea un account per rendere il tuo soggiorno nella Prefettura di Ehime più confortevole',
    loginTitle: 'Accedi',
    signupTitle: 'Crea Account',
    email: 'Indirizzo Email',
    password: 'Password',
    passwordConfirm: 'Conferma Password',
    loginBtn: 'Accedi',
    signupBtn: 'Crea Account',
    googleLoginBtn: 'Accedi con Google',
    guestLoginBtn: 'Usa come Ospite',
    showSignupBtn: 'Crea Account',
    showLoginBtn: 'Torna al Login',
    profileTitle: 'Configurazione Profilo',
    profileDesc: 'Fornisci le tue informazioni di base per un migliore supporto',
    displayName: 'Nome Visualizzato',
    nationality: 'Nazionalità',
    primaryLanguage: 'Lingua Principale',
    stayLocation: 'Luogo di Soggiorno',
    stayPurpose: 'Scopo',
    stayPeriod: 'Periodo di Soggiorno',
    saveProfileBtn: 'Salva Profilo',
    consultationTitle: 'Consulenza AI',
    consultationDesc: 'Seleziona una categoria e fai domande liberamente',
    categoryTitle: 'Categoria',
    historyTitle: 'Cronologia Consultazioni',
    historyDesc: 'Visualizza i tuoi record di consultazioni precedenti',
    backToConsultation: 'Torna alla Consultazione',
    exportHistory: 'Esporta Cronologia',
    noHistory: 'Nessuna cronologia di consultazioni ancora.',
    logout: 'Disconnetti',
    select: 'Seleziona'
  },
  pt: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Assistente de IA para sua estadia na Prefeitura de Ehime',
    welcomeTitle: 'Bem-vindo ao Kotoha AI',
    welcomeDesc: 'Crie uma conta para tornar sua estadia na Prefeitura de Ehime mais confortável',
    loginTitle: 'Entrar',
    signupTitle: 'Criar Conta',
    email: 'Endereço de Email',
    password: 'Senha',
    passwordConfirm: 'Confirmar Senha',
    loginBtn: 'Entrar',
    signupBtn: 'Criar Conta',
    googleLoginBtn: 'Entrar com Google',
    guestLoginBtn: 'Usar como Convidado',
    showSignupBtn: 'Criar Conta',
    showLoginBtn: 'Voltar ao Login',
    profileTitle: 'Configuração do Perfil',
    profileDesc: 'Forneça suas informações básicas para melhor suporte',
    displayName: 'Nome de Exibição',
    nationality: 'Nacionalidade',
    primaryLanguage: 'Idioma Principal',
    stayLocation: 'Local de Estadia',
    stayPurpose: 'Propósito',
    stayPeriod: 'Período de Estadia',
    saveProfileBtn: 'Salvar Perfil',
    consultationTitle: 'Consulta de IA',
    consultationDesc: 'Selecione uma categoria e faça perguntas livremente',
    categoryTitle: 'Categoria',
    historyTitle: 'Histórico de Consultas',
    historyDesc: 'Veja seus registros de consultas anteriores',
    backToConsultation: 'Voltar à Consulta',
    exportHistory: 'Exportar Histórico',
    noHistory: 'Ainda não há histórico de consultas.',
    logout: 'Sair',
    select: 'Selecionar'
  },
  ru: {
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'ИИ-помощник для вашего пребывания в префектуре Эхимэ',
    welcomeTitle: 'Добро пожаловать в Kotoha AI',
    welcomeDesc: 'Создайте аккаунт, чтобы сделать ваше пребывание в префектуре Эхимэ более комфортным',
    loginTitle: 'Войти',
    signupTitle: 'Создать Аккаунт',
    email: 'Электронная Почта',
    password: 'Пароль',
    passwordConfirm: 'Подтвердить Пароль',
    loginBtn: 'Войти',
    signupBtn: 'Создать Аккаунт',
    googleLoginBtn: 'Войти через Google',
    guestLoginBtn: 'Использовать как Гость',
    showSignupBtn: 'Создать Аккаунт',
    showLoginBtn: 'Вернуться к Входу',
    profileTitle: 'Настройка Профиля',
    profileDesc: 'Предоставьте вашу основную информацию для лучшей поддержки',
    displayName: 'Отображаемое Имя',
    nationality: 'Национальность',
    primaryLanguage: 'Основной Язык',
    stayLocation: 'Место Пребывания',
    stayPurpose: 'Цель',
    stayPeriod: 'Период Пребывания',
    saveProfileBtn: 'Сохранить Профиль',
    consultationTitle: 'ИИ-Консультация',
    consultationDesc: 'Выберите категорию и свободно задавайте вопросы',
    categoryTitle: 'Категория',
    historyTitle: 'История Консультаций',
    historyDesc: 'Просмотрите ваши предыдущие записи консультаций',
    backToConsultation: 'Вернуться к Консультации',
    exportHistory: 'Экспорт Истории',
    noHistory: 'Пока нет истории консультаций.',
    logout: 'Выйти',
    select: 'Выбрать'
  }
};

// --- Firebase Initialization ---
async function initializeFirebaseAndRunApp() {
    try {
        const response = await fetch('/api/firebase-config');
        if (!response.ok) {
            throw new Error(`Firebase config fetch failed: ${response.statusText}`);
        }
        const firebaseConfig = await response.json();

        if (!firebaseConfig.apiKey) {
             throw new Error('Firebase API Key not found. Check server configuration.');
        }

        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Run the main app logic after Firebase is initialized
        runApp();

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("Application failed to start. Please contact the administrator.", "error");
    }
}

// Start the initialization process when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeFirebaseAndRunApp);


// --- Main Application Logic ---
function runApp() {
    console.log('App is running...');
    
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
    const stepIndicators = document.querySelectorAll('.step');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const categoryCards = document.querySelectorAll('.category-card');
    const selectedCategoryBox = document.getElementById('selected-category');
    const selectedCategoryName = document.getElementById('selected-category-name');
    const clearCategoryBtn = document.getElementById('clear-category-btn');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const storeConsultationCheckbox = document.getElementById('store-consultation');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
    const exportHistoryBtn = document.getElementById('export-history-btn');

    // --- Utility Functions (scoped to runApp) ---

    function showMessage(text, type = 'info') {
        console.log(`Message: ${text} (${type})`);
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
            position: fixed; top: 20px; right: 20px; background-color: ${bgColor}; color: white;
            padding: 1rem; border-radius: 8px; z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transform: translateY(-20px);
            transition: opacity 0.3s ease, transform 0.3s ease; max-width: 90%; word-wrap: break-word;
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

    function handleAuthError(error) {
        console.error('Auth error:', error);
        let msg = 'エラーが発生しました。';
        if (error.code) {
            switch (error.code) {
                case 'auth/user-not-found': msg = 'ユーザーが存在しません。'; break;
                case 'auth/wrong-password': msg = 'パスワードが間違っています。'; break;
                case 'auth/email-already-in-use': msg = 'このメールアドレスは既に使われています。'; break;
                case 'auth/invalid-email': msg = '無効なメールアドレスです。'; break;
                case 'auth/weak-password': msg = 'パスワードは6文字以上で入力してください。'; break;
                default: msg = error.message;
            }
        }
        showMessage(msg, 'error');
    }

    function updateProgress() {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            const progressPercentage = currentSection > 1 ? ((currentSection - 1) / 3) * 100 : 0;
            progressFill.style.width = `${progressPercentage}%`;
        }
    }

    function updateStepIndicators() {
        stepIndicators.forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            step.classList.toggle('active', stepNum === currentSection);
        });
    }
    
    function showSection(sectionNum) {
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        const target = document.getElementById(`section-${sectionNum}`);
        if (target) {
            target.classList.add('active');
            currentSection = sectionNum;
            updateProgress();
            updateStepIndicators();
            if (sectionNum === 4) {
                loadConsultationHistory();
            }
        }
    }
    
    function scrollToBottom() {
        if (!chatMessages) return;
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    function appendChatMessage(type, htmlContent) {
        if (!chatMessages) return;
        const isAI = type === 'ai';
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isAI ? 'ai-message' : 'user-message'}`;
        const avatar = isAI ? '🤖' : '🧑';
        const senderName = isAI ? 'Kotoha AI' : (currentUser?.displayName || currentUser?.email || 'あなた');
        const contentToShow = isAI ? htmlContent : htmlContent.replace(/\n/g, '<br>');

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble">${contentToShow}</div>
                <div class="message-time">${senderName} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function appendTypingIndicator() {
        if (!chatMessages) return;
        const indicatorHTML = `
            <div class="message ai-message" id="typing-indicator">
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="message-bubble">
                        <div class="typing-dots"><span></span><span></span><span></span></div>
                    </div>
                </div>
            </div>`;
        chatMessages.insertAdjacentHTML('beforeend', indicatorHTML);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    // --- Initialization and Event Listeners ---

    // Auth State Change
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const displayName = user.displayName || user.email || 'ゲスト';
            userInfo.style.display = 'flex';
            userDisplay.textContent = displayName;
            authContainer.style.display = 'none';
            logoutBtn.style.display = 'block';

            const userRef = doc(db, 'kotoha_users', user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    createdAt: Timestamp.now(),
                    isAnonymous: user.isAnonymous
                }, { merge: true });
                showSection(2); // New user, guide to profile
            } else {
                await loadProfileFormFromFirestore();
                const profile = userSnap.data().profile;
                // If profile is incomplete, stay on profile page
                if (profile && profile.displayName && profile.primaryLanguage) {
                     showSection(3);
                } else {
                     showSection(2);
                }
            }
        } else {
            currentUser = null;
            userInfo.style.display = 'none';
            authContainer.style.display = 'block';
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            logoutBtn.style.display = 'none';
            clearProfileForm();
            showSection(1);
        }
    });

    getRedirectResult(auth).catch(handleAuthError);

    // Form Switching
    showSignupBtn.addEventListener('click', () => {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    });
    showLoginBtn.addEventListener('click', () => {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Auth Actions
    loginBtn.addEventListener('click', () => {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;
        if (!email || !password) return showMessage('メールアドレスとパスワードを入力してください。', 'error');
        signInWithEmailAndPassword(auth, email, password).catch(handleAuthError);
    });

    signupBtn.addEventListener('click', () => {
        const email = signupEmailInput.value.trim();
        const password = signupPasswordInput.value;
        const confirm = signupPasswordConfirmInput.value;
        if (!email || !password) return showMessage('メールアドレスとパスワードを入力してください。', 'error');
        if (password.length < 6) return showMessage('パスワードは6文字以上で入力してください。', 'error');
        if (password !== confirm) return showMessage('パスワードが一致しません。', 'error');
        createUserWithEmailAndPassword(auth, email, password).catch(handleAuthError);
    });

    googleLoginBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            if (error.code === 'auth/popup-blocked') {
                showMessage('ポップアップがブロックされました。リダイレクトを試みます。', 'warning');
                signInWithRedirect(auth, provider);
            } else {
                handleAuthError(error);
            }
        });
    });

    guestLoginBtn.addEventListener('click', () => signInAnonymously(auth).catch(handleAuthError));
    logoutBtn.addEventListener('click', () => signOut(auth).catch(handleAuthError));
    
    // Profile
    saveProfileBtn.addEventListener('click', async () => {
        if (!currentUser) return showMessage('ログインが必要です。', 'error');
        const profileData = {
            displayName: document.getElementById('display-name').value,
            nationality: document.getElementById('nationality').value,
            primaryLanguage: document.getElementById('primary-language').value,
            stayLocation: document.getElementById('stay-location').value,
            stayPurpose: document.getElementById('stay-purpose').value,
            stayFrom: document.getElementById('stay-from').value,
            stayTo: document.getElementById('stay-to').value,
        };
        try {
            await setDoc(doc(db, 'kotoha_users', currentUser.uid), { profile: profileData }, { merge: true });
            showMessage('プロフィールを保存しました。', 'success');
            userDisplay.textContent = profileData.displayName || currentUser.email || 'ゲスト';
            showSection(3);
        } catch (e) {
            showMessage('プロフィールの保存に失敗しました。', 'error');
        }
    });

    // Chat
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) handleSendMessage();
        }
    });
    chatInput.addEventListener('input', updateSendButtonState);
    
    clearChatBtn.addEventListener('click', () => {
        if (confirm('チャット履歴をクリアしますか？')) {
            chatMessages.innerHTML = ''; // Simple clear
        }
    });
    
    storeConsultationCheckbox.addEventListener('change', (e) => {
        shouldStoreConsultation = e.target.checked;
    });

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            selectedCategory = category;
            categoryCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            updateSendButtonState();
        });
    });

    // Navigation
    stepIndicators.forEach(step => {
        step.addEventListener('click', () => {
            const targetSection = parseInt(step.dataset.step);
            if (!currentUser && targetSection > 1) {
                return showMessage('この機能を利用するにはログインまたはゲストとして続行してください。', 'warning');
            }
            showSection(targetSection);
        });
    });
    
    backToConsultationBtn.addEventListener('click', () => showSection(3));
    exportHistoryBtn.addEventListener('click', exportHistory);
    
    // Initial UI setup
    updatePageTexts();
    updateSendButtonState();
    adjustChatHeight();
    window.addEventListener('resize', adjustChatHeight);
}

// --- Helper Functions (can be accessed within runApp) ---

function updateSendButtonState() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const hasInput = chatInput.value.trim().length > 0;
    sendButton.disabled = !hasInput || isAIChatting;
}

function adjustChatHeight() {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        const topOffset = chatContainer.getBoundingClientRect().top;
        const newHeight = window.innerHeight - topOffset - 150; // Adjust 150 for input box and padding
        chatContainer.style.height = `${Math.max(200, newHeight)}px`;
    }
}

async function handleSendMessage() {
    const chatInput = document.getElementById('chat-input');
    const userMessage = chatInput.value.trim();
    if (!userMessage || isAIChatting) return;

    appendChatMessage('user', userMessage);
    chatInput.value = '';
    isAIChatting = true;
    updateSendButtonState();
    appendTypingIndicator();

    try {
        let userProfile = null;
        if (currentUser) {
            const userSnap = await getDoc(doc(db, 'kotoha_users', currentUser.uid));
            if (userSnap.exists()) userProfile = userSnap.data().profile;
        }
        
        const recentConversations = await getRecentConversations(3);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                context: { category: selectedCategory, userProfile, recentConversations }
            }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Server error');
        }

        const data = await response.json();
        const aiResponseHtml = marked.parse(data.response);
        appendChatMessage('ai', aiResponseHtml);
        
        if (shouldStoreConsultation) {
            await saveConversation(userMessage, data.response, selectedCategory);
        }

    } catch (error) {
        console.error('AI chat error:', error);
        appendChatMessage('ai', '申し訳ありません、エラーが発生しました。しばらくしてからもう一度お試しください。');
    } finally {
        removeTypingIndicator();
        isAIChatting = false;
        updateSendButtonState();
    }
}

async function saveConversation(userMessage, aiResponse, category) {
    if (!currentUser) return;
    try {
        const conversationsRef = collection(db, 'kotoha_users', currentUser.uid, 'conversations');
        await addDoc(conversationsRef, {
            timestamp: Timestamp.now(),
            category: category || 'general',
            userMessage,
            aiResponse,
        });
    } catch (error) {
        console.error('Failed to save conversation:', error);
    }
}

async function getRecentConversations(count) {
    if (!currentUser) return [];
    try {
        const q = query(collection(db, 'kotoha_users', currentUser.uid, 'conversations'), orderBy('timestamp', 'desc'), limit(count));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data()).reverse();
    } catch (error) {
        console.error('Failed to get recent conversations:', error);
        return [];
    }
}

async function loadConsultationHistory() {
    const historyContainer = document.getElementById('consultation-history');
    if (!currentUser) {
        historyContainer.innerHTML = `<div class="no-history"><p>ログインしてください。</p></div>`;
        return;
    }
    
    try {
        const q = query(collection(db, 'kotoha_users', currentUser.uid, 'conversations'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            historyContainer.innerHTML = `<div class="no-history"><p>${translations[currentLanguage].noHistory}</p></div>`;
            return;
        }
        
        let historyHTML = '';
        snapshot.forEach(doc => {
            const conv = doc.data();
            const date = conv.timestamp.toDate();
            const formattedDate = date.toLocaleString(currentLanguage === 'ja' ? 'ja-JP' : 'en-US');
            historyHTML += `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-date">${formattedDate}</span>
                        <span class="history-category">${conv.category}</span>
                    </div>
                    <div class="history-content">
                        <p><strong>Q:</strong> ${conv.userMessage}</p>
                        <p><strong>A:</strong> ${conv.aiResponse.substring(0, 150)}...</p>
                    </div>
                </div>`;
        });
        historyContainer.innerHTML = historyHTML;
    } catch (error) {
        console.error("Failed to load history:", error);
        historyContainer.innerHTML = `<div class="no-history"><p>履歴の読み込みに失敗しました。</p></div>`;
    }
}

async function exportHistory() {
    // This function can be implemented later
    showMessage('エクスポート機能は現在開発中です。', 'info');
}

async function loadProfileFormFromFirestore() {
    if (!currentUser) return;
    try {
        const snap = await getDoc(doc(db, 'kotoha_users', currentUser.uid));
        if (snap.exists() && snap.data().profile) {
            const data = snap.data().profile;
            document.getElementById('display-name').value = data.displayName || '';
            document.getElementById('nationality').value = data.nationality || '';
            document.getElementById('primary-language').value = data.primaryLanguage || '';
            document.getElementById('stay-location').value = data.stayLocation || '';
            document.getElementById('stay-purpose').value = data.stayPurpose || '';
            document.getElementById('stay-from').value = data.stayFrom || '';
            document.getElementById('stay-to').value = data.stayTo || '';
        }
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

function clearProfileForm() {
    document.getElementById('profile-form').reset();
}

function updatePageTexts() {
    const t = translations[currentLanguage];
    if (!t) return;
    // This is a simplified version. You can expand it to cover all elements.
    document.querySelector('.subtitle').textContent = t.headerSubtitle;
    document.querySelector('#section-1 h2').textContent = t.welcomeTitle;
    document.querySelector('#login-btn').textContent = t.loginBtn;
    // ... and so on for all other elements
}

function switchLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        updatePageTexts();
    }
}
