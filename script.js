/**
 * RPG Habits Quest
 * 機能：クエスト追加・削除機能付き
 */

// ==========================================
//  1. 設定値と状態管理
// ==========================================
const GAME_CONFIG = {
    BASE_XP: 100,
    BONUS_XP: 50,
    XP_STEP_LEVEL: 5,
};

// 現在選択中のクエスト難易度（初期値: 30）
let currentSelectedXP = 30;



let gameState = {
    xp: 0,
    level: 1,
    neededXp: 100
};

// ★クエストのリスト（初期値は空っぽだが、初回起動時にデフォルトを入れる）
let questList = [];

// ==========================================
//  2. 初期化処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    checkLoginBonus();
});

const ui = {
    xpBar: document.getElementById('xp-bar-fill'),
    levelText: document.getElementById('level-display'),
    xpNeededText: document.getElementById('xp-needed'),
    modal: document.getElementById('login-modal'),
    questGrid: document.getElementById('quest-grid'), // 追加
    input: document.getElementById('new-quest-input') // 追加
};

// ==========================================
//  3. ゲームロジック
// ==========================================

function addXP(amount) {
    gameState.xp += amount;
    while (gameState.xp >= gameState.neededXp) {
        gameState.xp -= gameState.neededXp;
        gameState.level++;
        gameState.neededXp = calculateNextXP();
        setTimeout(() => {
            alert(`🎉 レベルアップ！ Lv.${gameState.level} になりました！`);
        }, 100);
    }
    saveData();
    updateScreen();
}

function calculateNextXP() {
    const step = Math.floor(gameState.level / GAME_CONFIG.XP_STEP_LEVEL);
    return GAME_CONFIG.BASE_XP + (step * 100);
}

// ==========================================
//  ★4. クエスト管理ロジック (CRUD)
// ==========================================

// クエストを追加する
function addNewQuest() {
    const text = ui.input.value.trim(); // 空白を削除
    if (!text) return; // 空なら何もしない

    // 新しいクエストデータを作る
    const newQuest = {
        id: Date.now(), // 現在時刻をIDにする（被らない）
        title: text,
        emoji: getRandomEmoji(), // ランダムで絵文字を決める
        xp: currentSelectedXP
    };

    questList.push(newQuest); // リストに追加
    ui.input.value = ''; // 入力欄をクリア
    
    saveData();     // 保存
    renderQuests(); // 画面再描画
}

// クエストを削除する
function deleteQuest(id) {
    if(confirm("このクエストを削除しますか？")) {
        // IDが一致しないものだけ残す（＝一致するものを消す）
        questList = questList.filter(q => q.id !== id);
        saveData();
        renderQuests();
    }
}

