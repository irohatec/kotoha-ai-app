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
// Renderにデプロイ後、サイトキーを設定してこのコメントを解除してください
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

  // --- Form Switching ---
  if (showSignupBtn) showSignupBtn.addEventListener('click', () => { loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
  if (showLoginBtn) showLoginBtn.addEventListener('click', () => { signupForm.style.display = 'none'; loginForm.style.display = 'block'; });

  // --- Auth Functions ---
  const handleEmailLogin = () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
      showMessage('メールアドレスとパスワードを入力してください。', 'error');
      return;
    }
    signInWithEmailAndPassword(auth, email, password)
      .catch(handleAuthError);
  };

  const handleCreateAccount = () => {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-password-confirm').value;
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
  
  const setupLogoutButton = () => {
    const btn = document.getElementById('logout-btn');
    if (btn) {
      // 既存のリスナーをクリアして重複を防ぐ
      btn.replaceWith(btn.cloneNode(true));
      document.getElementById('logout-btn').addEventListener('click', handleLogout);
    }
  };

  // --- Auth State Change Listener ---
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const displayName = user.displayName || user.email || 'ゲスト';
      
      if (userInfo) userInfo.style.display = 'flex';
      if (userDisplay) userDisplay.textContent = displayName;
      if (authContainer) authContainer.style.display = 'none';

      setupLogoutButton();

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
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', async () => {
      if (!currentUser) return showMessage('ログインが必要です。', 'error');
      const profileData = {
          displayName: document.getElementById('display-name')?.value ?? '',
          nationality: document.getElementById('nationality')?.value ?? '',
          stayLocation: document.getElementById('stay-location')?.value ?? '',
          stayPurpose: document.getElementById('stay-purpose')?.value ?? '',
          stayFrom: document.getElementById('stay-from')?.value ?? '',
          stayTo: document.getElementById('stay-to')?.value ?? '',
          languages: Array.from(document.querySelectorAll('#languages input[type="checkbox"]:checked')).map(cb => cb.value),
      };
      try {
        await setDoc(doc(db, 'kotoha_users', currentUser.uid), { profile: profileData }, { merge: true });
        showMessage('プロフィールを保存しました。', 'success');
        showSection(3);
      } catch (e) {
        showMessage('プロフィール保存失敗: ' + e.message, 'error');
      }
  });
  if (backToConsultationBtn) backToConsultationBtn.addEventListener('click', () => showSection(3));

  // --- AI相談画面の全機能を実装 ---

  // 1. 上部ナビゲーションボタン
  document.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
      const sectionNum = parseInt(step.dataset.step);
      if (!currentUser && sectionNum > 1) {
        showMessage('この機能を利用するにはログインが必要です。', 'warning');
        return;
      }
      showSection(sectionNum);
    });
  });

  // 2. 相談カテゴリの選択機能
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      selectedCategory = this.dataset.category;
      const categoryName = this.querySelector('.category-name').textContent;
      showMessage(`${categoryName} を選択しました。`, 'info');
      updateSendButtonState();
    });
  });

  // 3. 質問入力と送信ボタンの有効/無効化
  const updateSendButtonState = () => {
    sendButton.disabled = chatInput.value.trim() === '' || isAIChatting;
  };
  chatInput.addEventListener('input', updateSendButtonState);

  // 4. チャットクリア機能
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      chatMessages.innerHTML = '';
      appendInitialAIMessage();
      showMessage('チャットをクリアしました。', 'info');
    });
  }

  // 5. 送信ボタンのクリック処理 (AI呼び出し)
  if (sendButton) {
    sendButton.addEventListener('click', handleSendMessage);
  }
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  
  // 6. サンプル質問のクリック処理
  document.querySelectorAll('.question-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const question = chip.textContent.trim();
      chatInput.value = question;
      handleSendMessage();
    });
  });

  // AIにメッセージを送信し、応答を受け取るメインの関数
  async function handleSendMessage() {
    const userMessage = chatInput.value.trim();
    if (userMessage === '' || isAIChatting) return;

    appendChatMessage('user', userMessage);
    chatInput.value = '';
    isAIChatting = true;
    updateSendButtonState();
    appendTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          userId: currentUser ? currentUser.uid : null,
          context: {
            category: selectedCategory
          }
        }),
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'サーバーでエラーが発生しました。');
      }

      const data = await response.json();
      const formattedResponse = marked.parse(data.response);
      appendChatMessage('ai', formattedResponse);

    } catch (error) {
      console.error('AIチャットエラー:', error);
      removeTypingIndicator();
      appendChatMessage('ai', `申し訳ありません、エラーが発生しました。<br>${error.message}`);
    } finally {
      isAIChatting = false;
      updateSendButtonState();
    }
  }
});

