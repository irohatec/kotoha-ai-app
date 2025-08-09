// Firebase v10.12.2 本番版 app.js - さらに改良版

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
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAW9NZHS6Gj9MYQiMnczwnGyq1eGfYq63U",
  authDomain: "kotoha-personalize-app.firebaseapp.com",
  projectId: "kotoha-personalize-app",
  storageBucket: "kotoha-personalize-app.appspot.com",
  messagingSenderId: "400606506364",
  appId: "1:400606506364:web:bfb9d0554b111fbd1a08f9",
  databaseURL: "https://kotoha-personalize-app-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentSection = 1;
let selectedCategory = '';
let shouldStoreConsultation = true;
let isAIChatting = false;
let currentLanguage = 'ja'; // デフォルトは日本語

// 多言語辞書
const translations = {
  ja: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: '愛媛県での滞在をサポートするAIアシスタント',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'プロフィール設定',
    profileDesc: 'より適切なサポートを提供するため、基本情報を教えてください',
    displayName: '表示名',
    nationality: '国籍',
    primaryLanguage: '使用する言語',
    stayLocation: '滞在地域',
    stayPurpose: '滞在目的',
    stayPeriod: '滞在期間',
    saveProfileBtn: 'プロフィール保存',
    
    // 相談画面
    consultationTitle: 'AI相談',
    consultationDesc: 'カテゴリを選択して、気軽にご質問ください',
    categoryTitle: '相談カテゴリ',
    
    // 履歴画面
    historyTitle: '相談履歴',
    historyDesc: '過去の相談内容を確認できます',
    
    // 共通
    logout: 'ログアウト',
    select: '選択してください'
  },
  en: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'AI Assistant for Your Stay in Ehime Prefecture',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Profile Setup',
    profileDesc: 'Please provide your basic information for better support',
    displayName: 'Display Name',
    nationality: 'Nationality',
    primaryLanguage: 'Primary Language',
    stayLocation: 'Stay Location',
    stayPurpose: 'Purpose',
    stayPeriod: 'Stay Period',
    saveProfileBtn: 'Save Profile',
    
    // 相談画面
    consultationTitle: 'AI Consultation',
    consultationDesc: 'Select a category and feel free to ask questions',
    categoryTitle: 'Category',
    
    // 履歴画面
    historyTitle: 'Consultation History',
    historyDesc: 'View your past consultation records',
    
    // 共通
    logout: 'Logout',
    select: 'Select'
  },
  ko: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: '에히메현 체류를 지원하는 AI 어시스턴트',
    
    // 認証画面
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
    
    // プロフィール画면
    profileTitle: '프로필 설정',
    profileDesc: '더 적절한 지원을 제공하기 위해 기본 정보를 알려주세요',
    displayName: '표시 이름',
    nationality: '국적',
    primaryLanguage: '사용 언어',
    stayLocation: '체류 지역',
    stayPurpose: '체류 목적',
    stayPeriod: '체류 기간',
    saveProfileBtn: '프로필 저장',
    
    // 相談画면
    consultationTitle: 'AI 상담',
    consultationDesc: '카테고리를 선택하고 편하게 질문해 주세요',
    categoryTitle: '상담 카테고리',
    
    // 履歴画면
    historyTitle: '상담 이력',
    historyDesc: '과거 상담 내용을 확인할 수 있습니다',
    
    // 共通
    logout: '로그아웃',
    select: '선택해 주세요'
  },
  zh: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: '支持爱媛县居留的AI助理',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: '个人资料设置',
    profileDesc: '为了提供更合适的支持，请告诉我们您的基本信息',
    displayName: '显示姓名',
    nationality: '国籍',
    primaryLanguage: '使用语言',
    stayLocation: '居留地区',
    stayPurpose: '居留目的',
    stayPeriod: '居留期间',
    saveProfileBtn: '保存个人资料',
    
    // 相談画面
    consultationTitle: 'AI咨询',
    consultationDesc: '请选择类别，随时提问',
    categoryTitle: '咨询类别',
    
    // 履歴画面
    historyTitle: '咨询历史',
    historyDesc: '您可以查看过往的咨询内容',
    
    // 共通
    logout: '退出登录',
    select: '请选择'
  },
  es: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Asistente de IA para tu estancia en la Prefectura de Ehime',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Configuración del Perfil',
    profileDesc: 'Proporcione su información básica para un mejor soporte',
    displayName: 'Nombre para Mostrar',
    nationality: 'Nacionalidad',
    primaryLanguage: 'Idioma Principal',
    stayLocation: 'Ubicación de Estancia',
    stayPurpose: 'Propósito',
    stayPeriod: 'Período de Estancia',
    saveProfileBtn: 'Guardar Perfil',
    
    // 相談画面
    consultationTitle: 'Consulta AI',
    consultationDesc: 'Selecciona una categoría y haz preguntas libremente',
    categoryTitle: 'Categoría',
    
    // 履歴画面
    historyTitle: 'Historial de Consultas',
    historyDesc: 'Ver tus registros de consultas anteriores',
    
    // 共通
    logout: 'Cerrar Sesión',
    select: 'Seleccionar'
  },
  fr: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Assistant IA pour votre séjour dans la Préfecture d\'Ehime',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Configuration du Profil',
    profileDesc: 'Veuillez fournir vos informations de base pour un meilleur support',
    displayName: 'Nom d\'Affichage',
    nationality: 'Nationalité',
    primaryLanguage: 'Langue Principale',
    stayLocation: 'Lieu de Séjour',
    stayPurpose: 'Objectif',
    stayPeriod: 'Période de Séjour',
    saveProfileBtn: 'Sauvegarder le Profil',
    
    // 相談画面
    consultationTitle: 'Consultation IA',
    consultationDesc: 'Sélectionnez une catégorie et posez vos questions librement',
    categoryTitle: 'Catégorie',
    
    // 履歴画面
    historyTitle: 'Historique des Consultations',
    historyDesc: 'Voir vos enregistrements de consultations précédentes',
    
    // 共通
    logout: 'Se Déconnecter',
    select: 'Sélectionner'
  },
  de: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'KI-Assistent für Ihren Aufenthalt in der Präfektur Ehime',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Profil-Einrichtung',
    profileDesc: 'Bitte geben Sie Ihre grundlegenden Informationen für bessere Unterstützung an',
    displayName: 'Anzeigename',
    nationality: 'Nationalität',
    primaryLanguage: 'Hauptsprache',
    stayLocation: 'Aufenthaltsort',
    stayPurpose: 'Zweck',
    stayPeriod: 'Aufenthaltsdauer',
    saveProfileBtn: 'Profil Speichern',
    
    // 相談画面
    consultationTitle: 'KI-Beratung',
    consultationDesc: 'Wählen Sie eine Kategorie und stellen Sie frei Fragen',
    categoryTitle: 'Kategorie',
    
    // 履歴画面
    historyTitle: 'Beratungshistorie',
    historyDesc: 'Sehen Sie Ihre vorherigen Beratungsaufzeichnungen',
    
    // 共通
    logout: 'Abmelden',
    select: 'Auswählen'
  },
  it: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Assistente AI per il tuo soggiorno nella Prefettura di Ehime',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Configurazione Profilo',
    profileDesc: 'Fornisci le tue informazioni di base per un migliore supporto',
    displayName: 'Nome Visualizzato',
    nationality: 'Nazionalità',
    primaryLanguage: 'Lingua Principale',
    stayLocation: 'Luogo di Soggiorno',
    stayPurpose: 'Scopo',
    stayPeriod: 'Periodo di Soggiorno',
    saveProfileBtn: 'Salva Profilo',
    
    // 相談画面
    consultationTitle: 'Consulenza AI',
    consultationDesc: 'Seleziona una categoria e fai domande liberamente',
    categoryTitle: 'Categoria',
    
    // 履歴画面
    historyTitle: 'Cronologia Consultazioni',
    historyDesc: 'Visualizza i tuoi record di consultazioni precedenti',
    
    // 共通
    logout: 'Disconnetti',
    select: 'Seleziona'
  },
  pt: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'Assistente de IA para sua estadia na Prefeitura de Ehime',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Configuração do Perfil',
    profileDesc: 'Forneça suas informações básicas para melhor suporte',
    displayName: 'Nome de Exibição',
    nationality: 'Nacionalidade',
    primaryLanguage: 'Idioma Principal',
    stayLocation: 'Local de Estadia',
    stayPurpose: 'Propósito',
    stayPeriod: 'Período de Estadia',
    saveProfileBtn: 'Salvar Perfil',
    
    // 相談画面
    consultationTitle: 'Consulta de IA',
    consultationDesc: 'Selecione uma categoria e faça perguntas livremente',
    categoryTitle: 'Categoria',
    
    // 履歴画面
    historyTitle: 'Histórico de Consultas',
    historyDesc: 'Veja seus registros de consultas anteriores',
    
    // 共通
    logout: 'Sair',
    select: 'Selecionar'
  },
  ru: {
    // ヘッダー
    headerTitle: 'Kotoha AI',
    headerSubtitle: 'ИИ-помощник для вашего пребывания в префектуре Эхимэ',
    
    // 認証画面
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
    
    // プロフィール画面
    profileTitle: 'Настройка Профиля',
    profileDesc: 'Предоставьте вашу основную информацию для лучшей поддержки',
    displayName: 'Отображаемое Имя',
    nationality: 'Национальность',
    primaryLanguage: 'Основной Язык',
    stayLocation: 'Место Пребывания',
    stayPurpose: 'Цель',
    stayPeriod: 'Период Пребывания',
    saveProfileBtn: 'Сохранить Профиль',
    
    // 相談画면
    consultationTitle: 'ИИ-Консультация',
    consultationDesc: 'Выберите категорию и свободно задавайте вопросы',
    categoryTitle: 'Категория',
    
    // 履歴画面
    historyTitle: 'История Консультаций',
    historyDesc: 'Просмотрите ваши предыдущие записи консультаций',
    
    // 共通
    logout: 'Выйти',
    select: 'Выбрать'
  }
};

