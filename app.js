// Firebase v10.12.2 本番版 app.js - ログアウト確実化（機能最小）+ Markdown整形、デザイン変更なし

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

// よくある質問→カテゴリ
const questionToCategory = {
  'バスの乗り方がわかりません。どうすればいいですか？': 'transportation',
  '病院に行きたいのですが、予約は必要ですか？': 'medical',
  'Wi-Fiが使える場所を教えてください。': 'connectivity',
  '日本のマナーで注意すべきことはありますか？': 'culture',
  '緊急時はどこに連絡すればいいですか？': 'general'
};

// メッセージからカテゴリ推測
function guessCategory(userMessage) {
  const message = userMessage.toLowerCase();
  if (message.includes('バス') || message.includes('電車') || message.includes('交通') ||
      message.includes('移動') || message.includes('タクシー') || message.includes('アクセス') ||
      message.includes('train') || message.includes('bus') || message.includes('transport')) {
    return 'transportation';
  }
  if (message.includes('病院') || message.includes('医療') || message.includes('薬') ||
      message.includes('体調') || message.includes('風邪') || message.includes('怪我') ||
      message.includes('hospital') || message.includes('doctor') || message.includes('medicine')) {
    return 'medical';
  }
  if (message.includes('wifi') || message.includes('wi-fi') || message.includes('インターネット') ||
      message.includes('sim') || message.includes('スマホ') || message.includes('通信') ||
      message.includes('internet') || message.includes('network')) {
    return 'connectivity';
  }
  if (message.includes('宿泊') || message.includes('ホテル') || message.includes('民泊') ||
      message.includes('住居') || message.includes('部屋') ||
      message.includes('hotel') || message.includes('accommodation') || message.includes('room')) {
    return 'accommodation';
  }
  if (message.includes('文化') || message.includes('マナー') || message.includes('習慣') ||
      message.includes('礼儀') || message.includes('作法') || message.includes('お辞儀') ||
      message.includes('culture') || message.includes('manner') || message.includes('etiquette')) {
    return 'culture';
  }
  return 'general';
}

