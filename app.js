// Firebase v10.12.2 本番版 app.js (地域特化・プロフィール保存修正版)

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
  getDocs,
  orderBy,
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
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global State ---
let currentUser = null;
let currentSection = 1;
let selectedCategory = null;
let isAIChatting = false;
let currentChatSessionId = null;
let shouldStoreConsultation = true;

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, handleAuthStateChange);
  getRedirectResult(auth).catch(handleAuthError);
  bindEvents();
});

/**
 * Event listeners are managed here.
 */
function bindEvents() {
  // --- Authentication ---
  document.getElementById('login-btn')?.addEventListener('click', handleEmailLogin);
  document.getElementById('signup-btn')?.addEventListener('click', handleCreateAccount);
  document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
  document.getElementById('guest-login-btn')?.addEventListener('click', handleGuestLogin);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('show-signup-btn')?.addEventListener('click', () => toggleAuthForms(false));
  document.getElementById('show-login-btn')?.addEventListener('click', () => toggleAuthForms(true));

  // --- Profile ---
  document.getElementById('save-profile-btn')?.addEventListener('click', handleSaveProfile);

  // --- AI Consultation ---
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');

  document.querySelector('.category-grid')?.addEventListener('click', handleCategorySelection);
  document.querySelector('.question-chips')?.addEventListener('click', handleSampleQuestionClick);
  
  sendButton?.addEventListener('click', handleSendMessage);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sendButton.disabled) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  chatInput?.addEventListener('input', updateSendButtonState);
  document.getElementById('clear-chat-btn')?.addEventListener('click', clearChat);
  document.getElementById('store-consultation')?.addEventListener('change', (e) => {
      shouldStoreConsultation = e.target.checked;
  });

  // --- History ---
  document.getElementById('back-to-consultation-btn')?.addEventListener('click', () => showSection(3));
  document.getElementById('history-category-filter')?.addEventListener('change', displayConsultationHistory);


  // --- Header Navigation ---
  document.getElementById('step-indicators')?.addEventListener('click', handleNavigation);
}

// --- Navigation Handler ---
function handleNavigation(e) {
  const step = e.target.closest('.step');
  if (step) {
    const sectionNum = parseInt(step.dataset.step, 10);
    if (sectionNum === 1) {
      showSection(1);
      return;
    }
    if (!currentUser) {
      showMessage('この機能を利用するにはログインまたはゲストとして利用を開始してください。', 'warning');
      return;
    }
    showSection(sectionNum);
  }
}

// --- Auth State Change Handler ---
async function handleAuthStateChange(user) {
  const authContainer = document.getElementById('auth-container');
  const userInfo = document.getElementById('user-info');
  if (user) {
    currentUser = user;
    const displayName = user.displayName || user.email || 'ゲスト';
    userInfo.style.display = 'flex';
    document.getElementById('user-display-name').textContent = displayName;
    authContainer.style.display = 'none';
    
    await initializeUserData(user);
    await loadProfileFormFromFirestore();

    if (currentSection === 1) {
      showSection(2);
    }
  } else {
    currentUser = null;
    userInfo.style.display = 'none';
    authContainer.style.display = 'block';
    toggleAuthForms(true);
    showSection(1);
  }
}

function toggleAuthForms(showLogin) {
  document.getElementById('login-form').style.display = showLogin ? 'block' : 'none';
  document.getElementById('signup-form').style.display = showLogin ? 'none' : 'block';
}

// --- Auth Handlers ---
function handleEmailLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showMessage('メールアドレスとパスワードを入力してください。', 'error');
  signInWithEmailAndPassword(auth, email, password).catch(handleAuthError);
}

function handleCreateAccount() {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;
  if (!email || !password) return showMessage('メールアドレスとパスワードを入力してください。', 'error');
  if (password.length < 6) return showMessage('パスワードは6文字以上で入力してください。', 'error');
  if (password !== confirmPassword) return showMessage('パスワードが一致しません。', 'error');
  createUserWithEmailAndPassword(auth, email, password).catch(handleAuthError);
}

function handleGoogleLogin() {
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
}

function handleGuestLogin() {
  signInAnonymously(auth).catch(handleAuthError);
}

function handleLogout() {
    signOut(auth).catch(error => {
        console.error('Logout Error:', error);
        showMessage(`ログアウトエラー: ${error.message}`, 'error');
    });
}

async function initializeUserData(user) {
  const userRef = doc(db, 'kotoha_users', user.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        createdAt: serverTimestamp(),
        isAnonymous: user.isAnonymous,
        profile: null
      });
    }
  } catch (dbError) {
    console.error("Firestore Error:", dbError);
    showMessage('データベースへの接続に失敗しました。', 'error');
  }
}

// --- Profile Handler ---
async function handleSaveProfile() {
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
    showMessage('プロフィールの保存に失敗しました: ' + e.message, 'error');
  }
}