// 言語切り替え関数
function switchLanguage(langCode) {
  currentLanguage = langCode;
  
  // ヘッダーボタンの状態更新
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`lang-${langCode}`).classList.add('active');
  
  // テキスト更新
  updatePageTexts();
}

// ページテキスト更新関数
function updatePageTexts() {
  const t = translations[currentLanguage];
  
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
  
  // ログアウトボタン
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.textContent = t.logout;
  
  // セレクトボックスのデフォルトオプション
  document.querySelectorAll('select option[value=""]').forEach(option => {
    option.textContent = t.select;
  });
}

// 質問とカテゴリのマッピング
const questionToCategory = {
  'バスの乗り方がわかりません。どうすればいいですか？': 'transportation',
  '病院に行きたいのですが、予約は必要ですか？': 'medical',
  'Wi-Fiが使える場所を教えてください。': 'connectivity',
  '日本のマナーで注意すべきことはありますか？': 'culture',
  '緊急時はどこに連絡すればいいですか？': 'general'
};

// 質問からカテゴリを推測する関数
function guessCategory(userMessage) {
  const message = userMessage.toLowerCase();
  
  // 交通関連キーワード
  if (message.includes('バス') || message.includes('電車') || message.includes('交通') || 
      message.includes('移動') || message.includes('タクシー') || message.includes('アクセス') ||
      message.includes('train') || message.includes('bus') || message.includes('transport')) {
    return 'transportation';
  }
  
  // 医療関連キーワード
  if (message.includes('病院') || message.includes('医療') || message.includes('薬') || 
      message.includes('体調') || message.includes('風邪') || message.includes('怪我') ||
      message.includes('hospital') || message.includes('doctor') || message.includes('medicine')) {
    return 'medical';
  }
  
  // ネット関連キーワード
  if (message.includes('wifi') || message.includes('wi-fi') || message.includes('インターネット') || 
      message.includes('sim') || message.includes('スマホ') || message.includes('通信') ||
      message.includes('internet') || message.includes('network')) {
    return 'connectivity';
  }
  
  // 宿泊関連キーワード
  if (message.includes('宿泊') || message.includes('ホテル') || message.includes('民泊') || 
      message.includes('住居') || message.includes('部屋') ||
      message.includes('hotel') || message.includes('accommodation') || message.includes('room')) {
    return 'accommodation';
  }
  
  // 文化関連キーワード
  if (message.includes('文化') || message.includes('マナー') || message.includes('習慣') || 
      message.includes('礼儀') || message.includes('作法') || message.includes('お辞儀') ||
      message.includes('culture') || message.includes('manner') || message.includes('etiquette')) {
    return 'culture';
  }
  
  // デフォルトは一般相談
  return 'general';
}

// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing enhanced app...');
  
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
    primaryLanguageSelect.addEventListener('change', (e) => {
      const selectedLang = e.target.value;
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
      if (langCode) {
        switchLanguage(langCode);
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

  // --- プロフィール保存 ---
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
      
      const userRef = doc(db, 'kotoha_users', currentUser.uid);
      try {
        await setDoc(userRef, {
          profile: {
            displayName,
            nationality,
            primaryLanguage,
            stayLocation,
            stayPurpose,
            stayFrom,
            stayTo,
          }
        }, { merge: true });
        showMessage('プロフィールを保存しました。', 'success');
        showSection(3);
      } catch (e) {
        console.error('Profile save error:', e);
        showMessage('プロフィール保存に失敗しました: ' + e.message, 'error');
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

  // --- カテゴリ選択関数 ---
  function selectCategory(categoryValue) {
    console.log('Selecting category:', categoryValue);
    selectedCategory = categoryValue;
    
    if (selectedCategoryBox) {
      selectedCategoryBox.style.display = 'block';
    }
    
    // カテゴリカードを視覚的に選択状態にする
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected', 'active');
      if (card.getAttribute('data-category') === categoryValue) {
        card.classList.add('selected', 'active');
        
        if (selectedCategoryName) {
          const categoryNameElement = card.querySelector('.category-name');
          if (categoryNameElement) {
            selectedCategoryName.textContent = categoryNameElement.textContent;
          }
        }
      }
    });
    
    updateSendButton();
  }

  // --- 相談カテゴリ選択 ---
  categoryCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const categoryValue = card.getAttribute('data-category');
      selectCategory(categoryValue);
      showMessage(`${card.querySelector('.category-name').textContent} を選択しました。`, 'info');
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
      updateSendButton();
    });
  }

  // --- よくある質問クリックで入力欄に転記 + カテゴリ自動選択 ---
  document.querySelectorAll('.question-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-question') || btn.textContent.trim();
      
      if (chatInput) {
        chatInput.value = question;
        
        // 質問に対応するカテゴリを自動選択
        const relatedCategory = questionToCategory[question] || guessCategory(question);
        if (relatedCategory) {
          selectCategory(relatedCategory);
        }
        
        updateSendButton();
        chatInput.focus();
      }
    });
  });

  // --- チャット入力・送信ボタン制御 ---
  function updateSendButton() {
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

  // チャット入力のイベントリスナー
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      updateSendButton();
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

  // --- AIチャット送信（サーバーAPI使用版）- プロフィール情報を含むよう修正 ---
  async function handleSendMessage() {
    if (!chatInput || !chatInput.value.trim() || isAIChatting) {
      return;
    }
    
    const userMessage = chatInput.value.trim();
    console.log('Sending message to AI:', userMessage);
    
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
          console.log('Sending user profile:', userProfile);
        }
      }
      
      // サーバーのAI APIを呼び出し（プロフィール情報を含む）
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          userId: currentUser ? currentUser.uid : null,
          context: {
            category: selectedCategory,
            userProfile: userProfile
          }
        }),
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'サーバーでエラーが発生しました。');
      }

      const data = await response.json();
      
      // Markdownを適用してAIレスポンスを表示
      let formattedResponse = data.response;
      if (typeof marked !== 'undefined') {
        formattedResponse = marked.parse(data.response);
      }
      
      appendChatMessage('ai', formattedResponse);

    } catch (error) {
      console.error('AI chat error:', error);
      removeTypingIndicator();
      
      // フォールバック：ローカルレスポンス
      const fallbackResponse = generateBetterResponse(userMessage, selectedCategory);
      appendChatMessage('ai', fallbackResponse);
      
      showMessage('AI接続エラー。ローカル応答を表示しています。', 'warning');
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
        chatMessages.innerHTML = `
          <div class="message ai-message">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                  <div class="message-bubble">
                      こんにちは！Kotoha AIです。愛媛県での滞在に関するご質問に、なんでもお答えします。<br>
                      上記のサンプル質問をクリックするか、直接ご質問を入力してください。<br><br>
                      Hello! I'm Kotoha AI. Feel free to ask me anything about your stay in Ehime Prefecture.
                  </div>
                  <div class="message-time">Kotoha AI</div>
              </div>
          </div>
        `;
        // クリア後にスクロールを調整
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    });
  }
  
  // --- 初期表示時のテキスト更新 ---
  updatePageTexts();
});

