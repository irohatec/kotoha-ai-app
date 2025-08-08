// Firebase v10.12.2 本番版 app.js (ログアウト機能修正)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
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

// --- App Check Initialization ---
// const appCheck = initializeAppCheck(app, {
//   provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_V3_SITE_KEY'),
//   isTokenAutoRefreshEnabled: true
// });

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentSection = 1;
let selectedCategory = '';
let isAIChatting = false;

document.addEventListener('DOMContentLoaded', () => {
  // --- UI Element References ---
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authContainer = document.getElementById('auth-container');
  const loginBtn = document.getElementById('login-btn');
  const showSignupBtn = document.getElementById('show-signup-btn');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const guestLoginBtn = document.getElementById('guest-login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const showLoginBtn = document.getElementById('show-login-btn');
  const userInfo = document.getElementById('user-info');
  const userDisplay = document.getElementById('user-display-name');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  // ▼▼▼ ログアウトボタンの参照を追加 ▼▼▼
  const logoutBtn = document.getElementById('logout-btn');

  // --- Form Switching ---
  if (showSignupBtn) showSignupBtn.addEventListener('click', () => { loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
  if (showLoginBtn) showLoginBtn.addEventListener('click', () => { signupForm.style.display = 'none'; loginForm.style.display = 'block'; });

  // --- Auth Functions ---
  const handleEmailLogin = () => { /* ... (変更なし) ... */ };
  const handleCreateAccount = () => { /* ... (変更なし) ... */ };
  const handleGoogleLogin = () => { /* ... (変更なし) ... */ };
  const handleGuestLogin = () => { /* ... (変更なし) ... */ };
  const handleLogout = () => {
    signOut(auth).catch(error => {
        console.error('ログアウト中にエラーが発生しました:', error);
        showMessage(`ログアウトエラー: ${error.message}`, 'error');
    });
  };

  // --- Auth Event Listeners ---
  if (loginBtn) loginBtn.addEventListener('click', handleEmailLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleCreateAccount);
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
  if (guestLoginBtn) guestLoginBtn.addEventListener('click', handleGuestLogin);
  // ▼▼▼ ログアウトボタンのイベントリスナーをここに追加 ▼▼▼
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // ▲▲▲ 複雑な setupLogoutButton 関数は不要になったため削除 ▲▲▲

  // --- Auth State Change Listener ---
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const displayName = user.displayName || user.email || 'ゲスト';
      
      if (userInfo) userInfo.style.display = 'flex';
      if (userDisplay) userDisplay.textContent = displayName;
      if (authContainer) authContainer.style.display = 'none';

      // setupLogoutButtonの呼び出しは不要
      
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

      if (currentSection === 1) {
        showSection(2);
      }
    } else {
      currentUser = null;
      if (userInfo) userInfo.style.display = 'none';
      if (authContainer) authContainer.style.display = 'block';
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
      showSection(1);
    }
  });

  getRedirectResult(auth).catch(handleAuthError);
  
  // --- Profile Save ---
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', async () => { /* ... (変更なし) ... */ });
  if (backToConsultationBtn) backToConsultationBtn.addEventListener('click', () => showSection(3));

  // --- AI相談画面の全機能を実装 ---
  
  // 1. 上部ナビゲーションボタン
  document.querySelectorAll('.step').forEach(step => { /* ... (変更なし) ... */ });

  // 2. 相談カテゴリの選択機能
  document.querySelectorAll('.category-card').forEach(card => { /* ... (変更なし) ... */ });

  // 3. 質問入力と送信ボタンの有効/無効化
  const updateSendButtonState = () => { /* ... (変更なし) ... */ };
  if(chatInput) chatInput.addEventListener('input', updateSendButtonState);

  // 4. チャットクリア機能
  if (clearChatBtn) { /* ... (変更なし) ... */ }

  // 5. 送信ボタンのクリック処理 (AI呼び出し)
  if (sendButton) sendButton.addEventListener('click', handleSendMessage);
  if(chatInput) chatInput.addEventListener('keypress', (e) => { /* ... (変更なし) ... */ });
  
  // 6. サンプル質問のクリック処理
  document.querySelectorAll('.question-chip').forEach(chip => { /* ... (変更なし) ... */ });

  // AIにメッセージを送信し、応答を受け取るメインの関数
  async function handleSendMessage() { /* ... (変更なし) ... */ }
});

// --- Utility Functions ---
// (これ以降の関数は変更ありません)
function appendChatMessage(sender, htmlContent) { /* ... */ }
function appendInitialAIMessage() { /* ... */ }
function appendTypingIndicator() { /* ... */ }
function removeTypingIndicator() { /* ... */ }
async function loadProfileFormFromFirestore() { /* ... */ }
function showSection(sectionNum) { /* ... */ }
function updateStepIndicators() { /* ... */ }
function updateProgress() { /* ... */ }
function handleAuthError(error) { /* ... */ }
function showMessage(message, type = 'info') { /* ... */ }
