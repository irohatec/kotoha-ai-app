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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentSection = 1;
let selectedCategory = '';
let shouldStoreConsultation = true;

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
      message.includes('移動') || message.includes('タクシー') || message.includes('アクセス')) {
    return 'transportation';
  }
  
  // 医療関連キーワード
  if (message.includes('病院') || message.includes('医療') || message.includes('薬') || 
      message.includes('体調') || message.includes('風邪') || message.includes('怪我')) {
    return 'medical';
  }
  
  // ネット関連キーワード
  if (message.includes('wifi') || message.includes('wi-fi') || message.includes('インターネット') || 
      message.includes('sim') || message.includes('スマホ') || message.includes('通信')) {
    return 'connectivity';
  }
  
  // 宿泊関連キーワード
  if (message.includes('宿泊') || message.includes('ホテル') || message.includes('民泊') || 
      message.includes('住居') || message.includes('部屋')) {
    return 'accommodation';
  }
  
  // 文化関連キーワード
  if (message.includes('文化') || message.includes('マナー') || message.includes('習慣') || 
      message.includes('礼儀') || message.includes('作法') || message.includes('お辞儀')) {
    return 'culture';
  }
  
  // デフォルトは一般相談
  return 'general';
}

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

  // --- Section Navigation Buttons ---
  const stepIndicators = document.querySelectorAll('.step');
  stepIndicators.forEach((step, idx) => {
    step.addEventListener('click', () => {
      if (currentUser) showSection(idx + 1);
    });
  });

  // --- Profile
  const saveProfileBtn = document.getElementById('save-profile-btn');
  
  // --- Consultation
  const categoryCards = document.querySelectorAll('.category-card');
  const selectedCategoryBox = document.getElementById('selected-category');
  const selectedCategoryName = document.getElementById('selected-category-name');
  const clearCategoryBtn = document.getElementById('clear-category-btn');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const storeConsultationCheckbox = document.getElementById('store-consultation');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  
  // --- History
  const backToConsultationBtn = document.getElementById('back-to-consultation-btn');
  const exportHistoryBtn = document.getElementById('export-history-btn');

  // チャット領域の高さを調整
  function adjustChatHeight() {
    if (chatMessages) {
      // ビューポートの高さを取得
      const viewportHeight = window.innerHeight;
      // ヘッダー、プログレスバー、カテゴリ選択、質問チップ、入力欄の高さを考慮
      const otherElementsHeight = 400; // 概算値
      const availableHeight = viewportHeight - otherElementsHeight;
      const minHeight = 300; // 最小高さ
      const maxHeight = 600; // 最大高さ
      
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

  // --- Logout Button Z-index Fix ---
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
      const stayLocation = document.getElementById('stay-location')?.value ?? '';
      const stayPurpose = document.getElementById('stay-purpose')?.value ?? '';
      const stayFrom = document.getElementById('stay-from')?.value ?? '';
      const stayTo = document.getElementById('stay-to')?.value ?? '';
      const languages = Array.from(document.querySelectorAll('#languages input[type="checkbox"]:checked')).map(cb => cb.value);
      const userRef = doc(db, 'kotoha_users', currentUser.uid);
      try {
        await setDoc(userRef, {
          profile: {
            displayName,
            nationality,
            stayLocation,
            stayPurpose,
            stayFrom,
            stayTo,
            languages,
          }
        }, { merge: true });
        showMessage('プロフィールを保存しました。', 'success');
        showSection(3);
      } catch (e) {
        showMessage('プロフィール保存失敗: ' + e.message, 'error');
      }
    });
  }

  // --- 戻るボタン（履歴→相談）---
  if (backToConsultationBtn) {
    backToConsultationBtn.addEventListener('click', () => {
      showSection(3);
    });
  }

  // --- カテゴリ選択関数 ---
  function selectCategory(categoryValue) {
    selectedCategory = categoryValue;
    
    if (selectedCategoryBox) {
      selectedCategoryBox.style.display = 'block';
    }
    
    // カテゴリカードを視覚的に選択状態にする
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.remove('selected');
      if (card.getAttribute('data-category') === categoryValue) {
        card.classList.add('selected');
        
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
    });
  });

  // --- カテゴリ解除 ---
  if (clearCategoryBtn) {
    clearCategoryBtn.addEventListener('click', () => {
      selectedCategory = '';
      if (selectedCategoryBox) {
        selectedCategoryBox.style.display = 'none';
      }
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
      updateSendButton();
    });
  }

  // --- よくある質問クリックで入力欄に転記 + カテゴリ自動選択 ---
  document.querySelectorAll('.question-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-question');
      
      if (chatInput) {
        chatInput.value = question;
        
        // 質問に対応するカテゴリを自動選択
        const relatedCategory = questionToCategory[question];
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
      const shouldEnable = hasInput && hasCategory;
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

  // --- チャット送信 ---
  function handleSendMessage() {
    if (!chatInput || !chatInput.value.trim()) {
      return;
    }
    
    const userMessage = chatInput.value.trim();
    
    // カテゴリが選択されていない場合は推測
    if (!selectedCategory) {
      const guessedCategory = guessCategory(userMessage);
      selectCategory(guessedCategory);
    }
    
    // ユーザーメッセージを表示
    appendChatMessage('user', userMessage);
    
    // 入力欄をクリア
    chatInput.value = '';
    updateSendButton();
    
    // 送信ボタンを一時的に無効化
    if (sendButton) {
      sendButton.disabled = true;
      sendButton.textContent = '送信中...';
    }
    
    // AIレスポンス
    setTimeout(() => {
      const aiResponse = generateBetterResponse(userMessage, selectedCategory);
      appendChatMessage('ai', aiResponse);
      
      // 送信ボタンを再有効化
      if (sendButton) {
        sendButton.disabled = false;
        sendButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        updateSendButton();
      }
    }, 1000 + Math.random() * 1000);
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
});

