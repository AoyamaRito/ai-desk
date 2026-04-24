# AI-Native 開発マスターバイブル (Unified V3.5 Final)

AIと人間が共創し、バグを絶滅させ、永続的な保守性を確保するための唯一無二の正典（Single Source of Truth）。

---

## 0. 基本原則 (Core Principles)
- **AI Drives All (AI専用コードベース)**: 人間は意図（Intent）の宣言のみを行い、コードの記述・構造化・命名・メタデータの付与はすべて AI が行う。本規約は「AIがコンテキストを失わず、バグを出さないこと」を最優先する。
- **Zero-Dependency / Zero-Server**: 外部ライブラリやブラックボックスなサーバーを排除し、推論の透明性を100%に保つ。
- **Physical Separation**: HTML(構造), CSS(表現), JS(論理)を物理的に分離し、疎結合を保つ。
- **Single Logic File (単一論理ファイル)**: ファイル分割（フラグメンテーション）は、AIのコンテキストを破壊する最大の敵である。そのため、論理層（JS）は必ず1ファイルに集約する。

## 1. ai-desk 協働プロトコル (§Emblem Management)
物理的なファイル分割を禁止する代償として、`ai-desk` ツールと `Emblem` タグを用いて「仮想的な認知境界」を運用する。

### 抽出と注入 (Extract & Inject)
AIは以下の3ステップで巨大なファイルを操作する。
1. **構造把握 (`skeleton`)**: `node ai-desk.js <file> skeleton` で目次を確認。
2. **局所読込 (`focus`)**: `node ai-desk.js <file> focus <Name>` で対象セクションのみを読み出す。
3. **部分適用 (`apply`)**: 変更したセクションだけを含むパッチファイルを作成し、`node ai-desk.js <file> apply <patch>` で安全に「注入（Injection）」する。

### エンブレムの定義
JSファイルは必ず以下のタグでセクション（機能の塊）を区切ること。
```javascript
// [ai_s_emblem:#<importance>#<category> Name]
// ... code ...
// [/ai_s_emblem: Name]
```
- **Name**: 一意でセマンティックな英数字+ハイフンの名前（日本語不可）。
- **#Importance**: `#high` (コア/論理), `#mid` (制御/UI), `#low` (初期化/定数)
- **#Category**: `#physical`, `#intent`, `#logic`, `#draw`, `#config` 等。

## 2. 4層バニラ・アーキテクチャ (§情報の環)
すべての情報の流れは、以下の4層を一方向にのみ流れること。

1. **L1: Physical (物理層)**: DOM取得、イベント登録、外部API（localStorage等）アクセス。
   - **禁忌**: ここで `REAL_state` を直接書き換えてはいけない。
2. **L2: Intent (意図層)**: 生のイベントを Command JSON に変換する。入力源（UI/リプレイ/AI操作等）を問わず L3 への唯一の入口。
   - **非同期と副作用**: 外部API呼び出しや重い非同期処理（通信等）は L2 で行い、その結果（成功・失敗）を Command として L3 に渡す。
   - 例: ドラッグ操作は L1 での 3種イベントを L2 で `DragCommit` 等の論理コマンドへ畳む。
3. **L3: Logic (論理層)**: `(REAL_state, Command) => newState` の Reducer として機能し、状態を純粋に更新する。
   - **イベントソーシング**: 受信した Command は履歴（イベントログ）として配列に追記し、ハッシュ計算を行う。
   - **副作用のトリガー**: 状態更新後、必ず `bridgeLogic2Draw()`, `bridgeLogic2Persistent()`, `bridgeLogic2Network()` 等の明示的な Bridge 関数を呼び出し、副作用を外界へ伝播させる。
4. **L4: Draw (描画層)**: `REAL_state` を元に DOM を狙撃更新（Sniper Update）する。
   - **ルール**: `document.activeElement` と一致する要素（入力中のテキストエリア等）は不用意に上書きしない。

## 3. REAL / SHADOW 規約 (§状態の純粋性)
同期漏れバグを物理的に絶滅させる。
- **REAL_<名前>**: 唯一の書き換え可能な真実。
- **shadow(REAL, 用途)**: REAL から作る使い捨ての派生値。**「保持（変数への保存）禁止」**。使う瞬間に生成し、使い終わったら捨てる。
- **一方向変換**: REAL → SHADOW への変換のみを許可。

## 4. 3Dplus 時空座標系 (§因果の投影)
次元に依存しない、親子関係における状態投影の枠組み。
- **純粋一方向変換**: 「ローカル座標」と「ワールド座標」を絶対に混ぜない。
- **Level-based Projection**: 再帰を禁止し、深さ0（親）から順にループでワールド状態を確定させる。
- **投影要素**: 位置・回転だけでなく、時間(t)、透明度(Alpha)、生存(Visibility)も「座標」として投影する。

## 5. データ永続化と証明 (§Persistence & Cryptography)
サーバーのDBに依存せず、データの信頼性と歴史をローカルで担保するための原則。
- **JSON + Event Sourcing**: 状態（State）の上書き保存を避け、状態を変更する「イベント（Command）」の履歴を JSON の配列として追記保存する。現在の状態は、初期状態から全イベントを再生（Reduce）することで決定される。
- **Sequential Hashing (直列ハッシュ)**: 各イベントは「一つ前のイベントのハッシュ値」を含めて自身のハッシュを計算する（ブロックチェーン的な直列構造）。これにより、履歴の改ざんや欠落を数学的に検知・防止する。
- **Dumb Relay & HTTP/3**: サーバーはロジックを持たない土管（Relay）に徹する。通信には HTTP/3 (WebTransport等) を用い、低遅延なストリームとしてデータを移送する。受信したJSONイベントのハッシュ整合性は必ずエッジ（L3: Logic）側で検証する。
- **Attestation Over Auth**: 中央集権的なログイン認証を廃し、公開鍵暗号による署名検証を権利の根拠とする。
- **Eternal Compatibility**: Web標準のみに従い、10年後も修正なしで動作し続けるコードを維持する。

---
**Version**: 2.0 (The One Bible Edition)
**Date**: 2026-04-25
**Author**: Hiroyuki OKINOI, Claude, Gemini CLI