// --- Utility Functions ---

function appendChatMessage(sender, htmlContent) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  
  const avatar = sender === 'ai' ? '🤖' : '👤';
  const senderName = sender === 'ai' ? 'Kotoha AI' : 'あなた';

  messageDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
        <div class="message-bubble">${htmlContent}</div>
        <div class="message-time">${senderName}</div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendInitialAIMessage() {
  const initialHTML = `こんにちは！Kotoha AIです。愛媛県での滞在に関するご質問に、なんでもお答えします。<br>
    上記のサンプル質問をクリックするか、直接ご質問を入力してください。<br><br>
    Hello! I'm Kotoha AI. Feel free to ask me anything about your stay in Ehime Prefecture.`;
  appendChatMessage('ai', initialHTML);
}

function appendTypingIndicator() {
  const chatMessages = document.getElementById('chat-messages');
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
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

async function loadProfileFormFromFirestore() {
  if (!currentUser) return;
  const userRef = doc(getFirestore(), 'kotoha_users', currentUser.uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().profile) {
    const data = snap.data().profile;
    document.getElementById('display-name') && (document.getElementById('display-name').value = data.displayName ?? '');
    document.getElementById('nationality') && (document.getElementById('nationality').value = data.nationality ?? '');
    document.getElementById('stay-location') && (document.getElementById('stay-location').value = data.stayLocation ?? '');
    document.getElementById('stay-purpose') && (document.getElementById('stay-purpose').value = data.stayPurpose ?? '');
    document.getElementById('stay-from') && (document.getElementById('stay-from').value = data.stayFrom ?? '');
    document.getElementById('stay-to') && (document.getElementById('stay-to').value = data.stayTo ?? '');
    if (Array.isArray(data.languages)) {
      document.querySelectorAll('#languages input[type="checkbox"]').forEach(cb => {
        cb.checked = data.languages.includes(cb.value);
      });
    }
  }
}

function showSection(sectionNum) {
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  
  const target = document.getElementById(`section-${sectionNum}`);
  if (target) {
    target.classList.add('active');
    currentSection = sectionNum;
    updateProgress();
    updateStepIndicators();
  }
}

function updateStepIndicators() {
  document.querySelectorAll('.step').forEach(step => {
    const stepNum = parseInt(step.getAttribute('data-step'));
    step.classList.toggle('active', stepNum <= currentSection);
  });
}

function updateProgress() {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    const progressPercentage = currentSection > 1 ? ((currentSection - 1) / 3) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
  }
}

function handleAuthError(error) {
  let message = '認証に失敗しました。';
  switch (error.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      message = 'メールアドレスまたはパスワードが正しくありません。';
      break;
    case 'auth/email-already-in-use':
      message = 'このメールアドレスは既に使用されています。';
      break;
    case 'auth/invalid-email':
      message = '無効なメールアドレスです。';
      break;
    case 'auth/weak-password':
      message = 'パスワードは6文字以上で入力してください。';
      break;
    case 'auth/network-request-failed':
      message = 'ネットワークエラーが発生しました。接続を確認してください。';
      break;
    default:
      message = `エラーが発生しました: ${error.message}`;
  }
  showMessage(message, 'error');
}

function showMessage(message, type = 'info') {
  const el = document.createElement('div');
  el.textContent = message;
  
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
