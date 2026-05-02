<!-- @deps: setup, build, verify -->
# root-task

新機能をリリースする全体フロー。setup → build → verify の順で実行する。

---

<!-- @deps: install-deps, configure-env -->
# setup

開発環境を整える。

---

# install-deps

`npm install` を実行する。失敗したら node のバージョンを疑う。

---

<!-- @deps: install-deps -->
# configure-env

`.env.example` をコピーして `.env` を作る。

---

<!-- @deps: setup -->
# build

`node build-docs.js` を実行。生成物が想定サイズか確認。

---

<!-- @deps: build -->
# verify

テストを走らせて全 PASS を確認。

```bash
node --test
```