// --- タイピングインジケーター関連 ---
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

// --- 改良されたレスポンス生成（フォールバック用） ---
function generateBetterResponse(userMessage, category) {
  const responses = {
    transportation: [
      "愛媛県の公共交通についてお答えします！\n\n松山市内では「伊予鉄バス」と「市内電車（路面電車）」が主要な交通手段です。\n\n【おすすめの移動方法】\n🚌 バス：ICカード「い～カード」が便利\n🚃 市内電車：道後温泉や松山城へのアクセスに最適\n🚗 タクシー：深夜や荷物が多い時に\n\n料金や時刻表は伊予鉄道の公式サイトで確認できます。",
      
      "愛媛での交通手段について詳しくご案内します。\n\n【エリア別アクセス】\n• 松山市内：市内電車・バスで十分\n• 今治・新居浜：JR予讃線が便利\n• しまなみ海道：レンタサイクルがおすすめ\n\n【お得情報】\n1日乗車券や観光パスもあります！\n具体的な目的地があれば、ルートをお調べしますよ。"
    ],
    medical: [
      "愛媛県での医療についてサポートします！\n\n【主要病院】\n🏥 愛媛大学医学部附属病院（東温市）\n🏥 松山赤十字病院（松山市）\n🏥 済生会松山病院（松山市）\n\n【受診の流れ】\n1. 保険証持参（国民健康保険なら3割負担）\n2. 受付で問診票記入\n3. 診察・検査\n4. 会計\n\n【緊急時】救急：119番\n医療相談：#7119（24時間）",
      
      "医療機関について詳しくお答えします。\n\n【薬局・ドラッグストア】\nマツモトキヨシ、ウエルシア、ツルハドラッグが各地にあります。\n\n【英語対応】\n松山市内の一部病院では英語対応可能です。\n事前に電話で確認することをお勧めします。\n\n【保険】\n海外旅行保険や国民健康保険について、不明点があればお聞きください。"
    ],
    connectivity: [
      "愛媛でのインターネット環境についてご案内します！\n\n【無料Wi-Fi】\n📶 松山空港・JR松山駅\n📶 コンビニ（セブン、ローソン等）\n📶 カフェ（スタバ、ドトール等）\n📶 松山市役所・図書館\n\n【SIMカード】\n家電量販店でプリペイドSIM購入可能\n\n【推奨プラン】\n短期：コンビニプリペイド\n長期：格安SIM（楽天モバイル等）",
      
      "ネット環境について詳しくサポートします。\n\n【市内Wi-Fi】\n松山市内では「Matsuyama City Wi-Fi」が利用可能です。\n\n【データプラン比較】\n• 1週間以下：プリペイドSIM（2,000-3,000円）\n• 1ヶ月程度：格安SIM（月3,000-5,000円）\n• 長期滞在：大手キャリア契約\n\n滞在期間とデータ使用量を教えていただければ、最適なプランをご提案します！"
    ],
    accommodation: [
      "愛媛での宿泊についてご案内します！\n\n【おすすめエリア】\n🏨 道後温泉周辺：温泉旅館・観光便利\n🏨 松山市駅周辺：交通アクセス良好\n🏨 大街道周辺：繁華街・買い物便利\n\n【価格目安】\nビジネスホテル：6,000-10,000円/泊\n民泊：4,000-8,000円/泊\nシェアハウス：40,000-60,000円/月\n\n予約は早めがお得です！",
      
      "住居・宿泊オプションについて詳しくお答えします。\n\n【長期滞在向け】\n• マンスリーマンション\n• シェアハウス（国際交流も可能）\n• 民泊（Airbnb等）\n\n【予約のコツ】\n平日は料金が安く、連泊割引もあります。\n\n【必要書類】\n長期滞在の場合、住民票登録が必要な場合があります。\n\nご希望の条件を詳しく教えてください！"
    ],
    culture: [
      "愛媛・日本の文化とマナーについてご説明します！\n\n【基本マナー】\n🙏 挨拶：軽いお辞儀と「おはようございます」\n👟 靴：玄関で脱ぐ（スリッパに履き替え）\n🍽️ 食事：「いただきます」「ごちそうさま」\n\n【公共交通】\n電車内での通話は控えめに\n優先席では携帯の電源OFF\n\n【愛媛特有】\n🍊 みかんは愛媛の誇り！\n♨️ 道後温泉では入浴マナーを守って",
      
      "日本・愛媛の文化について詳しくお答えします。\n\n【コミュニケーション】\n愛媛の人は温和で親切です。困った時は「すみません」と声をかけてください。\n\n【食事文化】\n• 愛媛グルメ：じゃこ天、鯛めし、みかん\n• 居酒屋では「乾杯」でスタート\n• チップの習慣はありません\n\n【季節行事】\n春：お花見、夏：祭り、秋：みかん狩り\n\n具体的なシチュエーションでのマナーもお答えできます！"
    ],
    general: [
      "愛媛での生活・観光についてお答えします！\n\n【観光スポット】\n🏯 松山城：市内中心の歴史ある城\n♨️ 道後温泉：日本最古の温泉地\n🌉 しまなみ海道：サイクリングで有名\n\n【愛媛グルメ】\n🐟 鯛めし（郷土料理）\n🐠 じゃこ天（練り物）\n🍊 愛媛みかん（11-3月が旬）\n\n【ショッピング】\n大街道・銀天街が松山の繁華街です！",
      
      "愛媛での生活について幅広くサポートします！\n\n【日用品】\nコンビニ：24時間、基本的な物は揃います\nスーパー：フジ、マルナカ、イオンが主要\n100円ショップ：ダイソー、セリア\n\n【便利アプリ】\n• Google翻訳（カメラ機能で看板翻訳）\n• Yahoo!天気（詳細な天気予報）\n\n【緊急連絡先】\n警察：110、消防・救急：119\n\n他にも知りたいことがあれば何でもお聞きください！"
    ]
  };

  const categoryResponses = responses[category] || responses.general;
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

// --- Firestore→フォーム反映関数 ---
async function loadProfileFormFromFirestore() {
  if (!currentUser) return;
  
  try {
    const userRef = doc(getFirestore(), 'kotoha_users', currentUser.uid);
    const snap = await getDoc(userRef);
    
    if (snap.exists() && snap.data().profile) {
      const data = snap.data().profile;
      console.log('Loading profile:', data);
      
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
      
      // 言語設定があれば自動でページ言語も切り替え
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
          switchLanguage(langCode);
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