async function loadProfileFormFromFirestore() {
    if (!currentUser) return;
    const userRef = doc(db, 'kotoha_users', currentUser.uid);
    try {
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().profile) {
            const data = snap.data().profile;
            document.getElementById('display-name').value = data.displayName ?? '';
            document.getElementById('nationality').value = data.nationality ?? '';
            document.getElementById('stay-location').value = data.stayLocation ?? '';
            document.getElementById('stay-purpose').value = data.stayPurpose ?? '';
            document.getElementById('stay-from').value = data.stayFrom ?? '';
            document.getElementById('stay-to').value = data.stayTo ?? '';
            if (Array.isArray(data.languages)) {
                document.querySelectorAll('#languages input[type="checkbox"]').forEach(cb => {
                    cb.checked = data.languages.includes(cb.value);
                });
            }
        }
    } catch (error) {
        console.error("Profile load error:", error);
        showMessage("プロフィールの読み込みに失敗しました。", "error");
    }
}

// --- AI Consultation Handlers ---
function handleCategorySelection(e) {
    const card = e.target.closest('.category-card');
    if (!card) return;

    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedCategory = card.dataset.category;
    const categoryName = card.querySelector('.category-name').textContent;
    showMessage(`${categoryName} を選択しました。`, 'info');
    updateSendButtonState();
}

function handleSampleQuestionClick(e) {
    if (e.target.matches('.question-chip')) {
        const question = e.target.dataset.question || e.target.textContent.trim();
        const chatInput = document.getElementById('chat-input');
        chatInput.value = question;
        chatInput.focus();
        updateSendButtonState();
        handleSendMessage();
    }
}

async function handleSendMessage() {
    const chatInput = document.getElementById('chat-input');
    const userMessage = chatInput.value.trim();
    if (userMessage === '' || isAIChatting) return;

    if (!selectedCategory) {
        selectedCategory = guessCategory(userMessage);
        document.querySelectorAll('.category-card').forEach(c => {
            c.classList.toggle('active', c.dataset.category === selectedCategory);
        });
    }

    appendChatMessage('user', userMessage);
    const userMessageText = chatInput.value;
    chatInput.value = '';
    isAIChatting = true;
    updateSendButtonState();
    appendTypingIndicator();

    // ▼▼▼ Fetch user profile before sending message ▼▼▼
    let userProfile = null;
    if (currentUser) {
        try {
            const userRef = doc(db, 'kotoha_users', currentUser.uid);
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data().profile) {
                userProfile = snap.data().profile;
            }
        } catch (error) {
            console.error("Could not fetch profile for AI context:", error);
        }
    }
    // ▲▲▲ Fetch user profile before sending message ▲▲▲

    if (shouldStoreConsultation) {
        await saveMessageToHistory('user', userMessageText);
    }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                context: { 
                    category: selectedCategory,
                    userProfile: userProfile // Pass the fetched profile
                }
            }),
        });
        
        removeTypingIndicator();

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: 'サーバーからの応答が不正です。' }));
            throw new Error(errData.message || 'サーバーでエラーが発生しました。');
        }

        const data = await response.json();
        const aiResponseText = data.response;
        const formattedResponse = marked.parse(aiResponseText);
        
        appendChatMessage('ai', formattedResponse);
        
        if (shouldStoreConsultation) {
            await saveMessageToHistory('ai', aiResponseText);
        }

    } catch (error) {
        console.error('AI Chat Error:', error);
        removeTypingIndicator();
        const errorMessage = `申し訳ありません、エラーが発生しました。<br>(${error.message})`;
        appendChatMessage('ai', errorMessage);
        if (shouldStoreConsultation) {
            await saveMessageToHistory('ai', errorMessage);
        }
    } finally {
        isAIChatting = false;
        updateSendButtonState();
    }
}