// --- 軽量Markdownレンダラー（外部lib不使用・安全化） ---
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function renderMarkdownBasic(md) {
  if (!md || typeof md !== 'string') return '';
  let text = escapeHtml(md);

  // リンク [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, p1, p2) => `<a href="${p2}" target="_blank" rel="noopener noreferrer">${p1}</a>`);

  // 強調
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  // インラインコード
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 見出し
  text = text.replace(/^###\s*(.+)$/gm, '<strong>$1</strong>');
  text = text.replace(/^##\s*(.+)$/gm, '<strong>$1</strong>');
  text = text.replace(/^#\s*(.+)$/gm, '<strong>$1</strong>');

  // 箇条書き
  const lines = text.split(/\r?\n/);
  let html = '';
  let inList = false;
  const flushList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*[-*]\s+(.+)$/);
    if (m) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${m[1]}</li>`;
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushList();
      html += '<br>';
      continue;
    }
    flushList();
    html += line + '<br>';
  }
  flushList();
  html = html.replace(/(<br>){3,}/g, '<br><br>');
  return html;
}

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
  // Auth/UI要素
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
  const userInfo = document.getElementById('user-info');
  const userDisplay = document.getElementById('user-display-name');

  // ステップ
  const stepIndicators = document.querySelectorAll('.step');
  function setupStepNavigation() {
    stepIndicators.forEach((step, idx) => {
      const newStep = step.cloneNode(true);
      step.parentNode.replaceChild(newStep, step);
      newStep.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetSection = idx + 1;
        if (!currentUser && targetSection > 1) {
          showMessage('この機能を利用するにはログインが必要です。', 'warning');
          return;
        }
        showSection(targetSection);
      });
    });
  }
  setupStepNavigation();

  // プロフィール
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const editProfileBtn = document.getElementById('edit-profile-btn');

  // 相談
  const categoryCards = document.querySelectorAll('.category-card');
  const selectedCategoryBox = document.getElementById('selected-category');
  const selectedCategoryName = document.getElementById('selected-category-name');
  const clearCategoryBtn = document.getElementById('clear-category-btn');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const storeConsultationCheckbox = document.getElementById('store-consultation');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatMessages = document.getElementById('chat-messages');

  // 履歴
  const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
  const exportHistoryBtn = document.getElementById('export-history-btn');

  // チャット領域高さ（現状通り）
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
  adjustChatHeight();
  window.addEventListener('resize', adjustChatHeight);

  // フォーム切替
  if (showSignupBtn) showSignupBtn.addEventListener('click', () => { loginForm.style.display = 'none'; signupForm.style.display = 'block'; });
  if (showLoginBtn)  showLoginBtn.addEventListener('click', () => { signupForm.style.display = 'none'; loginForm.style.display = 'block'; });

  // 認証
  const handleEmailLogin = () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    if (!email || !password) { showMessage('メールアドレスとパスワードを入力してください。', 'error'); return; }
    signInWithEmailAndPassword(auth, email, password)
      .then(() => showMessage('ログインしました。', 'success'))
      .catch(handleAuthError);
  };
  const handleCreateAccount = () => {
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    const confirmPassword = signupPasswordConfirmInput.value;
    if (!email || !password) { showMessage('メールアドレスとパスワードを入力してください。', 'error'); return; }
    if (password.length < 6) { showMessage('パスワードは6文字以上で入力してください。', 'error'); return; }
    if (password !== confirmPassword) { showMessage('パスワードが一致しません。', 'error'); return; }
    createUserWithEmailAndPassword(auth, email, password)
      .then(() => showMessage('アカウントを作成しました。', 'success'))
      .catch(handleAuthError);
  };
  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    signInWithPopup(auth, provider).catch(error => {
      if (error.code === 'auth/popup-blocked') {
        showMessage('ポップアップがブロックされました。リダイレクトを試みます。', 'warning');
        signInWithRedirect(auth, provider);
      } else { handleAuthError(error); }
    });
  };
  const handleGuestLogin = () => { signInAnonymously(auth).catch(handleAuthError); };
  const handleLogout = () => {
    if (!confirm('ログアウトしますか？')) return;
    signOut(auth).then(() => showMessage('ログアウトしました。', 'success'))
                 .catch(error => showMessage(`ログアウトエラー: ${error.message}`, 'error'));
  };

  // ログアウトボタン（機能確実化：イベント + クリック可能性の担保）
  const setupLogoutButton = () => {
    const btn = document.getElementById('logout-btn');
    if (btn) {
      // 見た目に影響を与えない最小設定（クリックを遮られないように）
      try {
        btn.style.pointerEvents = 'auto';
        btn.style.zIndex = '9999';
        btn.style.position = btn.style.position || 'relative';
      } catch (_) {}
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); });
    }
  };

  // Auth状態
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const displayName = user.displayName || user.email || 'ゲスト';
      if (userInfo) userInfo.style.display = 'flex';
      if (userDisplay) userDisplay.textContent = displayName;
      if (authContainer) authContainer.style.display = 'none';
      setTimeout(setupLogoutButton, 100);

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
      [loginEmailInput, loginPasswordInput, signupEmailInput, signupPasswordInput, signupPasswordConfirmInput]
        .forEach(input => { if (input) input.value = ''; });
      clearProfileForm();
      try {
        localStorage.removeItem('kotoha_user_profile');
        localStorage.removeItem('kotoha_consultation_history');
        localStorage.removeItem('kotoha_current_session');
        sessionStorage.clear();
      } catch (_) {}
      showSection(1);
    }
  });

  getRedirectResult(auth).catch(handleAuthError);

  // プロフィール保存
  const PROFILE_STORAGE_KEY = 'kotoha_user_profile';
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!currentUser) { showMessage('ログインが必要です。', 'error'); return; }
      const displayName = document.getElementById('display-name')?.value ?? '';
      const nationality = document.getElementById('nationality')?.value ?? '';
      const stayLocation = document.getElementById('stay-location')?.value ?? '';
      const stayPurpose = document.getElementById('stay-purpose')?.value ?? '';
      const stayFrom = document.getElementById('stay-from')?.value ?? '';
      const stayTo = document.getElementById('stay-to')?.value ?? '';
      const languages = Array.from(document.querySelectorAll('#languages input[type="checkbox"]:checked')).map(cb => cb.value);
      const profile = { displayName, nationality, stayLocation, stayPurpose, stayFrom, stayTo, languages };

      const userRef = doc(db, 'kotoha_users', currentUser.uid);
      try {
        await setDoc(userRef, { profile }, { merge: true });
        try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch(_) {}
        showMessage('プロフィールを保存しました。', 'success');
        showSection(3);
      } catch (e) {
        console.error('Profile save error:', e);
        showMessage('プロフィール保存に失敗しました: ' + e.message, 'error');
      }
    });
  }

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', (e) => { e.preventDefault(); showSection(2); });
  }
  if (backToConsultationBtn) {
    backToConsultationBtn.addEventListener('click', () => { showSection(3); });
  }

  // カテゴリ選択
  function selectCategory(categoryValue) {
    selectedCategory = categoryValue;
    if (selectedCategoryBox) selectedCategoryBox.style.display = 'block';
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected', 'active');
      if (card.getAttribute('data-category') === categoryValue) {
        card.classList.add('selected', 'active');
        if (selectedCategoryName) {
          const el = card.querySelector('.category-name');
          if (el) selectedCategoryName.textContent = el.textContent;
        }
      }
    });
    updateSendButton();
  }
  categoryCards.forEach((card) => {
    card.addEventListener('click', () => {
      const categoryValue = card.getAttribute('data-category');
      selectCategory(categoryValue);
      showMessage(`${card.querySelector('.category-name').textContent} を選択しました。`, 'info');
    });
  });
  if (clearCategoryBtn) {
    clearCategoryBtn.addEventListener('click', () => {
      selectedCategory = '';
      if (selectedCategoryBox) selectedCategoryBox.style.display = 'none';
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected', 'active'));
      updateSendButton();
    });
  }

  // よくある質問→入力
  document.querySelectorAll('.question-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-question') || btn.textContent.trim();
      if (chatInput) {
        chatInput.value = question;
        const relatedCategory = questionToCategory[question] || guessCategory(question);
        if (relatedCategory) selectCategory(relatedCategory);
        updateSendButton();
        chatInput.focus();
      }
    });
  });

  // 送信ボタン制御
  function updateSendButton() {
    const inputValue = chatInput ? chatInput.value.trim() : '';
    const hasInput = inputValue.length > 0;
    if (hasInput && !selectedCategory) {
      const guessedCategory = guessCategory(inputValue);
      selectCategory(guessedCategory);
    }
    const hasCategory = selectedCategory.length > 0;
    if (sendButton) {
      const shouldEnable = hasInput && hasCategory && !isAIChatting;
      sendButton.disabled = !shouldEnable;
    }
  }
  if (chatInput) {
    chatInput.addEventListener('input', updateSendButton);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) handleSendMessage();
      }
    });
  }
  if (storeConsultationCheckbox) {
    storeConsultationCheckbox.addEventListener('change', () => {
      shouldStoreConsultation = storeConsultationCheckbox.checked;
    });
  }

  // プロフィール取得（フォーム優先→ローカルキャッシュ）
  const PROFILE_KEY = 'kotoha_user_profile';
  function getUserProfileForContext() {
    const displayName = document.getElementById('display-name')?.value?.trim() ?? '';
    const nationality = document.getElementById('nationality')?.value ?? '';
    const stayLocation = document.getElementById('stay-location')?.value ?? '';
    const stayPurpose = document.getElementById('stay-purpose')?.value ?? '';
    const stayFrom = document.getElementById('stay-from')?.value ?? '';
    const stayTo = document.getElementById('stay-to')?.value ?? '';
    const languages = Array.from(document.querySelectorAll('#languages input[type="checkbox"]:checked')).map(cb => cb.value);

    if (!displayName && !nationality && !stayLocation && !stayPurpose && !stayFrom && !stayTo && languages.length === 0) {
      try {
        const cached = localStorage.getItem(PROFILE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }
    return { displayName, nationality, stayLocation, stayPurpose, stayFrom, stayTo, languages };
  }

  // 送信処理（サーバAPI）
  async function handleSendMessage() {
    if (!chatInput || !chatInput.value.trim() || isAIChatting) return;

    const userMessage = chatInput.value.trim();
    if (!selectedCategory) {
      const guessedCategory = guessCategory(userMessage);
      selectCategory(guessedCategory);
    }
    const userProfile = getUserProfileForContext(); // 滞在地含む

    appendChatMessage('user', userMessage);
    chatInput.value = '';
    isAIChatting = true;
    updateSendButton();
    appendTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          userId: currentUser ? currentUser.uid : null,
          context: {
            category: selectedCategory,
            userProfile // ← プロフィール（滞在地等）をAIへ同送
          }
        }),
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'サーバーでエラーが発生しました。');
      }

      const data = await response.json();

      // Markdown → HTML（markedがあれば優先、無ければ軽量版）
      let formattedResponse = data.response;
      if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        formattedResponse = marked.parse(data.response);
      } else {
        formattedResponse = renderMarkdownBasic(data.response);
      }

      appendChatMessage('ai', formattedResponse);

    } catch (error) {
      console.error('AI chat error:', error);
      removeTypingIndicator();
      const fallbackResponse = renderMarkdownBasic(generateBetterResponse(userMessage, selectedCategory));
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

  // チャットクリア
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
        setTimeout(() => { scrollToBottom(); }, 100);
      }
    });
  }
});

// --- タイピングインジケーター ---
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

// --- フォールバック応答 ---
function generateBetterResponse(userMessage, category) {
  const responses = {
    transportation: [
      "愛媛県の公共交通についてお答えします！\n\n松山市内では「伊予鉄バス」と「市内電車（路面電車）」が主要な交通手段です。\n\n【おすすめの移動方法】\n- バス：ICカード「い～カード」が便利\n- 市内電車：道後温泉や松山城へのアクセスに最適\n- タクシー：深夜や荷物が多い時に\n\n料金や時刻表は伊予鉄道の公式サイトで確認できます。",
      "愛媛での交通手段について詳しくご案内します。\n\n【エリア別アクセス】\n- 松山市内：市内電車・バスで十分\n- 今治・新居浜：JR予讃線が便利\n- しまなみ海道：レンタサイクルがおすすめ\n\n【お得情報】\n1日乗車券や観光パスもあります！\n具体的な目的地があれば、ルートをお調べしますよ。"
    ],
    medical: [
      "愛媛県での医療についてサポートします！\n\n【主要病院】\n- 愛媛大学医学部附属病院（東温市）\n- 松山赤十字病院（松山市）\n- 済生会松山病院（松山市）\n\n【受診の流れ】\n1. 保険証持参（国民健康保険なら3割負担）\n2. 受付で問診票記入\n3. 診察・検査\n4. 会計\n\n【緊急時】救急：119番／医療相談：#7119（24時間）",
      "医療機関について詳しくお答えします。\n\n【薬局・ドラッグストア】\nマツモトキヨシ、ウエルシア、ツルハドラッグ等\n\n【英語対応】\n松山市内の一部病院で英語対応可。事前に電話確認をおすすめします。\n\n【保険】\n海外旅行保険や国民健康保険についてもご案内できます。"
    ],
    connectivity: [
      "愛媛でのインターネット環境についてご案内します！\n\n【無料Wi-Fi】\n- 松山空港・JR松山駅\n- コンビニ（セブン、ローソン等）\n- カフェ（スタバ、ドトール等）\n- 松山市役所・図書館\n\n【SIMカード】家電量販店でプリペイドSIM購入可能",
      "ネット環境の目安：\n- 短期：コンビニのプリペイドSIM\n- 1ヶ月：格安SIM（月3,000〜5,000円）\n- 長期：大手キャリア契約\n\n滞在期間とデータ量を教えていただければ、最適プランを提案します。"
    ],
    accommodation: [
      "愛媛での宿泊について：\n\n【おすすめエリア】\n- 道後温泉周辺：温泉旅館・観光便利\n- 松山市駅周辺：交通アクセス良好\n- 大街道周辺：繁華街・買い物便利\n\n【価格目安】\n- ビジネスホテル：6,000-10,000円/泊\n- 民泊：4,000-8,000円/泊\n- シェアハウス：40,000-60,000円/月",
      "長期滞在向け：\n- マンスリーマンション\n- シェアハウス（国際交流しやすい）\n- Airbnb等\n\n平日は料金が安く、連泊割引もあり。必要書類や条件もご案内します。"
    ],
    culture: [
      "日本のマナー基礎：\n- 挨拶：軽いお辞儀\n- 靴：玄関で脱ぐ\n- 食事：「いただきます」「ごちそうさま」\n\n公共交通では通話控えめ・優先席付近は注意。愛媛名物は鯛めし・じゃこ天・みかんなど。",
      "コミュニケーションのコツ：\n- 丁寧な言葉と笑顔\n- 困ったら「すみません」で声かけ\n\n季節行事：春は花見、夏は祭り、秋はみかん狩り。"
    ],
    general: [
      "愛媛スタートガイド：\n- 観光：松山城／道後温泉／しまなみ海道\n- グルメ：鯛めし・じゃこ天・みかん\n- 買い物：大街道・銀天街\n\n質問があれば具体的にお知らせください！",
      "生活情報：\n- 日用品：コンビニ24h、スーパー（フジ・マルナカ・イオン）\n- 100均：ダイソー・セリア\n- 便利アプリ：Google翻訳／Yahoo!天気\n- 緊急：警察110／消防・救急119"
    ]
  };
  const categoryResponses = responses[category] || responses.general;
  const randomIndex = Math.floor(Math.random() * categoryResponses.length);
  return categoryResponses[randomIndex];
}

// --- フォームクリア ---
function clearProfileForm() {
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
}

// --- Firestore→フォーム反映 ---
async function loadProfileFormFromFirestore() {
  if (!currentUser) return;
  try {
    const userRef = doc(getFirestore(), 'kotoha_users', currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().profile) {
      const data = snap.data().profile;
      const displayNameField = document.getElementById('display-name');
      const nationalityField = document.getElementById('nationality');
      const stayLocationField = document.getElementById('stay-location');
      const stayPurposeField = document.getElementById('stay-purpose');
      const stayFromField = document.getElementById('stay-from');
      const stayToField = document.getElementById('stay-to');
      if (displayNameField) displayNameField.value = data.displayName ?? '';
      if (nationalityField) nationalityField.value = data.nationality ?? '';
      if (stayLocationField) stayLocationField.value = data.stayLocation ?? '';
      if (stayPurposeField) stayPurposeField.value = data.stayPurpose ?? '';
      if (stayFromField) stayFromField.value = data.stayFrom ?? '';
      if (stayToField) stayToField.value = data.stayTo ?? '';
      if (Array.isArray(data.languages)) {
        document.querySelectorAll('#languages input[type="checkbox"]').forEach(cb => {
          cb.checked = data.languages.includes(cb.value);
        });
      }
      try { localStorage.setItem('kotoha_user_profile', JSON.stringify(data)); } catch(_) {}
    } else {
      clearProfileForm();
    }
  } catch (error) {
    console.error('Profile loading error:', error);
  }
}

// --- Section/Step ---
function showSection(sectionNum) {
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  const target = document.getElementById(`section-${sectionNum}`);
  if (target) {
    target.classList.add('active');
    currentSection = sectionNum;
    updateProgress();
    updateStepIndicators();
  } else {
    console.error(`Section ${sectionNum} not found`);
  }
}
function updateStepIndicators() {
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

// --- Chat表示 ---
function appendChatMessage(type, htmlContent) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  const isAI = type === 'ai';
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isAI ? 'ai-message' : 'user-message'}`;
  const avatar = isAI ? '🤖' : '🧑';
  const senderName = isAI ? 'Kotoha AI' : 'You';
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
function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const lastMessage = chatMessages.lastElementChild;
    if (lastMessage) lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
  }, 100);
  setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 300);
}

// --- メッセージ表示（ログのみ） ---
function showMessage(text, type = 'info') {
  console.log(`[${type}] ${text}`);
}

// --- 認証エラー ---
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
