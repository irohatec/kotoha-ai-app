// Firebase v10.12.2 本番版 app.js (AI相談機能 統合)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
// App Checkはセキュリティ上重要なので残します
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
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp
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

// --- App Check（本番のみ有効化推奨） ---
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6Ld3N7YpAAAAAFuPu0xQOxk9mX2mQ9Q6mYZs1xxx'), // ←あなたのキーに合わせてください
    isTokenAutoRefreshEnabled: true,
  });
} catch (e) {
  console.warn('AppCheck init skipped:', e?.message || e);
}

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const db = getFirestore(app);

// ====== UI 参照 ======
const el = (id) => document.getElementById(id);

const progressFill = el('progress-fill');
const section1 = el('section-1');
const section2 = el('section-2');
const section3 = el('section-3');
const section4 = el('section-4');

const loginForm = el('login-form');
const signupForm = el('signup-form');

const loginEmail = el('login-email');
const loginPassword = el('login-password');
const loginBtn = el('login-btn');
const signupBtn = el('signup-btn');
const showSignupBtn = el('show-signup-btn');
const showLoginBtn = el('show-login-btn');
const googleLoginBtn = el('google-login-btn');
const guestLoginBtn = el('guest-login-btn');

const userInfo = el('user-info');
const userDisplayName = el('user-display-name');
const logoutBtn = el('logout-btn');

const saveProfileBtn = el('save-profile-btn');
const backToConsultationBtn = el('back-to-consultation-btn');

const displayNameInput = el('display-name');
const nationalityInput = el('nationality');
const stayLocationInput = el('stay-location');
const stayPurposeInput = el('stay-purpose');
const stayFromInput = el('stay-from');
const stayToInput = el('stay-to');

const chatMessages = el('chat-messages');
const chatInput = el('chat-input');
const sendButton = el('send-button');
const clearChatBtn = el('clear-chat-btn');

// ====== 画面遷移 ======
function setStep(step) {
  const steps = document.querySelectorAll('.step');
  steps.forEach((s, i) => {
    s.classList.toggle('active', i === (step - 1));
  });
  progressFill.style.width = `${Math.min(25 * step, 100)}%`;

  [section1, section2, section3, section4].forEach((sec, i) => {
    sec.classList.toggle('active', (i + 1) === step);
  });
}

// ====== 認証ハンドラ ======
if (loginBtn) loginBtn.addEventListener('click', async () => {
  if (!loginEmail.value || !loginPassword.value) return alert('メールとパスワードを入力してください');
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
  } catch (e) {
    alert(e.message || 'ログインに失敗しました');
  }
});

if (showSignupBtn) showSignupBtn.addEventListener('click', () => {
  if (loginForm) loginForm.style.display = 'none';
  if (signupForm) signupForm.style.display = 'grid';
});

if (showLoginBtn) showLoginBtn.addEventListener('click', () => {
  if (signupForm) signupForm.style.display = 'none';
  if (loginForm) loginForm.style.display = 'grid';
});

if (signupBtn) signupBtn.addEventListener('click', async () => {
  const email = el('signup-email').value;
  const pw = el('signup-password').value;
  const pw2 = el('signup-password-confirm').value;
  if (!email || !pw) return alert('メールとパスワードは必須です');
  if (pw !== pw2) return alert('パスワード確認が一致しません');
  try {
    await createUserWithEmailAndPassword(auth, email, pw);
    alert('アカウントを作成しました');
    showLoginBtn.click();
  } catch (e) {
    alert(e.message || '作成に失敗しました');
  }
});

if (googleLoginBtn) googleLoginBtn.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    // iOS/Safari 等は popup ブロックのため redirect にフォールバック
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err) {
      alert(err.message || 'Googleログインに失敗しました');
    }
  }
});

if (guestLoginBtn) guestLoginBtn.addEventListener('click', async () => {
  try {
    await signInAnonymously(auth);
  } catch (e) {
    alert(e.message || 'ゲストログインに失敗しました');
  }
});

