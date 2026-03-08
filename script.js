// ==========================================
//  1. 設定値と状態管理
// ==========================================
const GAME_CONFIG = {
    BASE_XP: 100,
    BONUS_XP: 50,
    XP_STEP_LEVEL: 5,
};

// ==========================================
//  ★Sound Manager (Web Audio API)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundManager = {
    // 初期値はミュート（'false'が明示的に保存されていない限りミュート）
    muted: localStorage.getItem('rpg_muted') !== 'false',

    play: function (type) {
        if (this.muted) return;
        // ブラウザの制限で、ユーザー操作があるまでAudioContextはサスペンド状態の場合がある
        if (audioCtx.state === 'suspended') audioCtx.resume();

        switch (type) {
            case 'success': this.playSuccess(); break;
            case 'levelup': this.playLevelUp(); break;
            case 'delete': this.playDelete(); break;
            case 'click': this.playClick(); break;
        }
    },

    toggleMute: function () {
        this.muted = !this.muted;
        localStorage.setItem('rpg_muted', this.muted);
        updateMuteButton();
        return this.muted;
    },

    // 完了音（キラキラした音）
    playSuccess: function () {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        // 高音へスライド
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // A6

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
    },

    // レベルアップ音（ファンファーレ風）
    playLevelUp: function () {
        const now = audioCtx.currentTime;
        this.playTone(523.25, now, 0.1);       // Do
        this.playTone(659.25, now + 0.1, 0.1); // Mi
        this.playTone(783.99, now + 0.2, 0.1); // Sol
        this.playTone(1046.50, now + 0.3, 0.4); // Do (高)
    },

    // 単音再生ヘルパー
    playTone: function (freq, time, duration) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'square'; // ファミコン風の矩形波
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.1, time);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.start(time);
        osc.stop(time + duration);
    },

    // 削除音（低いノイズっぽい音）
    playDelete: function () {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sawtooth'; // ノコギリ波
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);

        osc.start(now);
        osc.stop(now + 0.2);
    },

    // クリック音（短いプッという音）
    playClick: function () {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.start(now);
        osc.stop(now + 0.05);
    }
};

// UI更新用ヘルパー
function updateMuteButton() {
    const btn = document.getElementById('mute-btn');
    if (btn) btn.innerText = SoundManager.muted ? "🔇" : "🔊";
}

// ミュート切替関数（HTMLから呼ぶ）
function toggleMute() {
    SoundManager.toggleMute();
}

function triggerHapticFeedback(duration = 10) {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;
    if (typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(duration);
}

function initializeSoftTapFeedback(root = document) {
    const pressableElements = root.querySelectorAll('.soft-tap');

    pressableElements.forEach((element) => {
        if (element.dataset.softTapBound === 'true') return;
        element.dataset.softTapBound = 'true';

        const press = () => {
            element.classList.add('is-pressed');
            triggerHapticFeedback(10);
        };

        const release = () => {
            element.classList.remove('is-pressed');
        };

        if ('PointerEvent' in window) {
            element.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse') return;
                press();
            }, { passive: true });
            element.addEventListener('pointerup', release, { passive: true });
            element.addEventListener('pointercancel', release, { passive: true });
            element.addEventListener('pointerleave', release, { passive: true });
        } else {
            element.addEventListener('touchstart', press, { passive: true });
            element.addEventListener('touchend', release, { passive: true });
            element.addEventListener('touchcancel', release, { passive: true });
        }
    });
}


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
    updateMuteButton(); // ミュートボタンの初期状態反映
    initializeSoftTapFeedback();
});

const ui = {
    xpBar: document.getElementById('xp-bar-fill'),
    levelText: document.getElementById('level-display'),
    xpNeededText: document.getElementById('xp-needed'),
    modal: document.getElementById('login-modal'),
    questGrid: document.getElementById('quest-grid'),
    input: document.getElementById('new-quest-input')
};

// ==========================================
//  3. ゲームロジック
// ==========================================