// --- History Saving & Display ---
async function saveMessageToHistory(role, content) {
    if (!currentUser || currentUser.isAnonymous) return;

    if (!currentChatSessionId) {
        try {
            const sessionRef = await addDoc(collection(db, `kotoha_users/${currentUser.uid}/sessions`), {
                category: selectedCategory,
                startedAt: serverTimestamp(),
                firstMessage: content.substring(0, 100)
            });
            currentChatSessionId = sessionRef.id;
        } catch (error) {
            console.error("Could not create chat session:", error);
            return;
        }
    }

    if (currentChatSessionId) {
        try {
            await addDoc(collection(db, `kotoha_users/${currentUser.uid}/sessions/${currentChatSessionId}/messages`), {
                role: role,
                content: content,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Could not save message:", error);
        }
    }
}

async function displayConsultationHistory() {
    const historyContainer = document.getElementById('consultation-history');
    if (!currentUser || !historyContainer) return;

    historyContainer.innerHTML = '<p>履歴を読み込んでいます...</p>';

    try {
        const sessionsRef = collection(db, `kotoha_users/${currentUser.uid}/sessions`);
        const q = query(sessionsRef, orderBy('startedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<div class="no-history"><p>まだ相談履歴はありません。</p></div>';
            return;
        }

        historyContainer.innerHTML = ''; // Clear loading message
        for (const sessionDoc of querySnapshot.docs) {
            const sessionData = sessionDoc.data();
            const sessionElement = document.createElement('div');
            sessionElement.className = 'history-session';
            
            const sessionDate = sessionData.startedAt?.toDate().toLocaleString('ja-JP') || '日付不明';

            sessionElement.innerHTML = `
                <div class="history-session-header">
                    <h3>${sessionData.category || '一般相談'}</h3>
                    <p>${sessionDate}</p>
                </div>
                <div class="history-session-body">
                    <p><strong>最初の質問:</strong> ${sessionData.firstMessage}</p>
                </div>
            `;
            historyContainer.appendChild(sessionElement);
        };

    } catch (error) {
        console.error("Error fetching history:", error);
        historyContainer.innerHTML = '<div class="no-history"><p>履歴の読み込み中にエラーが発生しました。</p></div>';
    }
}


function clearChat() {
    document.getElementById('chat-messages').innerHTML = '';
    appendInitialAIMessage();
    currentChatSessionId = null;
    showMessage('チャットをクリアしました。', 'info');
}

// --- UI Update & Utility Functions ---
function updateSendButtonState() {
    const sendButton = document.getElementById('send-button');
    const chatInput = document.getElementById('chat-input');
    if (sendButton) {
        sendButton.disabled = chatInput.value.trim() === '' || isAIChatting;
    }
}

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
          <div class="message-time">${senderName} - ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendInitialAIMessage() {
  const chatMessages = document.getElementById('chat-messages');
  if(chatMessages.children.length > 1) return; // Don't add if not empty
  const initialHTML = `こんにちは！Kotoha AIです。愛媛県での滞在に関するご質問に、なんでもお答えします。<br>
    カテゴリを選択し、サンプル質問をクリックするか、直接ご質問を入力してください。<br><br>
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
            <span></span><span></span><span></span>
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

function guessCategory(userMessage) {
  const message = userMessage.toLowerCase();
  if (['バス', '電車', '交通', '移動', 'タクシー', 'アクセス'].some(kw => message.includes(kw))) return 'transportation';
  if (['病院', '医療', '薬', '体調', '風邪', '怪我'].some(kw => message.includes(kw))) return 'medical';
  if (['wifi', 'wi-fi', 'インターネット', 'sim', 'スマホ', '通信'].some(kw => message.includes(kw))) return 'connectivity';
  if (['宿泊', 'ホテル', '民泊', '住居', '部屋'].some(kw => message.includes(kw))) return 'accommodation';
  if (['文化', 'マナー', '習慣', '礼儀', '作法'].some(kw => message.includes(kw))) return 'culture';
  return 'general';
}

function showSection(sectionNum) {
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  document.getElementById(`section-${sectionNum}`)?.classList.add('active');
  currentSection = sectionNum;
  updateProgress();
  updateStepIndicators();

  if (sectionNum === 4) {
      displayConsultationHistory();
  }
}

function updateStepIndicators() {
  document.querySelectorAll('.step').forEach(step => {
    step.classList.toggle('active', parseInt(step.dataset.step) === currentSection);
  });
}

function updateProgress() {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    const progressPercentage = currentSection > 1 ? ((currentSection - 1) / 3) * 100 : 0;
    progressFill.style.width = `${progressPercentage}%`;
  }
}

function showMessage(text, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast-message toast-${type}`;
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
        top: -100px;
        right: 20px;
        background-color: ${bgColor};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        font-weight: 500;
        transition: top 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    `;
    
    document.body.appendChild(el);
    
    setTimeout(() => {
        el.style.top = '20px';
    }, 100);

    setTimeout(() => {
        el.style.top = '-100px';
        el.addEventListener('transitionend', () => el.remove());
    }, 5000);
}

function handleAuthError(error) {
  let message = '認証に失敗しました。';
  switch (error.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      message = 'メールアドレスまたはパスワードが正しくありません。'; break;
    case 'auth/email-already-in-use':
      message = 'このメールアドレスは既に使用されています。'; break;
    case 'auth/invalid-email':
      message = '無効なメールアドレスです。'; break;
    case 'auth/weak-password':
      message = 'パスワードは6文字以上で入力してください。'; break;
    case 'auth/network-request-failed':
      message = 'ネットワークエラーが発生しました。接続を確認してください。'; break;
    default:
      console.error('Authentication Error:', error);
      message = `エラーが発生しました: ${error.message}`;
  }
  showMessage(message, 'error');
}
