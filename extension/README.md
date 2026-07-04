# KU Calendar 連携用 Chrome拡張機能

金沢大学ポータルおよびWebClass LMSのページから履修情報・課題情報を取得し、KU Calendar（本アプリ）に同期するChrome拡張機能（Manifest V3）。

---

## できること

- 履修登録一覧ページ（ポータル）から時間割情報を取得し、アプリへ同期
- シラバスページから教室情報を補完
- LMS（WebClass）の授業ページから課題・提出物情報を取得し、アプリへ同期
- ポータルの学期選択（Q1〜Q4）をアプリ側から遷移してきた際に自動選択

---

## ディレクトリ構成

```
extension/
├── manifest.template.json   # __APP_URL__ / __SUPABASE_URL__ をプレースホルダに持つテンプレート
├── manifest.json            # generate-manifest.js が生成する実ファイル（gitに含まれるが自動生成物）
├── scripts/
│   └── generate-manifest.js # .env.<mode> を読んでmanifest.template.jsonを置換
├── src/
│   ├── background/
│   │   └── background.ts    # Service Worker。fetch・トークン管理・タブ操作など権限が必要な処理
│   ├── content/
│   │   ├── content.ts       # ポータル/LMSページに注入されるUI（サイドパネル・ボタン）
│   │   └── appContent.ts    # KU Calendar本体（Webアプリ）側に注入し、拡張機能の状態をアプリに伝える
│   ├── popup/
│   │   ├── Popup.tsx, popup.ts, popup.html, popup.css  # 拡張機能アイコンクリック時のポップアップ
│   ├── parsers/              # 各ページのHTML解析
│   │   ├── registParser.ts        # 履修登録一覧
│   │   ├── syllabusParser.ts      # シラバス（教室情報）
│   │   ├── actingListParser.ts    # 授業実施一覧（LMS種別・LMSコースID）
│   │   ├── lmsCourseParser.ts     # LMS教材ページ
│   │   └── myReportsParser.ts     # LMSマイレポート（提出物）
│   ├── shared/
│   │   ├── api.ts, messages.ts, urls.ts  # バックエンド通信・メッセージ型・URL定数
│   └── page-bridge.js        # ページのメインワールドで`__doPostBack`を実行するためのブリッジ
├── icons/
└── package.json
```

---

## 環境変数

`.env.example` をコピーして使う。

```bash
cp .env.example .env.development   # ローカル開発用
cp .env.example .env.production    # 本番ビルド用
```

| 変数 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` | Supabaseプロジェクトのproject URL（`manifest.json`の`host_permissions`にも使われる） |
| `VITE_SUPABASE_ANON_KEY` | Supabaseのanon key |
| `VITE_APP_URL` | KU Calendar本体のURL（開発時は`http://localhost:5173`、本番はデプロイ先URL） |

`.env.local` を作ると `.env.<mode>` より優先して値を上書きできる（個人設定用、`.gitignore`済み）。

---

## ビルド

```bash
npm install

# 開発ビルド（.env.development を使用、localhost:5173 も対象に追加）
npm run build:dev

# 本番ビルド（.env.production を使用）
npm run build
```

内部的には `scripts/generate-manifest.js` が `.env.<mode>` を読んで `manifest.template.json` の `__APP_URL__` / `__SUPABASE_URL__` を置換し `manifest.json` を生成した上で、`background` / `content` / `popup` / `appContent` の4エントリーをそれぞれ `vite build` する。出力は `dist/` にまとまる。

個別のエントリーだけ監視ビルドしたい場合:

```bash
npm run dev:background
npm run dev:content
npm run dev:popup
```

---

## Chromeへの読み込み方法

1. `npm run build:dev` を実行（`dist/` が生成される）
2. Chromeで `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をON
4. 「パッケージ化されていない拡張機能を読み込む」→ `extension/dist` を選択

コードを変更したら再度ビルドし、`chrome://extensions` でリロードボタンを押す。

---

## 認証の仕組み

拡張機能は独自のログイン画面を持たない。KU Calendar本体（Webアプリ）にログインした際のSupabaseセッションを、拡張機能側の `chrome.storage.local` に受け渡して利用する。

```
Webアプリにログイン（Supabase Auth）
  ↓
appContent.ts（Webアプリのページに注入されているcontent script）が
ブラウザのlocalStorageからSupabaseのセッション（access_token / refresh_token）を読み取り
  ↓
chrome.storage.local に保存
  ↓
content.ts（ポータル/LMSページ）・popup・background.ts が
chrome.storage.local からトークンを読み、
Authorization: Bearer <token> でバックエンドAPIを呼ぶ
  ↓
（トークン失効時）background.ts がSupabaseのrefresh_tokenエンドポイントを叩いて
access_tokenを再発行し、chrome.storage.local を更新
```

`page-bridge.js` は上記とは別役割で、ポータルページの `__doPostBack`（ASP.NET標準のポストバック関数）をページのメインワールドから実行するための橋渡し専用スクリプト（Content ScriptのIsolated Worldからは直接呼べないため）。学期セレクタの自動切り替え（`shared/urls.ts` の `targetTerm` 処理）で使われる。

---

## バックエンドとの通信

呼び出すエンドポイントは本体アプリの [docs/API.md](../docs/API.md) の「拡張機能連携（extension）」を参照。

---

## UIデザイン

注入するUI（サイドパネル・ボタン等）のスタイル仕様は [DESIGN.md](./DESIGN.md) を参照。