function addXP(amount) {
    gameState.xp += amount;

    // レベルアップ判定
    let leveledUp = false;
    while (gameState.xp >= gameState.neededXp) {
        gameState.xp -= gameState.neededXp;
        gameState.level++;
        gameState.neededXp = calculateNextXP();
        leveledUp = true;
    }

    if (leveledUp) {
        SoundManager.play('levelup'); // ★レベルアップ音
        setTimeout(() => {
            alert(`🎉 レベルアップ！ Lv.${gameState.level} になりました！`);
        }, 100);
    } else {
        // レベルアップしなかった場合は完了音だけ（クリック時にならすかもだが、ボーナス等はここを通る）
        // ※通常クエスト完了は onclick で鳴らすので、ここはボーナスや連続用
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
    SoundManager.play('click'); // 追加ボタン音
    const text = ui.input.value.trim();
    if (!text) return;

    const newQuest = {
        id: Date.now(),
        title: text,
        emoji: getRandomEmoji(),
        xp: currentSelectedXP
    };

    questList.push(newQuest);
    ui.input.value = '';

    saveData();
    renderQuests();
}

// クエストを削除する
function deleteQuest(id) {
    SoundManager.play('click'); // 確認ダイアログが出る前のクリック音
    if (confirm("このクエストを削除しますか？")) {
        SoundManager.play('delete'); // ★削除音
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
    localStorage.setItem('rpg_quests', JSON.stringify(questList));
}

function loadData() {
    const savedLevel = localStorage.getItem('rpg_level');
    const savedXP = localStorage.getItem('rpg_xp');
    const savedQuests = localStorage.getItem('rpg_quests');

    if (savedLevel) gameState.level = parseInt(savedLevel);
    if (savedXP) gameState.xp = parseInt(savedXP);

    if (savedQuests) {
        questList = JSON.parse(savedQuests);
    } else {
        questList = [
            { id: 1, title: "早起き", emoji: "🌅", xp: 10 },
            { id: 2, title: "筋トレ", emoji: "💪", xp: 30 },
            { id: 3, title: "開発", emoji: "💻", xp: 50 }
        ];
    }

    gameState.neededXp = calculateNextXP();
    updateScreen();
    renderQuests();
}

function resetData() {
    SoundManager.play('click');
    if (confirm("データを全てリセットしますか？\nレベル・クエスト全て消えます。")) {
        SoundManager.play('delete');
        localStorage.clear();
        location.reload();
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
    ui.questGrid.innerHTML = "";

    questList.forEach(quest => {
        const div = document.createElement("div");
        div.className = "quest-icon soft-tap";

        const stars = getStarDisplay(quest.xp);
        div.innerHTML = `
            <button class="delete-btn soft-tap" onclick="event.stopPropagation(); deleteQuest(${quest.id})">×</button>
            <span class="emoji">${quest.emoji}</span>
            <span class="quest-title">${quest.title}</span>
            <span class="quest-stars">${stars}</span>
        `;

        div.onclick = () => {
            if (ui.questGrid.classList.contains('editing-mode')) {
                return;
            }

            // ★完了音を鳴らす
            SoundManager.play('success');

            addXP(quest.xp);
        };

        ui.questGrid.appendChild(div);
    });

    initializeSoftTapFeedback(ui.questGrid);
}

function checkLoginBonus() {
    const today = new Date().toLocaleDateString();
    const lastLoginDate = localStorage.getItem('rpg_last_login_date');
    if (lastLoginDate !== today) {
        setTimeout(() => {
            SoundManager.play('success'); // ボーナス表示時にも音を鳴らす
            ui.modal.classList.add('active');
        }, 500);
    }
}

function claimBonus() {
    SoundManager.play('click');
    addXP(GAME_CONFIG.BONUS_XP);
    localStorage.setItem('rpg_last_login_date', new Date().toLocaleDateString());
    ui.modal.classList.remove('active');
}

// ==========================================
//  ★編集モード（削除モード）の切替
// ==========================================
function toggleEditMode() {
    SoundManager.play('click');
    const grid = document.getElementById('quest-grid');
    grid.classList.toggle('editing-mode');
}

// ==========================================
//  ★難易度スイッチの動き制御
// ==========================================
function selectDifficulty(xp, index, btnElement) {
    SoundManager.play('click');
    currentSelectedXP = xp;

    const highlight = document.getElementById('diff-highlight');
    highlight.style.transform = `translateX(${index * 100}%)`;

    document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
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
    SoundManager.play('click');
    document.body.classList.toggle('dark-mode');

    const isDark = document.body.classList.contains('dark-mode');

    const btn = document.getElementById('dark-mode-btn');
    btn.innerText = isDark ? "☀️" : "🌑";

    localStorage.setItem('dark-mode-setting', isDark ? 'enabled' : 'disabled');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('dark-mode-setting');
    if (savedTheme === 'enabled') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-btn').innerText = "☀️";
    }
}
