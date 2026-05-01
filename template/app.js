// [ai_s_emblem:#low#config Config]
const CONFIG = {
    // アプリの設定をここに書く
};
// [/ai_s_emblem: Config]

// [ai_s_emblem:#mid#L1 Setup]
// L1: Physical — DOM取得・イベント登録
function setupL1() {
    // ボタンやinputのイベントをここで登録する
}
// [/ai_s_emblem: Setup]

// [ai_s_emblem:#high#L3 Logic]
// L3: Logic — 純粋関数。副作用禁止。
// (REAL_state, command) => newState の形で書く
let REAL_state = {
    // アプリの状態をここに定義する
};

function applyCommand(state, command) {
    // commandの種類ごとに新しいstateを返す
    return state;
}
// [/ai_s_emblem: Logic]

// [ai_s_emblem:#mid#L4 Draw]
// L4: Draw — REAL_stateを元にDOMを更新する
function draw(state) {
    // 画面の描画処理をここに書く
}
// [/ai_s_emblem: Draw]

// [ai_s_bridge:L1toL2 Main]
// エントリーポイント
setupL1();
draw(REAL_state);
// [/ai_s_bridge: Main]