// ランダムな絵文字を返すお遊び機能
function getRandomEmoji() {
    const emojis = ["⚔️", "🛡️", "🧙‍♂️", "🐉", "💎", "📜", "🏹", "🔥", "😤", "📖", "🌚", "🔮", "👸", "👑", "❤️"];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

// ==========================================
//  5. データ保存・読み込み
// ==========================================

function saveData() {
    localStorage.setItem('rpg_level', gameState.level);
    localStorage.setItem('rpg_xp', gameState.xp);
    // ★配列をJSON文字列にして保存
    localStorage.setItem('rpg_quests', JSON.stringify(questList));
}

function loadData() {
    const savedLevel = localStorage.getItem('rpg_level');
    const savedXP = localStorage.getItem('rpg_xp');
    const savedQuests = localStorage.getItem('rpg_quests');

    if (savedLevel) gameState.level = parseInt(savedLevel);
    if (savedXP) gameState.xp = parseInt(savedXP);

    if (savedQuests) {
        // 保存データがあれば復元
        questList = JSON.parse(savedQuests);
    } else {
        // 初回起動時用のデフォルトデータ
        questList = [
            { id: 1, title: "早起き", emoji: "🌅", xp: 10 },
            { id: 2, title: "筋トレ", emoji: "💪", xp: 30 },
            { id: 3, title: "開発", emoji: "💻", xp: 50 }
        ];
    }

    gameState.neededXp = calculateNextXP();
    updateScreen();
    renderQuests(); // ★リストを表示
}

function resetData() {
    if(confirm("データを全てリセットしますか？\nレベル・クエスト全て消えます。")) {
        localStorage.clear();
        location.reload(); // リロードして初期状態に戻す
    }
}

// ==========================================
//  6. UI更新 & イベント
// ==========================================

function updateScreen() {
    ui.levelText.innerText = gameState.level;
    ui.xpNeededText.innerText = gameState.neededXp - gameState.xp;
    const percentage = (gameState.xp / gameState.neededXp) * 100;
    ui.xpBar.style.width = `${percentage}%`;
}


// ★クエスト一覧を画面に描画する（一番大事な関数）
function renderQuests() {
    ui.questGrid.innerHTML = ""; // 一回全部消す

    // リストの数だけループしてHTMLを作る
    questList.forEach(quest => {
        const div = document.createElement("div");
        div.className = "quest-icon";

        const stars = getStarDisplay(quest.xp);
        // 中身のHTML（×ボタンと、クリック時のaddXPを含む）
        div.innerHTML = `
            <button class="delete-btn" onclick="event.stopPropagation(); deleteQuest(${quest.id})">×</button>
            <span class="emoji">${quest.emoji}</span>
            <span class="quest-title">${quest.title}</span>
            <span class="quest-stars">${stars}</span>
        `;

        div.onclick = () => {
            // もし「編集モード（editing-modeクラスがついている）」なら
            if (ui.questGrid.classList.contains('editing-mode')) {
                return; // ここで強制終了！（addXPを実行せずに終わる）
            }

            // 編集モードじゃなければ、経験値を足す
            addXP(quest.xp);
        };

        ui.questGrid.appendChild(div);
    });
}

function checkLoginBonus() {
    const today = new Date().toLocaleDateString();
    const lastLoginDate = localStorage.getItem('rpg_last_login_date');
    if (lastLoginDate !== today) {
        setTimeout(() => ui.modal.classList.add('active'), 500);
    }
}

function claimBonus() {
    addXP(GAME_CONFIG.BONUS_XP);
    localStorage.setItem('rpg_last_login_date', new Date().toLocaleDateString());
    ui.modal.classList.remove('active');
}

// ==========================================
//  ★編集モード（削除モード）の切替
// ==========================================
function toggleEditMode() {
    // クエスト一覧のエリアを取得
    const grid = document.getElementById('quest-grid');
    
    // 'editing-mode' というクラスを付け外しする
    // (付いていれば外す、付いてなければ付ける)
    grid.classList.toggle('editing-mode');
}

document.getElementById('select').disabled = true;

// ==========================================
//  ★難易度スイッチの動き制御
// ==========================================
function selectDifficulty(xp, index, btnElement) {
    // 1. 変数を更新
    currentSelectedXP = xp;

    // 2. 白い板（ハイライト）を移動させる
    // index (0, 1, 2) に応じて、横に100%ずつズラす
    const highlight = document.getElementById('diff-highlight');
    highlight.style.transform = `translateX(${index * 100}%)`;

    // 3. 文字の色を変える
    // 一旦すべてのボタンから 'active' クラスを外す
    document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
    // 押されたボタンにだけ 'active' をつける
    btnElement.classList.add('active');
}

// XPの量に応じて、星のマークを返す関数
function getStarDisplay(xp) {
    if (xp >= 50) {
        return "★★★"; // Hard
    } else if (xp >= 30) {
        return "★★";   // Normal
    } else {
        return "★";     // Easy (10〜29)
    }
}

// ==========================================
//  ★ダークモードの切替制御
// ==========================================

function toggleDarkMode() {
    // bodyに .dark-mode クラスを付け外しする
    document.body.classList.toggle('dark-mode');
    
    // 現在の状態を確認
    const isDark = document.body.classList.contains('dark-mode');
    
    // アイコンを切り替える
    const btn = document.getElementById('dark-mode-btn');
    btn.innerText = isDark ? "☀️" : "🌑";

    // 保存する
    localStorage.setItem('dark-mode-setting', isDark ? 'enabled' : 'disabled');
}

// ページ読み込み時に設定を復元する（loadDataの中などに追加）
function loadTheme() {
    const savedTheme = localStorage.getItem('dark-mode-setting');
    if (savedTheme === 'enabled') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-btn').innerText = "☀️";
    }
}

// DOMContentLoadedの中で呼び出す
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadTheme(); // テーマを復元
    checkLoginBonus();
});