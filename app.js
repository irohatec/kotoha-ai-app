// Firebase v10.12.2 本番版 app.js

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

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentSection = 1;

// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
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

  // --- Event Listeners ---
  if (loginBtn) loginBtn.addEventListener('click', handleEmailLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleCreateAccount);
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
  if (guestLoginBtn) guestLoginBtn.addEventListener('click', handleGuestLogin);

  // ログアウトボタンのイベント設定（問題解決済みの方法）
  const setupLogoutButton = () => {
    const btn = document.getElementById('logout-btn');
    if (btn) {
      // z-indexを設定してヘッダーより前面に表示
      btn.style.position = 'relative';
      btn.style.zIndex = '9999';
      btn.style.pointerEvents = 'auto';
      
      // クリックイベントを設定
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleLogout();
      });
    }
  };

  // --- Auth State Change Listener ---
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ログイン状態
      currentUser = user;
      const displayName = user.displayName || user.email || 'ゲスト';
      
      if (userInfo) userInfo.style.display = 'flex';
      if (userDisplay) userDisplay.textContent = displayName;
      if (authContainer) authContainer.style.display = 'none';

      // ログアウトボタンを設定
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
      
      // プロフィールセクションへ移動
      if (currentSection === 1) {
        showSection(2);
      }
    } else {
      // ログアウト状態
      currentUser = null;
      
      // UI状態をリセット
      if (userInfo) userInfo.style.display = 'none';
      if (authContainer) authContainer.style.display = 'block';
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';

      // 入力フィールドをクリア
      [loginEmailInput, loginPasswordInput, signupEmailInput, 
       signupPasswordInput, signupPasswordConfirmInput].forEach(input => {
        if (input) input.value = '';
      });

      // プロフィールフォームをクリア
      const displayNameInput = document.getElementById('display-name');
      const nationalitySelect = document.getElementById('nationality');
      const stayLocationSelect = document.getElementById('stay-location');
      const stayPurposeSelect = document.getElementById('stay-purpose');
      const stayFromInput = document.getElementById('stay-from');
      const stayToInput = document.getElementById('stay-to');

      if (displayNameInput) displayNameInput.value = '';
      if (nationalitySelect) nationalitySelect.value = '';
      if (stayLocationSelect) stayLocationSelect.value = '';
      if (stayPurposeSelect) stayPurposeSelect.value = '';
      if (stayFromInput) stayFromInput.value = '';
      if (stayToInput) stayToInput.value = '';

      // チェックボックスをクリア
      document.querySelectorAll('#languages input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });

      // ローカルストレージをクリア
      try {
        localStorage.removeItem('kotoha_user_profile');
        localStorage.removeItem('kotoha_consultation_history');
        localStorage.removeItem('kotoha_current_session');
        sessionStorage.clear();
      } catch (error) {
        // ストレージクリアエラーは無視
      }

      // 認証セクションに戻す
      showSection(1);
    }
  });

  // Google認証のリダイレクト結果を処理
  getRedirectResult(auth).catch(error => {
    handleAuthError(error);
  });

  // プロフィール保存ボタンの処理
  const saveProfileBtn = document.getElementById('save-profile-btn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      if (!currentUser) {
        showMessage('ログインが必要です。', 'error');
        return;
      }
      showMessage('プロフィールを保存しました。', 'success');
      showSection(3);
    });
  }

  // 戻るボタンの処理
  const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
  if (backToConsultationBtn) {
    backToConsultationBtn.addEventListener('click', () => {
      showSection(3);
    });
  }
});

// --- Utility Functions ---

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
    if (stepNum <= currentSection) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
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