if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (e) {
    alert(e.message || 'ログアウトに失敗しました');
  }
});

// ====== プロファイル保存 ======
async function saveProfile(uid) {
  const docRef = doc(db, 'profiles', uid);
  const languages = Array.from(document.querySelectorAll('#languages input[type="checkbox"]:checked'))
    .map(c => c.value);

  const profile = {
    displayName: displayNameInput.value || '',
    nationality: nationalityInput.value || '',
    stayLocation: stayLocationInput.value || '',
    stayPurpose: stayPurposeInput.value || '',
    stayFrom: stayFromInput.value || '',
    stayTo: stayToInput.value || '',
    languages,
    updatedAt: serverTimestamp(),
  };
  await setDoc(docRef, profile, { merge: true });
  return profile;
}

// ====== プロファイル読み込み ======
async function loadProfile(uid) {
  const docRef = doc(db, 'profiles', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : {};
}

// ====== 認証状態の監視 ======
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    userInfo && (userInfo.style.display = 'none');
    setStep(1);
    return;
  }
  userInfo && (userInfo.style.display = 'flex');
  userDisplayName && (userDisplayName.textContent = user.displayName || 'ユーザー');

  // プロファイルを読み込み
  const profile = await loadProfile(user.uid);
  displayNameInput.value = profile.displayName || '';
  nationalityInput.value = profile.nationality || '';
  stayLocationInput.value = profile.stayLocation || '';
  stayPurposeInput.value = profile.stayPurpose || '';
  stayFromInput.value = profile.stayFrom || '';
  stayToInput.value = profile.stayTo || '';
  // 言語チェック反映
  if (profile.languages?.length) {
    document.querySelectorAll('#languages input[type="checkbox"]').forEach(cb => {
      cb.checked = profile.languages.includes(cb.value);
    });
  }
  setStep(2);
});

if (saveProfileBtn) saveProfileBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('ログインしてください');
  await saveProfile(user.uid);
  alert('保存しました');
});

if (backToConsultationBtn) backToConsultationBtn.addEventListener('click', () => setStep(3));

// ====== チャット ======
function appendMessage(role, text) {
  const item = document.createElement('div');
  item.className = `message ${role === 'ai' ? 'ai-message' : 'user-message'}`;
  item.innerHTML = `
    <div class="message-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
    <div class="message-content"><div class="message-bubble">${marked.parse(text || '')}</div></div>
  `;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (sendButton) sendButton.addEventListener('click', handleSend);
if (chatInput) chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

async function handleSend() {
  const msg = (chatInput.value || '').trim();
  if (!msg) return;

  const user = auth.currentUser;
  const profile = user ? await loadProfile(user.uid) : {};

  appendMessage('user', msg);
  chatInput.value = '';
  sendButton.disabled = true;

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        userId: user ? user.uid : null,
        profile: {
          stayArea: profile.stayLocation || '愛媛県',
          lang: (profile.languages?.[0] || 'ja')
        }
      })
    });
    const data = await r.json().catch(() => ({}));
    if (data?.success) {
      appendMessage('ai', data.response || '');
    } else {
      appendMessage('ai', '申し訳ありません、エラーが発生しました。');
      console.error('AIチャットエラー:', data?.error || r.status);
    }
  } catch (e) {
    appendMessage('ai', '申し訳ありません、エラーが発生しました。');
    console.error('AIチャットエラー:', e);
  } finally {
    sendButton.disabled = false;
  }
}

if (clearChatBtn) clearChatBtn.addEventListener('click', () => {
  chatMessages.innerHTML = '';
});

// --- logout button clickability hardening (no visual changes) ---
document.addEventListener('DOMContentLoaded', () => {
  try {
    const ui  = document.getElementById('user-info');
    const btn = document.getElementById('logout-btn');
    if (ui) ui.style.pointerEvents = 'auto';
    if (btn) {
      btn.style.pointerEvents = 'auto';
      btn.style.zIndex = '10000';
      btn.style.position = 'relative';
    }
  } catch {}
});
