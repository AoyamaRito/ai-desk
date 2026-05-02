# add-feature

新機能を追加する手順。

まず Emblem の基本を理解する必要がある:

<!-- @expand: emblem-basics -->

次に ai-desk のワークフローを覚える:

<!-- @expand: workflow -->

最後に Bridge の概念:

<!-- @expand: bridge-concept -->

---

# emblem-basics

Emblem は仮想的な認知境界。コードのセクションを `// [ai_s_emblem:#layer Name]` で囲み、AI が局所的に編集できるようにする。

---

# workflow

ai-desk の標準フロー:

1. `skeleton` で構造把握
2. `focus <Name>` で対象 emblem を読む
3. patch.js を書く (タグは保ったまま中身だけ更新)
4. `apply patch.js` で原子的適用 (pre-flight 検証あり)

なお Emblem について再確認:

<!-- @expand: emblem-basics -->

これにより安全な狙撃編集ができる。

---

# bridge-concept

Bridge は層をまたぐ関数につけるタグ。`// [ai_s_bridge:L3toL4 Name]` のように方向を明示する。

副作用が層を越える場所を可視化することで、デバッグ時の影響範囲（blast radius）が明確になる。