// --- 改良されたレスポンス生成 ---
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

  // カテゴリに基づいて回答を選択
  const categoryResponses = responses[category] || responses.general;
  const randomIndex = Math.floor(Math.random() * categoryResponses.length);
  const selectedResponse = categoryResponses[randomIndex];
  
  return selectedResponse;
}

// --- フォームクリア関数 ---
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
  document.querySelectorAll('#languages input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });
}

// --- Firestore→フォーム反映関数 ---
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
  } else {
    clearProfileForm();
  }
}

// --- Section・Step Utility ---
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

// --- Chat表示ユーティリティ（改良版） ---
function appendChatMessage(type, text) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const isAI = type === 'ai';
  const messageHTML = `
    <div class="message ${isAI ? 'ai-message' : 'user-message'}">
      <div class="message-avatar">${isAI ? '🤖' : '🧑'}</div>
      <div class="message-content">
        <div class="message-bubble">${text.replace(/\n/g, '<br>')}</div>
        <div class="message-time">${isAI ? 'Kotoha AI' : 'You'} • ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  `;
  chatMessages.insertAdjacentHTML('beforeend', messageHTML);
  
  // 改善された自動スクロール
  scrollToBottom();
}

// --- 改善された自動スクロール関数 ---
function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  // 複数の方法でスクロールを確実に実行
  setTimeout(() => {
    // 方法1: scrollTop
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 方法2: scrollIntoView（最新メッセージを表示）
    const lastMessage = chatMessages.lastElementChild;
    if (lastMessage) {
      lastMessage.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest' 
      });
    }
    
    // 方法3: scrollTo
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: 'smooth'
    });
  }, 100);
  
  // さらに確実にするため、少し遅延させてもう一度実行
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 300);
}

// --- 汎用メッセージ ---
function showMessage(text, type = 'info') {
  alert(text); // 必要に応じてカスタムUIに変更可能
}

// --- エラーハンドリング ---
function handleAuthError(error) {
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
      default:
        msg = error.message;
    }
  }
  showMessage(msg, 'error');
}
