# スマホアプリ移行仕様書（App Store / Google Play 対応）

React Web アプリ「アカンサスカレンダー（KU-tasks）」を、App Store / Google Play に公開できるスマホアプリへ移行するための詳細仕様書。

- **目的**: 後日、下位モデル（実装補助AI）や経験の浅い実装者でも安全に実装できる粒度まで、画面・状態管理・API通信・認証・ネイティブ機能の仕様を明確化すること。
- **作成日**: 2026-07-08 / **最終更新**: 2026-07-08（改訂1: スマホ単体同期＝アプリ内ブラウザ方式を後続フェーズとして追加）
- **調査対象**: `main` ブランチ `569a2f1` 時点 + 未コミットの personal_events 拡張（location / description）・CalendarSidebar 追加
- **関連文書**: [cloudflare-hono-spec.md](./cloudflare-hono-spec.md)（バックエンドの Cloudflare Workers + Hono 移行仕様。API ベースURLの扱いはこちらの移行と両立させること）
- **本書の段階では実装しない。** 実装タスクは §8 に分解済み。フェーズ計画は §7。

---

## 1. 現在の Web フロント構成

### 1.1 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | React 19 + TypeScript + Vite 6 |
| ルーティング | react-router-dom v7（BrowserRouter, `frontend/src/App.tsx`） |
| カレンダー | FullCalendar 6（daygrid / timegrid / interaction） |
| DnD | @dnd-kit/core + sortable（タスクのカンバン） |
| ポップオーバー | @floating-ui/react |
| スタイル | Tailwind CSS 4 + インラインstyle + CSS変数（`--c-bg` 等） |
| 認証SDK | @supabase/supabase-js v2 |
| 状態管理 | React ローカルstate + Context（MeProvider）のみ。Redux / react-query 等は不使用 |
| ビルド配信 | `vite build` の出力を FastAPI の `backend/static/` から静的配信（SPA fallback） |

### 1.2 ページ一覧

| パス | ファイル | ガード | 概要 |
|---|---|---|---|
| `/login` | `pages/LoginPage.tsx` | Guest（ログイン済なら `/` へ） | メール+パスワード / Google ログイン |
| `/register` | `pages/RegisterPage.tsx` | Guest | メール+パスワード新規登録 |
| `/auth/callback` | `pages/AuthCallbackPage.tsx` | なし | OAuth PKCE の code→session 交換 |
| `/` | — | Private | `getHomePath()`（localStorage の `ku-home-path`、既定 `/courses`）へリダイレクト |
| `/calendar` | `pages/CalendarPage.tsx`（839行） | Private | FullCalendar 月/週/日表示。講義・大学行事・個人予定・課題締切を重ね描画 |
| `/courses` | `pages/CoursesPage.tsx`（366行） | Private | 時間割グリッド（年度・クォーター切替、講義CRUD） |
| `/tasks` | `pages/TasksPage.tsx`（1017行） | Private | 課題/Todo/完了の3カラムカンバン（DnD、モバイルはタブ切替） |
| `/admin/events` | `pages/AdminEventsPage.tsx` | Private + admin | 大学行事のCRUD（管理者のみ） |
| `*` | — | — | 「Not Found Page」の h2 のみ（専用画面なし） |

### 1.3 主要コンポーネント

| ファイル | 役割 |
|---|---|
| `Layout.tsx`（556行） | ヘッダー・ナビ・ユーザーメニュー（名前編集 / ホーム画面設定 / 課題取得モード / ログアウト）・モバイルドロワー・拡張機能導入バナー |
| `providers/MeProvider.tsx` | `/api/me` を1回fetchして Context 配布（`useMe()`） |
| `components/EventModal.tsx` / `EventCreatePopover.tsx` / `EventEditPopover.tsx` / `EventPopover.tsx` / `EventEditInline.tsx` | 個人予定の作成・編集・詳細表示（PC=ポップオーバー、モバイル=モーダル） |
| `pages/CalendarToolbar.tsx` / `CalendarSidebar.tsx` | カレンダーのビュー切替・レイヤー表示切替・ミニカレンダー |
| `components/tasks/`（14ファイル） | カンバンの列・カード・Todoブロック（`KanbanBoard` / `AssignmentColumn` / `TodoColumn` / `DoneColumn` / `TodoBlock` ほか） |
| `components/ExtensionBanner.tsx` + `hooks/useExtensionInstalled.ts` | Chrome拡張の導入案内。`window.postMessage` ping で拡張の有無を検出 |
| `hooks/useIsMobile.ts` | `matchMedia(max-width)` によるブレークポイント判定（既定640px、Layoutでは768px） |

### 1.4 状態管理

- **サーバ状態**: 各ページの `useEffect` 内で fetch → `useState` に保持。キャッシュ層なし（ページ遷移ごとに再fetch）。
- **グローバル状態**: `MeProvider`（プロフィール）と App.tsx の Supabase `session` のみ。
- **localStorage 依存（アプリ移行時に要注意）**:

| キー | 用途 | 書込箇所 |
|---|---|---|
| `ku-home-path` | ホーム画面設定（`/courses` or `/tasks`） | `App.tsx` / `Layout.tsx` |
| `ku-tasks-extension-installed` | 拡張検出キャッシュ | `useExtensionInstalled.ts` |
| カレンダーのレイヤー表示キー（`LAYER_STORAGE_KEY`） | 講義/行事/個人予定/課題の表示ON/OFF | `CalendarPage.tsx` |
| カンバン並び順・列幅・表示設定・モバイルタブ 一式 | `loadBoardOrder` / `saveColumnShares` など約10キー | `lib/tasksBoard.ts` |
| Supabase セッション（`sb-*-auth-token`） | アクセストークン+リフレッシュトークン | supabase-js 既定の localStorage 永続化 |

### 1.5 API 呼び出し箇所

- すべて `frontend/src/api/` に集約。`client.ts` の `authFetch()` が唯一の共通ラッパー。
- **URLはすべて相対パス**（`/api/...`）。Web版はフロントとAPIが同一オリジンなので成立しているが、**ネイティブアプリでは絶対URLが必須**（§4.3）。

| モジュール | 呼ぶAPI |
|---|---|
| `api/client.ts` | `authFetch`: Supabaseセッションから access_token を取り Bearer 付与。**401なら `signOut()` + `window.location.href = '/login'`** |
| `api/me.ts` | GET/PATCH `/api/me` |
| `api/courses.ts` | GET `/api/courses/{year}-{quarter}`, POST `/api/course`, PUT/DELETE `/api/course/{id}` |
| `api/calendar.ts` | GET `/api/calendar/{year}-{month}` |
| `api/tasks.ts` | GET `/api/assignments`, GET `/api/lms-system-types`, PUT `/api/assignments/{id}/done|board-status|title`, DELETE 同、GET/POST/PUT/DELETE `/api/todos` |
| `api/personalEvents.ts` | GET/POST/PUT/DELETE `/api/personal-events` |
| `api/universityEvents.ts` | GET `/api/university-events/{year}`, POST/PUT/DELETE（admin） |
| `api/auth.ts` | Supabase SDK 直呼び（signInWithPassword / signUp / signInWithOAuth / signOut） |

### 1.6 認証処理

- **Supabase Auth**。メール+パスワード、および Google OAuth（PKCE、`redirectTo: {origin}/auth/callback`）。
- `App.tsx` が `getSession()` + `onAuthStateChange` で session を保持し、`PrivateRoute` / `GuestRoute` で振り分け。
- トークンリフレッシュは supabase-js の autoRefreshToken（既定ON）に依存。バックエンドは JWKS で JWT 検証。
- 401 時は強制ログアウト（`client.ts`）。

### 1.7 スマホ表示で問題になりそうな UI（現状の実測観点)

| 箇所 | 問題 |
|---|---|
| CalendarPage の週表示（timeGridWeek） | 7列は幅375pxでは実用不可。ピンチズーム不可、横スクロールもない。モバイルは日表示/リスト表示が必要 |
| カレンダーのポップオーバー（Floating UI） | アンカー基準の吹き出しは小画面で画面外にはみ出しやすい。モバイルはボトムシート化が必要 |
| TasksPage のカンバン DnD | @dnd-kit の PointerSensor はタッチスクロールと競合しやすい。長押しディレイ設定がなく、スクロールしようとするとカードを掴む |
| TasksPage の3カラム | モバイルはタブ切替（`loadMobileTab`）で対応済みだが、列幅リサイズ用ハンドル等PC前提UIが残る |
| CoursesPage の時間割グリッド | 縦8限×週5-6列。横幅が足りず文字が潰れる |
| hoverに依存した操作 | `onMouseEnter` でのボタン表示・色変化が多数（Layout / Login / カード類）。タッチでは発火しない or 張り付く |
| キーボードショートカット | CalendarPage の `d/w/m` キーでのビュー切替はモバイル無意味（無害だが） |
| ヘッダー 52px + ドロワー | ネイティブのセーフエリア（ノッチ / ホームインジケータ）非対応。`env(safe-area-inset-*)` が未使用 |
| `window.location.reload()` | 名前保存後にフルリロード（Layout.tsx `handleSave`）。ネイティブWebViewでは白画面フラッシュが目立つ |
| 拡張機能バナー | モバイルでは「PC版Chromeで使ってください」という案内のみ。アプリでは文言・導線の再設計が必要（§5.5） |

### 1.8 Chrome 拡張の位置づけと、スマホアプリ版の位置づけ

履修情報・課題情報の取込みは、現在は Chrome 拡張（`extension/`）が大学ポータル（eduweb.sta.kanazawa-u.ac.jp）と WebClass LMS（lms-wc.el.kanazawa-u.ac.jp）をスクレイピングし、`POST /api/extension/import-*` でサーバへ upsert する構成。拡張は PC 版 Chrome 専用であり、この同期経路はスマホでは動かない。

これを踏まえたスマホアプリ版の位置づけは次のとおり:

- **初期リリース（Phase 1）**: PC版Chrome拡張またはWeb版で同期済みの履修・課題データを、スマホから**閲覧・編集・通知管理できる端末**とする。アプリ内での同期機能は持たない。
- **後続フェーズ（Phase 2〜4）**: アプリ内ブラウザ（In-App Browser / WebView）で大学ポータルおよび LMS をユーザー自身が開き、**スマホ単体でも履修情報・課題情報を同期できる**ようにする（詳細仕様は §6）。
- したがってスマホアプリ版は「閲覧専用端末」ではなく、**「初期は閲覧・操作中心、将来的には同期も可能なクライアント」**と位置づける。

制約・前提:

- アプリ内ブラウザ方式は WebView の DOM 読み取り可否・SSO ログイン可否・Cookie 保持など不確実性が高く、**技術検証（§6.7、T14〜T18）を通過するまで実装着手しない**。初期リリースはこの方式の成否に依存しない構成とする。
- 大学ポータル・LMS の ID/パスワードをアプリ・サーバーのいずれにも保存しない（§6.3）。サーバー側で認証情報を預かって自動取得する方式は原則採用しない（§6.8 代替案D）。
- 抽出対象・除外判定・重複判定などの仕様は**既存 Chrome 拡張の実装を正**とし、アプリ側はそれを参照・移植する（§6.6）。
- 将来サーバサイド同期（cloudflare-hono-spec の Cron 等）が実現した場合も、アプリ側は既存 API 経由で自動的に恩恵を受ける構成を崩さない。

---

## 2. アプリ化方針の比較

### 2.1 案A: Capacitor で既存 React をラップ

既存の Vite ビルド出力を Capacitor の WebView に載せ、ネイティブ機能はプラグイン（Preferences / Browser / Push Notifications / SecureStorage 等）で補う。

**メリット**

- フロントのコード資産（約7,600行 + テスト）をほぼ100%流用。FullCalendar / dnd-kit / Floating UI がそのまま動く。
- Web版とアプリ版が単一コードベース。バグ修正が両方に一度で反映される。
- モバイル対応（useIsMobile / モバイルタブ / ドロワー）が既に相当量実装済みで、その投資が活きる。
- 学習コストが低い。下位モデルへの実装指示が「既存ファイルの修正」中心になり、事故が少ない。
- Chrome 拡張のパーサー群（`extension/src/parsers/`）は DOM 文字列を受け取る純関数で書かれており、TypeScript のままアプリへ共通パッケージ化できる見込みがある（§6.6）。後続フェーズのスマホ単体同期とも相性がよい。

**デメリット**

- WebView 由来の操作感（スクロールの慣性、タップハイライト、300ms系の違和感）は残る。カレンダーのスワイプ等は自前実装。
- App Store 審査ガイドライン 4.2（最小限の機能）で「Webサイトをラップしただけ」と判定されるリスク → §5.5 の対策が必須。
- ネイティブUI（触覚フィードバック、ネイティブ画面遷移アニメ）は得られない。

### 2.2 案B: React Native / Expo で作り直し

**メリット**

- 完全なネイティブUI。スクロール・遷移・ジェスチャの品質が最高。審査で「WebViewアプリ」と見なされるリスクが構造的にゼロ。
- Expo の EAS Build / OTA Update / Push 通知など、モバイル運用ツールチェーンが揃っている。

**デメリット**

- **全画面の作り直し**。FullCalendar / dnd-kit / Floating UI / Tailwind は使えず、カレンダーUI（本アプリの核）を `react-native-calendars` 等で再構築。工数はフロント新規開発1本分。
- Web版と2コードベースになり、機能追加・バグ修正が常に2重化。個人開発の保守負荷として非現実的。
- Supabase 認証・APIクライアント・型定義は共有できるが、共有パッケージ化の設計コストが追加で発生。
- 大学ポータル/LMS の抽出ロジック（DOMParser ベース）を流用しにくい（RN には DOM がないため WebView 内実行に限定される）。

### 2.3 推奨方針: **案A（Capacitor）**

理由:

1. このプロダクトの差別化はネイティブな操作感ではなく「学年暦×時間割×課題同期」のデータ。UI品質勝負のアプリではない。
2. 個人開発 + 下位モデルでの実装という前提では、単一コードベース維持が最重要。
3. 初期リリース時点では課題同期がPC拡張依存であり、アプリの主用途は「閲覧・軽い編集」。WebViewで十分成立する。後続フェーズのスマホ単体同期（§6）も、WebView プラグイン + 既存 TypeScript パーサーの移植という Capacitor 前提の設計であり、案Aと整合する。
4. 審査リスク（4.2）はプッシュ通知・ネイティブ設定画面・オフラインキャッシュの追加で回避可能（§5.5)。将来もし否決が続く場合のみ案Bを再検討する。

採用構成: **Capacitor 6 + 既存 Vite ビルド + 以下のプラグイン**

| プラグイン | 用途 | フェーズ |
|---|---|---|
| `@capacitor/preferences` | localStorage 代替(設定値の永続化) | 1 |
| `@capacitor/browser` | Google / Apple OAuth 用の in-app browser（iOS: ASWebAuthenticationSession 相当）。**DOM 読み取り不可のため同期用途には使えない**（§6.2） | 1 |
| `@capacitor/app` | ディープリンク（OAuth コールバック）受信、バックボタン制御 | 1 |
| `@capacitor/push-notifications` | 課題締切通知（§5.5 の審査対策も兼ねる） | 1 |
| `capacitor-secure-storage-plugin`（または `@aparajita/capacitor-secure-storage`） | **Supabase の**リフレッシュトークンの Keychain / Keystore 保存（大学の認証情報は保存しない） | 1 |
| `@capacitor/splash-screen` / `@capacitor/status-bar` | 起動画面・ステータスバー | 1 |
| DOM 読み取り可能な WebView プラグイン（候補: `@capgo/inappbrowser`。T14 で選定） | 大学ポータル / LMS の表示 + ページ HTML の取得（スマホ単体同期用） | 2〜4（**要技術検証**） |

---

## 3. アプリ版画面仕様

### 3.1 画面一覧と遷移

```
[起動] → スプラッシュ → セッション確認
   ├─ セッションなし → (S1) ログイン ⇄ (S2) 新規登録
   │                      └─ OAuth → in-app browser → ディープリンク復帰 → (S3) コールバック処理
   └─ セッションあり → タブルート（ホーム設定のタブを初期表示）
        ├─ Tab1 (S4) カレンダー
        ├─ Tab2 (S5) 時間割
        │     └─ (S8) 履修情報を同期（Phase 3、アプリ内ブラウザ → 抽出確認 → 登録。§6.4）
        ├─ Tab3 (S6) タスク
        │     └─ (S9) 課題を同期（Phase 4、授業詳細 → LMS → 抽出確認 → 同期。§6.5）
        └─ Tab4 (S7) 設定
              └─ (S7a) プライバシーポリシー / (S7b) ライセンス / (S7c) 管理（admin のみ）
```

- ルーティングは既存の react-router をそのまま使い、`/calendar` `/courses` `/tasks` に `/settings` を追加。タブバーは Layout の置き換えとして実装（ネイティブタブではなく画面下固定の HTML タブバー）。
- Web版は現行ヘッダーを維持し、**タブバーは Capacitor 実行時（`Capacitor.isNativePlatform()`）のみ表示**。
- S8 / S9 は Phase 3 / 4 で追加する画面。Phase 1 のバイナリには含めない（ボタン自体を出さない）。

### 3.2 タブ構成

| タブ | アイコン | ルート | 備考 |
|---|---|---|---|
| カレンダー | calendar | `/calendar` | |
| 時間割 | grid | `/courses` | Phase 3 以降、ツールバーに「履修情報を同期」ボタンを追加 |
| タスク | check | `/tasks` | バッジ: 期限48時間以内の未完了課題数 |
| 設定 | gear | `/settings` | 新設画面 |

- タブバー高さ 56px + `env(safe-area-inset-bottom)`。アクティブ色 `#4B82F5`（既存ACCENT）。
- 既存の「ホーム画面設定（ku-home-path）」は初期表示タブの選択として引き継ぐ。

### 3.3 ログイン導線（S1–S3）

- S1 ログイン画面は既存 LoginPage を流用。変更点:
  - Google ログインボタン → `signInWithOAuth({ skipBrowserRedirect: true })` で URL を取得し `Browser.open()`。コールバックはカスタムURLスキーム `kutasks://auth/callback` をディープリンクで受け、`exchangeCodeForSession()`（§4.3）。
  - **Apple でサインイン ボタンを追加**（iOS 審査要件 4.8、§5.1）。Supabase の Apple プロバイダを有効化。
  - パスワードリセット導線が現状ないため「パスワードを忘れた場合」リンクを追加（`supabase.auth.resetPasswordForEmail`）。
- ログイン成功 → タブルートへ replace 遷移。失敗 → 画面内にエラーテキスト（既存様式）。
- ここでの「ログイン」は**本アプリ（Supabase）のログイン**であり、大学ポータル・LMS へのログインとは完全に別物（後者は §6.3）。

### 3.4 タスク一覧（S6）

- モバイル幅では既存実装どおり **3カラム→タブ切替**（課題 / Todo / 完了、`loadMobileTab` 永続化）を正とする。カラム幅リサイズハンドルはネイティブでは非表示。
- DnD は長押し 200ms 起動（dnd-kit `PointerSensor` の `activationConstraint: { delay: 200, tolerance: 8 }`）に変更し、縦スクロールと分離。
- カード操作: タップ=詳細/編集、チェックボックス=完了トグル、スワイプ操作は導入しない（実装コストと誤操作リスク）。
- 同期ボタン（手動モード時）の挙動:
  - Phase 1〜2: 「同期はPC版Chrome拡張から実行できます」の案内に差し替え。
  - Phase 4 以降: §6.5 の LMS 課題同期フローへの導線に差し替え。

### 3.5 カレンダー表示（S4）

- 初期ビュー: モバイルは `timeGridDay`、`listWeek`（FullCalendar list plugin を追加）と `dayGridMonth` をセグメントコントロールで切替。**timeGridWeek はネイティブでは選択肢から外す**。
- 日付ヘッダの左右スワイプで前後の日/月へ移動（FullCalendar API `prev()/next()` を touch イベントで呼ぶ）。
- イベントタップ → 既存 EventModal（モバイル分岐）をボトムシート様式に寄せる（下端から出す、角丸16px、セーフエリア考慮）。
- レイヤー切替（講義/行事/個人予定/課題）は CalendarSidebar 相当をモーダルシートに格納。設定は Preferences に永続化（§8 T3）。

### 3.6 設定画面（S7、新設）

Layout のユーザーメニュー/ドロワーに散っている項目を1画面に集約:

| セクション | 項目 | 由来 |
|---|---|---|
| アカウント | 表示名の編集（`PATCH /api/me`）。保存後はリロードではなく MeProvider の再fetch | Layout `handleSave` |
| 表示 | 初期表示タブ（旧ホーム画面設定） | `ku-home-path` |
| 課題取得 | auto / manual（`PATCH /api/me`） | Layout |
| 通知 | 課題締切通知 ON/OFF・何時間前か（§4.2 の新API） | 新規 |
| 同期 | 「PCでの同期方法」ヘルプ（Phase 1〜2）/ 履修・課題同期の説明と導線（Phase 3〜4） | 新規 |
| 情報 | プライバシーポリシー（アプリ内WebViewで `{API_BASE}/privacy` を表示）/ アプリバージョン / ライセンス / **本アプリは大学非公式である旨の明示** | 新規 |
| アカウント管理 | ログアウト / **アカウント削除**（§5.3、審査必須） | 新規 |
| 管理 | 大学行事管理（AdminEventsPage へ、admin のみ表示） | 既存 |

### 3.7 エラー表示・ローディング表示（全画面共通規約）

- **ローディング**: 初回ロードは既存 `ku-spinner` を画面中央。2回目以降はキャッシュ表示＋バックグラウンド更新（§4.5）でスピナーを出さない。ボタン系は既存どおり disabled + 文言変更（「ログイン中...」等）。
- **通信エラー**: fetch 失敗（TypeError）とレスポンス非OK を区別する。
  - オフライン/接続失敗: 画面上部に非モーダルのバナー「オフラインです。表示中のデータは最後に取得したものです」＋再試行ボタン。
  - 4xx/5xx: 操作起点のものはトースト（「保存に失敗しました」）、画面ロード起点のものは空状態＋再試行ボタン。
  - 401: §4.3 のとおりリフレッシュ再試行後にログイン画面へ。
- **空状態**: 課題0件・予定0件時は「PCのChrome拡張で同期すると課題が表示されます」等、次の行動が分かる文言を必ず添える（Phase 3 以降はスマホ同期への導線も併記）。

---

## 4. API 通信仕様

### 4.1 Web版と共通で使う API

§1.5 の全エンドポイントをそのまま使用する。アプリ専用の変更は不要（レスポンス形式・認証方式とも共通）。admin 系（university-events の POST/PUT/DELETE、`DELETE /api/courses`）もWeb同様 is_admin ガードで共通。

拡張系 `POST /api/extension/*` は Phase 1〜2 ではアプリから呼ばない。**Phase 3〜4（スマホ単体同期）では、アプリが Chrome 拡張と同じ立場でこれらを呼ぶ**（通常の Bearer 認証APIであり拡張専用の仕組みはないため、追加のバックエンド改修なしに流用できる想定。§6.4 / §6.5）:

| Method | Path | スマホ同期での用途 |
|---|---|---|
| POST | `/api/extension/import-courses` | 履修講義の一括upsert + syncスコープ外講義の削除（§6.4） |
| POST | `/api/extension/import-lms-tasks` | LMS課題の一括upsert（is_hidden復元・is_done保持ロジックはサーバ側にあり、アプリはそのまま恩恵を受ける。§6.5） |
| POST | `/api/extension/import-assignments` | レポート提出状況の upsert（my-reports 相当を取得できた場合のみ。§6.5） |

### 4.2 アプリ専用に必要な API（バックエンド追加分）

| Method | Path | 用途 | 備考 |
|---|---|---|---|
| POST | `/api/devices` | プッシュ通知トークン登録 `{ platform: 'ios'\|'android', token: string }` | upsert。FCM トークンを想定（iOS も FCM 経由に統一すると実装が単純） |
| DELETE | `/api/devices/{token}` | ログアウト時のトークン解除 | |
| PATCH | `/api/me` の拡張 | `notify_deadline_hours: number \| null`（null=通知OFF） | 既存 PATCH に項目追加 |
| DELETE | `/api/me` | **アカウント削除**（プロフィール・講義・課題・個人予定・通知設定・デバイストークンを削除し、Supabase Admin API でauthユーザーも削除） | App Store 必須要件（§5.3）。Web版にも露出してよい |

通知送信自体はサーバ側バッチ（cron: 期限が `notify_deadline_hours` 時間以内に入った未完了課題を持つユーザーのデバイスへFCM送信）。cloudflare-hono-spec の Workers 移行後は Cron Triggers で実装するのが自然。

スマホ単体同期（Phase 3〜4）用の新APIは**原則不要**（§4.1 のとおり既存 import 系を流用）。検証の結果、モバイル向けにペイロード分割等が必要になった場合のみ追加を検討する。

### 4.3 認証トークンの扱い

本節は**本アプリ（Supabase）の認証トークン**についての仕様。大学ポータル・LMS の認証情報の扱いは §6.3 を正とする（アプリ・サーバーとも保存しない）。

| 項目 | Web版（現状） | アプリ版（仕様） |
|---|---|---|
| セッション保存先 | localStorage（supabase-js 既定） | supabase-js の `auth.storage` オプションに **SecureStorage アダプタ**を渡す（access_token + refresh_token を Keychain / Android Keystore に保存）。WebViewのlocalStorageはOSアップデートやストレージ圧迫で消えることがあるため不可 |
| API ベースURL | 相対 `/api/...` | `client.ts` に `const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''` を導入し全モジュールで `${API_BASE}/api/...` に統一。Webビルドは空文字（従来どおり相対）、アプリビルドは本番URL（例 `https://<app>.onrender.com`。Workers移行後は `https://api.<domain>`) |
| OAuth | `signInWithOAuth` → 同一タブでリダイレクト | `skipBrowserRedirect: true` で URL 取得 → `@capacitor/browser` で開く → Supabase 側 Redirect URL に `kutasks://auth/callback` を登録 → `App.addListener('appUrlOpen')` で受信 → `exchangeCodeForSession(url)` → `Browser.close()` |
| 401時 | signOut + `window.location.href='/login'` | まず `supabase.auth.refreshSession()` を1回試し、成功なら元リクエストを再送。失敗時のみ signOut + ルーターの `navigate('/login')`（`window.location` は使わない） |

### 4.4 リフレッシュ処理

- supabase-js の `autoRefreshToken: true` を維持。ただし WebView はバックグラウンドでタイマーが止まるため、**`App.addListener('appStateChange')` で foreground 復帰時に `supabase.auth.startAutoRefresh()` / background 移行時に `stopAutoRefresh()`** を呼ぶ（Supabase 公式推奨パターン）。
- 復帰時は `getSession()` を await してから画面データを再fetchする（期限切れトークンでの401連発を防ぐ）。

### 4.5 オフライン時の挙動

方針: **read はキャッシュ表示、write はエラー即返し**（オフライン書込キューは初版では作らない。競合解決が複雑になりすぎるため）。

- GET 系（assignments / todos / calendar / courses / personal-events / university-events / me）は成功レスポンスを `Preferences` に `{ key: url, savedAt, body }` で保存。
- 画面ロード時: キャッシュがあれば即描画 → ネットワーク成功で置換（stale-while-revalidate）。fetch 失敗時はキャッシュ表示のまま §3.7 のオフラインバナーを出す。
- キャッシュ有効期限は7日。ログアウト時に全消去。
- POST/PUT/DELETE はオフライン時に即トースト「オフラインのため保存できません」。楽観更新中だった場合はロールバック（TasksPage には既に楽観更新実装があるため、失敗時ロールバック経路を流用）。
- スマホ単体同期（§6）はオンライン時のみ実行可能。オフライン時は同期ボタンを disabled にし「オンライン時に実行できます」と表示。

---

## 5. App Store 審査に向けた注意点

### 5.1 ログイン方法

- **Guideline 4.8（Login Services）**: Google ログインを提供する場合、iOS では「Sign in with Apple」等の同等選択肢が必須。→ Supabase の Apple プロバイダを有効化し、ログイン画面に Apple ボタンを Google と同格で並べる。Android 版には不要（コードは `Capacitor.getPlatform() === 'ios'` で分岐可）。
- メール+パスワードも残す（審査員がテストしやすい）。**審査提出時にデモアカウント（課題・時間割・予定がひととおり入ったもの）を App Review 情報欄に必ず記載**。
- **審査は実際の大学アカウントに依存させない**: 拡張同期もスマホ単体同期も審査員は実行できない（大学の在籍アカウントが必要）ため、デモデータをDBに事前投入したデモアカウントを用意し、同期機能はレビューノートで「大学在籍者のみが自身のアカウントで利用する機能」と説明する（§8 T23）。

### 5.2 プライバシーポリシー

- 既に `GET /privacy` で配信中（`backend/app/templates/privacy_policy.html`）。App Store Connect / Play Console のメタデータに公開URLとして登録し、アプリ内の設定画面からも到達できるようにする（§3.6）。
- 追記が必要な項目:
  - プッシュ通知トークンの収集、アカウント削除手順、（Apple ログイン追加後）Apple から受け取る情報。
  - **取得するデータの種類の明記**: 履修情報（授業名・教員名・曜日・時限・教室・クォーター・LMSリンク）、課題情報（課題名・授業名・提出期限・課題種別・提出状況・LMS URL）、個人予定、通知設定、デバイストークン。
  - **大学ポータル・LMS のログイン情報（ID/パスワード）は取得・保存しない**こと（Phase 2 以降のスマホ単体同期でも同様）。
  - スマホ単体同期は**ユーザー自身の操作により、本人の履修情報・課題情報のみを取得する**ものであること。

### 5.3 個人情報の扱い

- **App Privacy（プライバシー栄養ラベル）申告対象**: メールアドレス（アカウント）、氏名/表示名、ユーザーコンテンツ（予定・課題・Todo・履修情報）、識別子（プッシュトークン）。トラッキングなし・第三者広告なしと申告できる構成を維持する（アナリティクスSDKを安易に足さない）。
- **アカウント削除（Guideline 5.1.1(v)）**: アカウント作成があるアプリはアプリ内から完結する削除機能が必須 → `DELETE /api/me`（§4.2）+ 設定画面の削除ボタン（確認ダイアログ2段階）。削除対象には**取得済みの履修情報・課題情報・個人予定・通知設定・デバイストークン**をすべて含める。
- 大学ポータルの認証情報は、拡張・アプリ・サーバーのいずれでも一切保存しない（§6.3)。この点をプライバシーポリシーにも明記する。

### 5.4 外部サイト遷移・非公式アプリの明示

- 課題カードの `source_url`（WebClass等へのリンク）は、Phase 1〜2 では **`Browser.open()`（in-app browser）または外部ブラウザで開く**。Phase 4 以降は §6.5 の同期用 WebView 画面に統合してよい。
- プライバシーポリシー・利用規約類は in-app browser 表示で可。
- **本アプリが金沢大学の公式アプリではないことを明示する**: アプリ説明文（ストアメタデータ）・アプリ内の設定 > 情報・プライバシーポリシーの3箇所に「本アプリは金沢大学の公式アプリではありません」の旨を記載する。大学名・ロゴの扱いはストアの知的財産ガイドライン（Apple 5.2 / Play なりすまし規約）に抵触しないよう、大学ロゴは使用しない。

### 5.5 「WebViewだけのアプリ」に見えないための工夫（Guideline 4.2 対策）

最低限、以下をアプリ初版に含める。これらは審査対策であると同時に §2.3 の推奨を成立させる前提条件:

1. **プッシュ通知（課題締切通知）** — Webにない中核的付加価値。4.2 回避の最有力要素。
2. **オフラインキャッシュ表示**（§4.5） — 「ただのWebサイト」ではない挙動。
3. **ネイティブ調のタブバー + セーフエリア対応**（§3.2） — 見た目がWebサイトのままだと印象で落ちる。
4. **アプリ独自のタスク管理機能の明確化** — カンバン・Todo・完了管理・締切通知を、ストア説明文とスクリーンショットで「外部サイトの表示」ではなく本体機能として前面に出す。
5. スプラッシュスクリーン・アプリアイコン・ステータスバー配色の整備。
6. リモートURLを読み込まない: **Capacitor はローカルバンドルの dist を読み込む構成にする**（`server.url` で本番サイトを指すのは典型的なリジェクト事由）。アプリはあくまでローカルアセット + API 通信。
7. 拡張導入バナーはネイティブでは非表示にし、設定画面内の「PCでの同期方法」ヘルプに移す（アプリ起動直後に「Chromeで使え」と出るのは印象が最悪)。
8. Phase 2 以降で大学ポータル/LMS を WebView 表示する際も、それは**同期・参照のための補助画面**であり、アプリの主画面（カレンダー・時間割・タスク）はローカルUIであることが一目で分かる構成を維持する（WebView 画面には必ずアプリ側のヘッダー/完了ボタンを被せる）。

その他: Play Store 側はデータセーフティフォームの申告、iOS は暗号化輸出コンプライアンス（標準HTTPSのみ→免除申告）を忘れないこと。

---

## 6. アプリ内ブラウザ方式によるスマホ単体同期（Phase 2〜4）

### 6.1 位置づけ

- 方式名: **アプリ内ブラウザ方式（In-App Browser / WebView 方式）**。
- ユーザーがアプリ内ブラウザで大学ポータル / LMS を自分でログインして開き、アプリが表示中ページから情報を抽出し、**ユーザー確認のうえ**既存 API 経由で DB に登録する。
- **初期リリース（Phase 1）には含めない。** WebView の制約（DOM 読み取り・SSO・Cookie）に不確実性があるため、§6.7 の技術検証を通過したフェーズから順に実装する。本節は「できる」前提の断定仕様ではなく、検証項目とセットの設計仕様である。

### 6.2 方式概要

```
[アプリ画面] ─ボタン─▶ [アプリ内WebView] ─ユーザーが手動ログイン─▶ [ポータル/LMSページ]
                          │
                          └─ ページHTML取得（executeScript 等）
                                 │
                          [アプリ側で既存パーサー実行] → [確認UI（選択式）]
                                 │
                          ユーザーが「登録/同期」を押す
                                 │
                          [POST /api/extension/import-*]（既存API・Bearer認証）
```

- **`@capacitor/browser` は使えない**: 同プラグインは SFSafariViewController / Chrome Custom Tabs であり、アプリから DOM 読み取り・スクリプト注入が一切できない（OAuth 専用に使い続ける）。同期用には **DOM 読み取り（`executeScript` 相当）が可能な WebView プラグイン**が必要。第一候補は `@capgo/inappbrowser`（URL変化イベント + JavaScript 実行をサポート）。要件を満たさない場合は WKWebView / Android WebView を直接ラップする自作 Capacitor プラグインを検討する（T14 で選定）。
- 抽出は「表示中ページの HTML 文字列を取得 → アプリ側（Capacitor の WebView 内、DOMParser あり）で既存パーサーを実行」を基本とする。Chrome 拡張の content script のようなページ内常駐スクリプトは前提にしない（注入可否は環境依存のため。§6.7）。
- URL 監視（ロード完了イベント + URL パターン判定）で「目的のページに到達したか」を判定し、到達時のみ「読み取る」操作を有効化する。

### 6.3 ログイン情報の扱い（必須方針）

大学ポータル・LMS のログイン情報について、以下を**全フェーズ共通の必須方針**とする:

- アプリは大学ポータル・LMS の **ID/パスワードを保存しない**。アプリ独自のDB・localStorage・Preferences・Secure Storage のいずれにも保存しない（Secure Storage に入れるのは本アプリの Supabase トークンのみ）。
- サーバー側でも大学の認証情報は受信・保存しない（`/api/extension/*` に渡るのは抽出済みの履修・課題データのみ、という現行構造を維持する）。
- ログインは**ユーザーがアプリ内ブラウザ上で直接行う**。アプリはログインフォームに関与しない。
- ログイン状態は WebView / In-App Browser 側の **Cookie / セッションに委ねる**。アプリは Cookie の中身を読み取らない・保存しない・転送しない。
- Cookie やセッションが切れた場合は、同期フロー中に大学のログイン画面が表示されるので、**ユーザーに再ログインを促す**（アプリ側は「ログインが必要です。ログイン後に続行してください」と案内するだけ）。
- **認証情報の自動入力機能は初期仕様に含めない**（パスワードマネージャ的な機能はセキュリティレビューコストが高く、審査上も不利）。OS 標準のパスワード自動入力（iCloud キーチェーン等）が WebView 内で効く場合はそれに委ねる。
- アプリが保持するのは、**取得済みの履修情報・授業情報・課題情報・通知設定など、サービス利用に必要なデータのみ**とする。

### 6.4 時間割登録フロー（Phase 3）

エントリポイント: 時間割画面（S5）のツールバー「履修情報を同期」ボタン、および設定画面の同期セクション。

1. ユーザーがアプリ内で「時間割登録」（履修情報を同期）を押す。
2. アプリ内ブラウザで大学ポータル（`.../Portal/StudentApp/Top.aspx`）を開く。
3. 未ログインの場合、大学のログイン画面が表示される。**ユーザーが自分でログインする**（アプリは待つだけ。§6.3）。
4. 履修関連画面へ遷移する。原則はアプリが履修登録一覧（`RegistList.aspx?targetTerm=Q1..Q4`、`extension/src/shared/urls.ts` の `buildRegistListUrl`）へ URL 指定で誘導し、対象クォーターを順に開く。直接遷移がセッション上不可の場合はユーザーの画面内操作で遷移してもらう（T15 で検証）。
5. アプリが表示中ページの HTML を取得し、履修科目候補を抽出する（`registParser.parseRegisteredCourses` を正とする。抽選漏れ授業の除外・集中講義の扱いも同パーサーに従う）。
6. 抽出した履修科目一覧を**アプリ側UI**（WebView を閉じた後の確認画面）で表示する。表示項目: 授業名・教員名・曜日・時限・クォーター・単位・区分。
7. ユーザーが登録する科目を選択する（既定は全選択。個別にチェックを外せる）。
8. ユーザーが「登録」ボタンを押す。
9. 選択した科目を `POST /api/extension/import-courses` でアプリDBへ同期する（`sync_year` / `sync_quarters` は取得対象クォーターに合わせる）。
10. 同期完了後、時間割・カレンダー・授業一覧に反映する（該当画面のデータ再フェッチ + キャッシュ更新）。

必須要件:

- **ユーザー確認は必須**。自動で全件登録せず、手順 6〜8 の確認・選択ステップを省略しない。
- `import-courses` は**同期スコープ内でリストにない講義を削除する**サーバ仕様のため、確認UIに「選択しなかった科目・ポータルから消えた科目は時間割から削除されます」と明示する。
- 抽出0件・パース失敗時は「ページを読み取れませんでした」+ 対処（対象画面へ移動してから再実行 / PCでの同期案内）を表示する（§8 T22）。

### 6.5 LMS 課題取得フロー（Phase 4）

エントリポイント: 授業一覧・時間割の授業タップ → 授業詳細画面、およびタスク画面の同期ボタン（手動モード時）。

1. ユーザーがアプリ内の授業一覧または時間割から授業をタップする。
2. 授業詳細画面（授業名・教室・教員・LMSリンク）を開く。
3. 「LMSを開く」または「課題を同期」ボタンを押す。
4. アプリ内ブラウザで該当授業の LMS ページ（`lms-wc.el.kanazawa-u.ac.jp/webclass/course.php/{courseId}`。SSO リンク経由の場合は `acanthus.cis.kanazawa-u.ac.jp` の SSO ベースURL）を開く。
5. 未ログインの場合、**ユーザーが LMS（SSO含む）へ自分でログインする**（§6.3）。
6. LMS 授業ページに到達したら（URL パターン `course.php/{courseId}` で判定）、アプリがページ HTML を取得し課題候補を抽出する。
7. **抽出対象・除外対象は既存 Chrome 拡張の実装を正とする**（`lmsCourseParser.parseLmsCoursePage`: `data-contents-id` 要素の名称・種別・開始/終了日時・実施回数・URL を取得。課題/資料の判定は既存の kind 判定に従う）。提出状況（my-reports、`acs_` トークンが必要）まで取得できるかは T16/T18 の検証結果に依存し、取得できない場合は課題一覧のみ同期する。
8. 抽出した課題候補を**アプリ側UI**で表示する。表示項目: 課題名・種別・期限・(取得できれば)提出状況。
9. ユーザーが同期対象を確認する（既定は全選択。個別に外せる）。
10. ユーザーが「課題を同期」ボタンを押し、`POST /api/extension/import-lms-tasks`（+ 提出状況が取れた場合は `import-assignments`）で DB へ登録する。
11. **既存課題との重複判定・完了状態（is_done）の維持・非表示（is_hidden）の扱いは、既存 Chrome 拡張・既存 API（サーバ側 upsert ロジック）の仕様に合わせる**。これらの判定はサーバ側 `backend/app/api/extension.py` に実装済みのため、アプリ側で独自の重複判定を実装しない。

### 6.6 取得対象ルール（既存 Chrome 拡張を正とする）

- **既存 Chrome 拡張（`extension/src/`）で取得している項目を基準にする。** 本仕様書に列挙する項目はあくまで例示であり、差異があれば拡張の実装が正。
- 抽出ロジックの所在と移植可能性（2026-07-08 時点の実装調査に基づく）:

| モジュール | 内容 | 移植可能性 |
|---|---|---|
| `extension/src/parsers/registParser.ts`（116行） | 履修登録一覧のパース（`(html: string) => ParsedCourse[]`） | **高**: DOMParser ベースの純関数。Capacitor アプリの WebView 内でそのまま動く見込み |
| `extension/src/parsers/lmsCourseParser.ts`（58行） | LMS 授業ページのパース（同上） | **高**: 同上 |
| `extension/src/parsers/myReportsParser.ts`（49行） | 提出状況（my-reports）のパース | **高**（ただしページ到達に `acs_` トークンが必要 → 到達手段は要検証 T16/T18） |
| `extension/src/parsers/lectureDetailParser.ts` ほか | 授業詳細・シラバス等 | 高（同構造） |
| `extension/src/content/content.ts`（1,228行） | ページ巡回・待機・メッセージング等のオーケストレーション | **低**: `chrome.*` API・content script 前提。**移植せず、アプリ用に §6.4/6.5 のフローとして再実装**する |
| `extension/src/background/background.ts` / `shared/api.ts` | タブ制御・API送信 | 低/不要: API送信はアプリの `authFetch` で代替 |

- 方針: **パーサー群を共通パッケージ化する**（例: リポジトリ内 `shared/parsers/` に移し、拡張とフロントの両方から import。ビルド設定の都合で困難なら、当面はソースコピー + 「拡張側が正、変更時は同期する」旨のコメントで運用）。スマホアプリ側では移植可否を T17/T18 で実機検証し、**完全移植が難しい場合は WebView 用に再実装する**（その場合も入出力型は拡張のパーサーと一致させる）。
- 履修情報の取得項目（例。`ParsedCourse` 準拠）: 授業名 / 教員名 / 曜日 / 時限 / 教室(授業詳細から) / クォーター / 年度 / 講義コード(lctCd) / 単位 / 区分 / LMSリンク。
- 課題情報の取得項目（例。`ParsedLmsContent` / `ParsedReport` 準拠）: 課題名 / 授業名 / 提出期限(start/endDate) / 課題種別(kind) / 提出状況(result・score) / LMS URL(sourceUrl)。
- **課題の除外・対象判定**（資料と課題の区別、`is_assignment_candidate` 相当の判定）も既存 Chrome 拡張 + サーバ側の仕様に合わせる。
- **既存の is_done 維持・is_hidden 再表示・重複判定などの挙動も維持する**。これらはサーバ側 upsert（`/api/extension/import-lms-tasks` 等）に実装済みのため、アプリは同じ API を同じペイロード形式で呼ぶことで自動的に維持される。

### 6.7 技術検証項目（Phase 2 のゲート。通過するまで Phase 3 以降に着手しない）

いずれも「できる」と断定しない。iOS / Android 両方の実機で検証し、結果を `docs/migration/` 配下の検証レポートに記録する（T14〜T18）。

| # | 検証項目 | 判定基準 | 想定リスク |
|---|---|---|---|
| V1 | Capacitor で外部サイト（ポータル/LMS）をアプリ内ブラウザ表示できるか | 対象プラグインで両サイトが表示・操作できる | プラグインの成熟度、表示崩れ |
| V2 | WebView / In-App Browser で大学ポータルのログイン状態を保持できるか（同一同期セッション内） | ログイン → 画面遷移してもセッション維持 | Cookie分離、リダイレクトループ |
| V3 | SSO ログイン（acanthus 経由の学内SSO）が WebView 内で正常に完了するか | ポータル/LMS 双方でログイン完走 | SSO が WebView をブロック、証明書/パスキー要求、JavaScript 依存の遷移失敗 |
| V4 | Cookie / セッションがアプリ再起動後も維持されるか | 再起動後に再ログイン不要なら加点。**維持されない前提でも UX が成立する設計**（毎回ログイン）とする | iOS ITP / WKWebView の Cookie 永続化制限 |
| V5 | 表示中ページの DOM（HTML）をアプリ側から読み取れるか | `executeScript` 等で `document.documentElement.outerHTML` が取得できる | プラグインAPIの制約、フレーム分割ページ |
| V6 | CSP や Same-Origin 制約により DOM 取得・スクリプト注入が制限されないか | 対象4ページ種（Top / RegistList / LMS course / my-reports）で取得成功 | ポータル側 CSP、`javascript:` 無効化 |
| V7 | iOS WKWebView と Android WebView で挙動差がないか | 両OSで V1〜V6 が同等に成立 | iOS のみ Cookie 制限が厳しい等の非対称 |
| V8 | 既存 Chrome 拡張の content script 相当の処理（ページ内でのDOM参照）を Capacitor 環境で実現できるか | 注入が無理でも「HTML 取得 → アプリ側でパース」で代替成立するか | 動的レンダリング（ロード完了前の取得）、ASP.NET ポストバック画面 |
| V9 | my-reports ページ（`acs_` トークン付きURL）に WebView 経由で到達できるか | LMS 授業ページからのリンク辿りで到達可 | トークンの取得経路が content script 前提 |

- **V1・V5・V6 のいずれかが両OSで不成立の場合、アプリ内ブラウザ方式は断念し §6.8 の代替案へ切り替える**（この判断も検証レポートに明記する）。
- V3（SSO）のみ不成立の場合は、ユーザーが Safari/Chrome でログインする方式は取れない（Cookie が共有されない）ため、同じく代替案検討となる。

### 6.8 代替案（アプリ内ブラウザ方式が不成立・部分成立の場合）

| 案 | 内容 | 位置づけ |
|---|---|---|
| **代替案A: PC同期前提** | 初期リリースと同じく、PC版Chrome拡張で同期したデータをスマホで閲覧・編集する構成を継続する。 | フォールバックの既定。Phase 1 の成果物がそのまま製品として成立するため、方式断念時のリスクは「機能追加が止まる」だけに抑えられる |
| **代替案B: 手動登録** | スマホアプリ上で授業・課題を手動登録できるUIを追加する（授業: 名称・曜日・時限・教室、課題: 名称・授業・期限・種別）。既存 `POST /api/course` / `POST /api/todos` を流用し、必要なら課題の手動作成APIを追加する。 | 同期が全滅した場合の最低限の単体利用手段。工数小・審査リスクなし |
| **代替案C: 共有リンク・URL入力** | ユーザーが LMS ページの URL をアプリに貼り付け（またはOSの共有シートから受け取り）、アプリが可能な範囲で課題情報を取得する。認証必須ページはサーバ側から取得できないため、取得できる情報は限定的（URL からの courseId 抽出 + 授業紐付け程度）になる可能性が高い。 | 部分的な補助機能。単独では同期の代替にならない点を明記 |
| **代替案D: サーバー側取得（原則不採用）** | 大学ポータルの ID/パスワードをサーバーで預かり、サーバーが自動ログインして取得する方式。**セキュリティ（平文相当での認証情報保管）・大学の利用規約・アカウントロック等の運用リスクが高いため、原則採用しない。** 本仕様書の全フェーズを通じて検討対象から除外する。 | 不採用の明文化（将来の議論の蒸し返し防止） |

---

## 7. フェーズ計画

| フェーズ | 内容 | 対応タスク | リリース判断 |
|---|---|---|---|
| **Phase 1: アプリ基盤（初期リリース）** | API絶対URL化 / 401リフレッシュ再試行 / ストレージ抽象化 / 設定画面 / タッチUI調整 / Capacitor導入 / iOS・Androidビルド / タブバー / SecureStorage / OAuth / オフラインキャッシュ / アカウント削除 / プッシュ通知 / ストア提出 — **App Store 審査に必要な最低限の機能一式** | T1〜T13 | ここで**初期リリース（審査提出）**。スマホ単体同期は含めない |
| **Phase 2: アプリ内ブラウザ導入・技術検証** | 大学ポータル/LMS をアプリ内ブラウザで開く / WebView の Cookie・セッション検証 / ログイン状態保持の検証 / DOM 読み取り検証 / 外部サイト表示時の UX 整備（アプリ側ヘッダー・閉じる導線） | T14〜T16 | §6.7 のゲート判定。**不成立なら §6.8 代替案へ分岐**し Phase 3/4 は中止 |
| **Phase 3: スマホ履修同期** | 履修画面への誘導遷移 / 表示中ページからの履修候補抽出 / 抽出結果の確認・選択UI / 選択科目の登録 / 既存 `import-courses` API 接続 | T17, T19, T21（履修分）, T22 | 検証通過後。アップデートとして審査再提出 |
| **Phase 4: スマホ LMS 課題同期** | 授業詳細から LMS を開く / LMS ページ到達判定 / 課題候補抽出 / 確認UI / 既存課題との重複判定（サーバ委譲） / DB同期 | T18, T20, T21（課題分）, T22 | 同上 |
| **Phase 5: 安定化・審査対応** | iOS/Android 差分対応 / セッション切れ時の再ログイン導線 / 同期失敗時のエラー表示 / プライバシーポリシー更新（同期機能の記載追加） / 審査用デモ環境整備 | T22, T23 + バグ修正 | Phase 3/4 の機能を審査に通す最終整備 |

- Phase 1 は §6 の成否と無関係に単体で製品として成立させる（＝代替案Aがそのまま保険になる）。
- Phase 2 以降の各フェーズ完了時にプライバシーポリシー・ストア説明文の記載が実装と一致しているかを必ず確認する（§5.2 / §5.4）。

---

## 8. 下位モデル向け実装タスク分解

実装順。各タスクは独立して PR にできる粒度。**T1〜T5 は Web 版の挙動を変えない準備工事**なので先行マージ可能。T1〜T13 が Phase 1（初期リリース）、T14〜T23 が Phase 2〜5（スマホ単体同期）。

> 共通完了条件: `docker compose -f compose.yml -f compose.override.yml exec app bash -c "cd frontend && npm run typecheck && npm run lint && npm run test"` が全て通ること。

---

### T1. API ベースURLの導入

- **目的**: 相対パス前提を外し、ネイティブから本番APIを叩けるようにする。
- **対象**: `frontend/src/api/client.ts`、`frontend/src/api/*.ts`（6ファイル）、`frontend/.env.example`
- **変更**: `client.ts` に `export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''` を追加。`authFetch` の引数が `/api` で始まる文字列なら `API_BASE` を前置する実装にする（呼び出し側6ファイルは無修正で済む）。`.env.example` に `VITE_API_BASE_URL=` を追記。
- **完了条件**: `VITE_API_BASE_URL` 未設定で従来どおり相対パスで動く。設定時は全fetchが絶対URLになる。
- **テスト**: `client.ts` のURL組立を関数に切り出し、vitest で「未設定→`/api/me`」「設定→`https://x/api/me`」の2ケースを追加。

### T2. 401ハンドリングとナビゲーションの整理

- **目的**: `window.location.href` / `window.location.reload()` 依存を除去し、リフレッシュ再試行を入れる。
- **対象**: `frontend/src/api/client.ts`、`frontend/src/Layout.tsx`
- **変更**: ① `authFetch` で401時に `supabase.auth.refreshSession()` → 成功なら1回だけ再送、失敗なら `signOut()` して `window.dispatchEvent(new Event('ku-auth-expired'))`。`App.tsx` でこのイベントを listen して `navigate('/login')`。② Layout の表示名保存後の `window.location.reload()` を、MeProvider に追加する `refetch()`（Context 経由で公開）呼び出しに置換。
- **完了条件**: 期限切れトークンで一度だけ自動リフレッシュされる。名前変更後リロードなしで新しい名前が表示される。
- **テスト**: vitest で authFetch をモックし「401→refresh成功→再送1回」「401→refresh失敗→signOut」の2ケース。名前変更は手動確認（/settings 実装前は既存メニューで）。

### T3. ストレージ抽象層の導入

- **目的**: localStorage 直参照を排し、ネイティブでは Capacitor Preferences に切替可能にする。
- **対象**: 新規 `frontend/src/lib/storage.ts`、`frontend/src/lib/tasksBoard.ts`、`frontend/src/App.tsx`、`Layout.tsx`、`pages/CalendarPage.tsx`、`hooks/useExtensionInstalled.ts`
- **変更**: `storage.ts` に同期API `getItem/setItem/removeItem`（Web: localStorage、ネイティブ: 起動時に Preferences を一括ロードしてメモリミラー + 書込時に非同期で Preferences へ反映）を実装。既存の `localStorage.getItem/setItem` 呼び出しを全て `storage.getItem/setItem` に機械置換。
- **完了条件**: Webビルドで従来と同一挙動（既存キーがそのまま読める）。`grep -rn "localStorage" frontend/src --include="*.ts*" | grep -v test | grep -v storage.ts` が0件。
- **テスト**: 既存の tasksBoard.test.ts が無修正で通ること。storage.ts 単体テストを追加。

### T4. 設定画面（/settings）の新設

- **目的**: §3.6 の設定画面。Web版でもモバイル幅の設定導線改善として先行リリース可能。
- **対象**: 新規 `frontend/src/pages/SettingsPage.tsx`、`frontend/src/App.tsx`（ルート追加）、`Layout.tsx`（モバイルドロワーから設定項目を撤去しリンクに置換）
- **変更**: §3.6 の表のうち「アカウント・表示・課題取得・情報（プライバシーポリシーへのリンク）・ログアウト・管理リンク」を実装。通知とアカウント削除は T10/T11 で追加。
- **完了条件**: /settings で表示名変更・初期タブ変更・同期モード変更・ログアウトができ、既存メニューと二重管理になっていない。
- **テスト**: RTL で「表示名を編集→保存→PATCH /api/me が呼ばれ表示が更新される」テストを追加。他は手動確認。

### T5. モバイルUI調整(タッチ対応)

- **目的**: §1.7 のタッチ起因問題の解消。Web版のスマホブラウザ利用者にもそのまま効く。
- **対象**: `frontend/src/pages/TasksPage.tsx`（PointerSensor 設定）、`pages/CalendarPage.tsx` + `CalendarToolbar.tsx`（モバイル時の初期ビュー/ビュー選択肢変更、`@fullcalendar/list` 追加）、`components/EventModal.tsx`（ボトムシート化）、`frontend/index.html` + 全体CSS（`viewport-fit=cover` と `env(safe-area-inset-*)` パディング）
- **変更**: ① dnd-kit の `useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } })`（モバイル時のみ）。② `useIsMobile()` 時は初期ビュー `timeGridDay`、選択肢を 日/リスト/月 に。`npm i @fullcalendar/list`。③ EventModal をモバイル時に下端固定・角丸上のみ・下パディング `env(safe-area-inset-bottom)` に。
- **完了条件**: 実機相当（Chrome DevTools のタッチエミュレーション）で、タスク一覧が普通に縦スクロールでき、長押しでのみDnDが始まる。カレンダー初期表示が日表示になる。
- **テスト**: 既存テスト（TasksPage.*.test.tsx）が通ること + 手動確認（DevTools デバイスモード）。

### T6. Capacitor 導入とビルドパイプライン

- **目的**: iOS / Android プロジェクトの生成とローカルバンドル読み込み。
- **対象**: `frontend/package.json`、新規 `frontend/capacitor.config.ts`、生成物 `frontend/ios/` `frontend/android/`、`README.md`
- **変更**: `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/app @capacitor/browser @capacitor/preferences @capacitor/splash-screen @capacitor/status-bar`。`npx cap init`（appId 例: `jp.kutasks.app`、appName: アカンサスカレンダー、webDir: `dist`）。**`server.url` は設定しない**（§5.5-6）。ビルド手順（`npm run build && npx cap sync && npx cap open ios`）を README に追記。アプリビルド用に `.env.production.mobile`（`VITE_API_BASE_URL=本番URL`）を用意し、`npm run build:mobile`（`vite build --mode production.mobile`）スクリプトを追加。
- **完了条件**: iOS シミュレータ / Android エミュレータでアプリが起動し、ログイン画面が表示され、メール+パスワードログインで本番（またはステージング）APIからデータが表示される。
- **テスト**: 手動（シミュレータ起動確認）。Webビルドが影響を受けないこと（`npm run build` 成功）。

### T7. ネイティブ検出とタブバー

- **目的**: §3.1–3.2 のタブナビゲーション。
- **対象**: 新規 `frontend/src/lib/platform.ts`（`isNative()` = `Capacitor.isNativePlatform()` のラッパー、Web では false）、新規 `frontend/src/components/TabBar.tsx`、`frontend/src/Layout.tsx`
- **変更**: Layout で `isNative()` の場合はヘッダーの代わりに `<TabBar />`（カレンダー/時間割/タスク/設定の4タブ、`NavLink` ベース、下固定、`padding-bottom: env(safe-area-inset-bottom)`）を描画し、拡張バナー2種は描画しない。タスクタブのバッジは `fetchAssignments` 結果から期限48h以内の未完了数（TasksPage 到達前はバッジなしで可、実装を単純に保つ）。
- **完了条件**: ネイティブ実行時のみタブバー表示、Web は従来ヘッダーのまま（`npm run test` 全通過）。4タブすべて遷移可能。
- **テスト**: `platform.ts` をモックして「native時にタブバー、web時にヘッダー」を RTL で1ケースずつ。

### T8. Supabase セッションの SecureStorage 化とライフサイクル対応

- **目的**: §4.3 / §4.4。トークンの安全な保管とバックグラウンド復帰時のリフレッシュ。
- **対象**: `frontend/src/lib/supabase.ts`、`frontend/src/main.tsx`
- **変更**: ① `capacitor-secure-storage-plugin` を導入し、`isNative()` のとき `createClient(..., { auth: { storage: secureStorageAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`。アダプタは `getItem/setItem/removeItem` を Promise で実装。② `main.tsx` で native 時に `App.addListener('appStateChange', ...)` → active で `supabase.auth.startAutoRefresh()`、inactive で `stopAutoRefresh()`。
- **完了条件**: アプリ再起動後もログイン状態が維持される。1時間放置→復帰でAPIが401にならない。Webビルドは従来どおり localStorage。
- **テスト**: アダプタの単体テスト（モックストレージでget/set/remove）。復帰リフレッシュは手動確認。

### T9. OAuth（Google / Apple）のネイティブ対応

- **目的**: §3.3 / §4.3 のディープリンク方式 OAuth。
- **対象**: `frontend/src/api/auth.ts`、`frontend/src/pages/LoginPage.tsx`、`frontend/src/main.tsx`（appUrlOpen リスナー）、`ios/App/App/Info.plist` + `android/app/src/main/AndroidManifest.xml`（URLスキーム `kutasks` 登録）、Supabase ダッシュボード（Redirect URLs に `kutasks://auth/callback` 追加、Apple プロバイダ有効化）
- **変更**: ① `loginWithGoogle()` を native 時 `signInWithOAuth({ provider, options: { redirectTo: 'kutasks://auth/callback', skipBrowserRedirect: true } })` → 返却URLを `Browser.open()`。② `appUrlOpen` で `kutasks://auth/callback` を受けたら `exchangeCodeForSession(url)` → `Browser.close()` → ホームへ navigate。③ LoginPage に `loginWithApple()` ボタンを追加し **iOS のみ表示**。④ パスワードリセットリンク追加（`resetPasswordForEmail`、リダイレクトはWeb側 `/auth/callback` でよい）。
- **完了条件**: iOS 実機/シミュレータで Google・Apple ログインが完走しタブ画面に到達。Android で Google ログイン完走。Web の OAuth フローが従来どおり動く。
- **テスト**: 手動（両OS）。auth.ts の native/web 分岐は vitest でモック検証。

### T10. オフラインキャッシュ（read系 stale-while-revalidate）

- **目的**: §4.5。
- **対象**: 新規 `frontend/src/api/cache.ts`、`frontend/src/api/client.ts`、各ページ（fetch呼び出し箇所は変更不要にする）、新規 `frontend/src/components/OfflineBanner.tsx`、`Layout.tsx`
- **変更**: ① `authFetch` の GET 成功時に `cache.ts` 経由で `storage`（T3）へ `{ savedAt, body }` 保存。② GET 失敗（TypeError）時、キャッシュがあれば `Response` を合成して返し `window.dispatchEvent(new Event('ku-offline'))`、なければ throw。7日超のキャッシュは無視。③ OfflineBanner はイベントで表示、オンライン復帰（`window.addEventListener('online')`）または再試行成功で消す。④ ログアウト時 `cache.clear()`。
- **完了条件**: DevTools オフラインで、直前に見たカレンダー/タスク/時間割が表示され、バナーが出る。書込操作はエラートーストになりデータ不整合が起きない。
- **テスト**: cache.ts 単体テスト（保存/期限切れ/クリア）。authFetch の「オフライン→キャッシュ返却」を fetch モックで1ケース。

### T11. アカウント削除（バックエンド + 設定画面）

- **目的**: §5.3 の審査必須要件。
- **対象**: `backend/app/api/me.py`（`DELETE /api/me` 追加）、`backend/tests/`、`frontend/src/api/me.ts`、`frontend/src/pages/SettingsPage.tsx`
- **変更**: ① バックエンド: 認証ユーザーの profiles / enrollments / courses（自分作成分）/ assignments / todos / personal_events / devices（T12導入後）を削除し、Supabase Admin API（service_role キー、環境変数追加）で auth ユーザーを削除。204 返却。② フロント: 設定画面最下部に赤字「アカウントを削除」→ 確認ダイアログ（「削除」を入力させる等2段階）→ 成功で signOut + /login。
- **完了条件**: 削除後、同メールで再ログイン不可・再登録可能。取得済みの履修情報・課題情報・通知設定・デバイストークンがすべて消えている。他ユーザーのデータに影響なし。
- **テスト**: バックエンドに pytest 追加（自分のデータのみ消えること、未認証401）。フロントは手動確認。

### T12. プッシュ通知（課題締切）

- **目的**: §4.2 / §5.5-1。審査前の最後の大物。
- **対象**: バックエンド新規 `backend/app/api/devices.py` + `models/device.py` + Alembic マイグレーション + 通知バッチ（`backend/app/services/notify.py`、cron 実行）、`backend/app/api/me.py`（`notify_deadline_hours`）、フロント `frontend/src/lib/push.ts`（登録処理）+ `SettingsPage.tsx`（通知設定UI）、FCM プロジェクト設定 + iOS APNs キー設定
- **変更**: ① devices テーブル（user_id, platform, token, updated_at、token unique）。② `@capacitor/push-notifications` で許可要求→トークン取得→ `POST /api/devices`。設定画面の通知トグルON時に初めて許可を求める（起動即ダイアログは審査で嫌われる）。③ バッチ: 1時間ごとに「期限まで `notify_deadline_hours` 以内・未完了・未通知」の課題を抽出し FCM 送信、送信済みフラグを記録。④ ログアウト時 `DELETE /api/devices/{token}`。
- **完了条件**: 実機で通知トグルON→締切が近い課題の通知が届く。OFFで届かない。ログアウト後届かない。
- **テスト**: バッチ抽出ロジックに pytest（境界: ちょうどN時間前、完了済み除外、二重送信なし）。E2E は実機手動。

### T13. ストア提出準備

- **目的**: 審査提出とメタデータ整備。コード変更は最小。
- **対象**: `ios/` `android/` のアイコン・スプラッシュ、`backend/app/templates/privacy_policy.html`（§5.2 追記）、App Store Connect / Play Console
- **変更**: ① アイコン全サイズ・スプラッシュ生成（`@capacitor/assets` 使用）。② プライバシーポリシーに通知トークン・アカウント削除・Appleログイン・取得データ種別（§5.2）を追記。③ App Privacy / データセーフティ申告、暗号化免除申告（`ITSAppUsesNonExemptEncryption=false`）。④ デモアカウント作成＋データ投入スクリプト（`backend/app/db/` にシード追加）とレビュー用メモ（拡張同期の説明、非公式アプリである旨、デモアカウント記載）。⑤ スクリーンショット撮影（6.7"/5.5"/iPad ほか）。
- **完了条件**: TestFlight / 内部テストトラックで配布でき、§5 のチェック項目がすべて満たされている。審査提出済み。
- **テスト**: TestFlight ビルドでの一連の手動シナリオ（新規登録→ログイン→閲覧→予定作成→通知→アカウント削除）。

---

以下 T14〜T23 は Phase 2〜5（スマホ単体同期）。**T14〜T18 は「実装」ではなく検証・調査タスク**であり、成果物は検証レポートと Go/No-Go 判定。T19 以降の実装はゲート通過後にのみ着手する。

### T14. アプリ内ブラウザ方式の技術検証（プラグイン選定）

- **目的**: §6.7 V1・V5・V6・V7・V8 の検証。DOM 読み取り可能な WebView プラグインを選定し、方式全体の Go/No-Go を判定する。
- **対象**: 新規検証用ブランチ（`frontend/` に検証コードを一時追加）、新規 `docs/migration/inapp-browser-verification.md`（検証レポート）
- **変更**: ① 候補プラグイン（第一候補 `@capgo/inappbrowser`、次点: 自作 WKWebView/WebView プラグイン）を T6 のアプリに組み込み、任意の公開ページ → 大学ポータル → LMS の順で表示・URL イベント受信・`executeScript` による `document.documentElement.outerHTML` 取得を試す。② 対象4ページ種（Top / RegistList / LMS course / my-reports）で HTML 取得が成功するかを iOS / Android 両実機で記録。③ 結果・採用プラグイン・制約事項をレポートにまとめる。
- **完了条件**: レポートに V1/V5/V6/V7/V8 の成否が両OS分記録され、「採用プラグイン + Go」「代替案X + No-Go」のいずれかが明記されている。
- **テスト**: 検証自体がテスト。検証コードは main にマージしない（レポートのみマージ）。
- **依存関係**: T6（Capacitor アプリが動くこと）。

### T15. ポータルログイン・Cookie 保持検証

- **目的**: §6.7 V2・V3・V4 のうち大学ポータル側の検証。ユーザーが WebView 内で（SSO 含め）ログインでき、同期フロー1回分の間セッションが保持されることを確認する。
- **対象**: T14 の検証ブランチ、`docs/migration/inapp-browser-verification.md`（追記）
- **変更**: T14 で選定したプラグインで、① ポータルへの手動ログイン（SSO 経由含む）が完了するか、② ログイン後 `RegistList.aspx?targetTerm=Q1..Q4` へ URL 指定遷移してもセッションが維持されるか、③ アプリ再起動後の Cookie 残存有無、④ ログイン画面の表示崩れ・パスワード自動入力（OS標準）の可否、を両OSで検証しレポートに追記。
- **完了条件**: V2/V3/V4（ポータル分）の成否がレポートに記録され、「再起動後の Cookie は保持されない前提で UX 設計する」等の設計判断が明文化されている。
- **テスト**: 検証自体がテスト。実在の大学アカウントで実施（開発者本人のアカウント。認証情報はコード・レポートに一切書かない）。
- **依存関係**: T14 が Go であること。

### T16. LMS ログイン・Cookie 保持検証

- **目的**: §6.7 V2・V3・V9 のうち LMS 側の検証。LMS 授業ページへの到達性と my-reports（`acs_` トークン付き）到達可否を確認する。
- **対象**: T14 の検証ブランチ、`docs/migration/inapp-browser-verification.md`（追記）
- **変更**: ① `course.php/{courseId}` への直接遷移と acanthus SSO リンク（`ACANTHUS_SSO_BASE`）経由遷移のそれぞれでログイン → 授業ページ到達を検証。② 授業ページ HTML から my-reports リンク（`acs_` トークン）を辿れるか、辿った先の HTML を取得できるか（V9）を検証。③ ポータルと LMS のセッションが同一 WebView 内で共存するかを確認。
- **完了条件**: V9 の成否と「課題一覧のみ同期 / 提出状況も同期」のどちらを Phase 4 のスコープにするかがレポートで判定されている。
- **テスト**: 検証自体がテスト（T15 と同じ注意事項）。
- **依存関係**: T14 が Go であること。T15 と並行可。

### T17. 履修情報抽出ロジックの移植可能性調査

- **目的**: §6.6。`registParser.ts`（+ 必要なら `lectureDetailParser.ts`）をアプリ側で実行できるかを確認し、パーサーの共有方法を決める。
- **対象**: `extension/src/parsers/registParser.ts`、新規 `shared/parsers/`（または `frontend/src/lib/parsers/`。配置は本タスクで決定）、`frontend/`（vitest 追加）、`docs/migration/inapp-browser-verification.md`（追記）
- **変更**: ① T15 で取得した実ページ HTML（**個人情報をマスクしたフィクスチャ化**したもの）を vitest のフィクスチャにし、`parseRegisteredCourses` がアプリのビルド環境（Vite + ブラウザ DOMParser）で拡張と同一結果を返すことを確認。② パーサーの共有方式を決定（モノレポ共有ディレクトリ / ソースコピー+同期コメント）し、拡張側ビルドが壊れないことを確認。③ 完全移植が難しい箇所（あれば）と WebView 用再実装の要否をレポートに記録。
- **完了条件**: アプリ側から import した `parseRegisteredCourses` がフィクスチャ HTML で期待どおりの `ParsedCourse[]` を返すテストが通る。拡張の既存ビルド（`extension/` の vite build）も通る。
- **テスト**: 上記 vitest（正常系 + 抽選漏れ除外 + 集中講義の2〜3フィクスチャ）。
- **依存関係**: T15（実ページ HTML の入手）。

### T18. LMS 課題抽出ロジックの移植可能性調査

- **目的**: §6.6。`lmsCourseParser.ts` / `myReportsParser.ts` の移植確認。T17 と同じ枠組みの LMS 版。
- **対象**: `extension/src/parsers/lmsCourseParser.ts` / `myReportsParser.ts`、T17 で決めた共有ディレクトリ、`frontend/`（vitest 追加）、`docs/migration/inapp-browser-verification.md`（追記）
- **変更**: ① T16 で取得した LMS ページ HTML（マスク済みフィクスチャ）で `parseLmsCoursePage` / `parseMyReports` の動作を確認。② kind 判定・除外判定が拡張と同一結果になることをフィクスチャで固定。③ my-reports が V9 不成立だった場合は `parseMyReports` を Phase 4 スコープから外す判断をレポートに記録。
- **完了条件**: アプリ側から import した両パーサーのフィクスチャテストが通り、Phase 4 の同期スコープ（課題一覧のみ / +提出状況）が確定している。
- **テスト**: 上記 vitest（課題あり / 課題なし / フォルダ複数 の3フィクスチャ以上）。
- **依存関係**: T16、T17（共有方式の決定）。

### T19. スマホ履修同期UIの設計・実装（S8）

- **目的**: §6.4 のフローを実装する（Phase 3 の本体）。
- **対象**: 新規 `frontend/src/pages/CourseSyncPage.tsx`（または CoursesPage 内モーダルフロー。設計時に決定）、新規 `frontend/src/lib/portalSync.ts`（WebView 制御 + パーサー呼び出し + `import-courses` 接続）、`frontend/src/api/extensionImport.ts`（新規: `POST /api/extension/import-courses` の authFetch ラッパー）、`pages/CoursesPage.tsx`（「履修情報を同期」ボタン、native のみ表示）
- **変更**: §6.4 の手順1〜10 を実装。WebView 画面にはアプリ側ヘッダー（「ログイン後、時間割画面が表示されたら『読み取る』を押してください」+ 閉じるボタン）を重ねる。取得 → パース → 確認リスト（全選択デフォルト・チェック解除可・削除警告文言）→ 登録 → 完了トースト + 時間割再fetch。クォーター選択（Q1〜Q4 複数可）を確認画面より前に置く。
- **完了条件**: 実機で、ポータルログイン済みの状態から3タップ以内で履修同期が完了する。選択解除した科目が登録されない。`import-courses` の削除挙動が警告文言と一致する。Web ビルドにはこの画面が含まれない（native ガード）。
- **テスト**: パース〜確認リスト生成のロジックは vitest（T17 のフィクスチャ流用）。WebView フローは実機手動（ログイン済み / 未ログイン / 途中でキャンセル の3シナリオ）。
- **依存関係**: T15、T17、T21（確認UIコンポーネント）。

### T20. スマホ LMS 課題同期UIの設計・実装（S9）

- **目的**: §6.5 のフローを実装する（Phase 4 の本体）。
- **対象**: 新規 `frontend/src/components/CourseDetailSheet.tsx`（授業詳細ボトムシート: 授業名・教室・教員・「LMSを開く/課題を同期」）、`frontend/src/lib/lmsSync.ts`（WebView 制御 + `course.php/{courseId}` 到達判定 + パーサー + `import-lms-tasks` / `import-assignments` 接続）、`api/extensionImport.ts`（関数追加）、`pages/CoursesPage.tsx` / `TasksPage.tsx`（導線差し替え）
- **変更**: §6.5 の手順1〜11 を実装。到達判定は URL パターン（`/webclass/course.php/{courseId}`）で行い、到達時に「課題を読み取る」ボタンを活性化。抽出結果の確認リスト → 同期 → タスク一覧再fetch。重複判定・is_done/is_hidden はサーバ委譲（アプリ側で判定コードを書かない）。
- **完了条件**: 実機で、LMS ログイン済み状態から授業タップ→同期完了までが1分以内に完了する。既存課題の完了状態が同期で失われない（実データで確認）。T18 で確定したスコープ（提出状況の有無）どおりに動く。
- **テスト**: パース〜確認リストは vitest（T18 フィクスチャ流用）。同期の is_done 維持は backend の既存 pytest が担保、フロントは実機手動（ログイン済み / 未ログイン / 対象ページ以外で読み取り操作 の3シナリオ）。
- **依存関係**: T16、T18、T21。

### T21. 抽出結果確認・選択UIの実装

- **目的**: §6.4 手順6〜8 / §6.5 手順8〜10 で共用する確認・選択コンポーネント（ユーザー確認必須の担保）。T19/T20 より先に単体で作る。
- **対象**: 新規 `frontend/src/components/sync/SyncConfirmList.tsx`（チェックリスト + 全選択/解除 + 警告文言スロット + 実行ボタン）、新規 `frontend/src/components/sync/SyncResultToast.tsx`、型定義 `frontend/src/lib/syncTypes.ts`（`SyncCandidate = { id, title, subtitle, meta, checked }`）
- **変更**: 汎用の「候補リスト→選択→実行」UIを実装。履修（授業名/教員・曜限）と課題（課題名/期限・種別）の両方を `SyncCandidate` に正規化して渡せる構造にする。0件時の空状態表示（§6.4 の失敗文言）もここに含める。
- **完了条件**: Storybook 的な検証ページ（開発時のみ）またはテストで、選択/解除/全選択/実行/0件 の各状態が確認できる。実行ボタンは1件以上選択時のみ活性。
- **テスト**: RTL で「初期全選択」「解除した項目が onConfirm に渡らない」「0件で実行不可」の3ケース。
- **依存関係**: なし（T14 Go 判定後ならいつでも着手可。T19/T20 が依存する側）。

### T22. 同期失敗・再ログイン・空状態のUX設計・実装

- **目的**: §6.3（セッション切れ時の再ログイン促し）と §6.4/6.5 の失敗系を一貫した UX に揃える（Phase 5 の中核）。
- **対象**: `frontend/src/lib/portalSync.ts` / `lmsSync.ts`（エラー分類の追加）、`frontend/src/components/sync/SyncErrorState.tsx`（新規）、`SettingsPage.tsx`（「同期がうまくいかない場合」ヘルプ）
- **変更**: 失敗を4分類し文言と次アクションを固定する: ① 未ログイン検知（ログイン画面 URL パターン検知）→「大学のページにログイン後、もう一度お試しください」＋WebView 再表示ボタン、② パース0件/失敗 →「ページを読み取れませんでした」＋対象画面への誘導とPC同期案内、③ API エラー →「同期に失敗しました。時間をおいて再試行してください」、④ オフライン → §4.5 の文言。連続失敗時は PC 同期（代替案A）と手動登録（代替案B が実装済みなら）への導線を出す。
- **完了条件**: 4分類すべてに対応する表示が実機で再現・確認できる。エラー時にユーザーの入力（選択状態）が失われない。
- **テスト**: エラー分類ロジックは vitest（URL パターン / 空配列 / fetch reject の3ケース）。表示は実機手動。
- **依存関係**: T19 または T20 の少なくとも一方。

### T23. App Store 審査向け説明・デモデータ整備（同期機能版）

- **目的**: §5.1〜5.4。同期機能を含むアップデートを審査に通すための説明・デモ・ポリシー最終化（Phase 5 の締め）。
- **対象**: `backend/app/templates/privacy_policy.html`、`backend/app/db/`（デモシード拡充）、App Store Connect / Play Console（説明文・レビューノート）、`SettingsPage.tsx`（情報セクションの文言確認）
- **変更**: ① プライバシーポリシーに §5.2 の追記事項（取得データ種別・ID/パスワード非保存・ユーザー操作による本人データ取得）を反映。② レビューノートを更新: 本アプリが大学非公式であること、同期は大学在籍者本人の操作でのみ動作すること、**審査用デモアカウントは実際の大学アカウントに依存せず**時間割・課題・予定が投入済みであること、同期ボタンを押した場合の挙動（デモアカウントでは大学ログイン画面が出るが先へ進めない）の説明。③ ストア説明文でカレンダー・タスク管理・通知を主機能として記載し、同期は補助機能として記載（§5.5-4/8）。④ スクリーンショットに同期確認UI（S8/S9）を含めるか判断（含める場合はダミーデータで撮影）。
- **完了条件**: Phase 3/4 の機能を含むビルドが審査を通過する。プライバシーポリシー・データセーフティ・App Privacy の申告が実装と一致している。
- **テスト**: 提出前チェックリスト（§5 全項目）を1つずつ実機確認。
- **依存関係**: T19〜T22 完了後。

---

## 付録A: タスク依存関係

```
Phase 1:
T1 ──┬─ T6 ─ T7 ─ T9
T2 ──┤        └─ T8
T3 ──┼─ T10
T4 ──┼─ T11
T5 ──┘   T12（T6以降ならいつでも）
                └─ T13（T9〜T12完了後）＝初期リリース

Phase 2（ゲート）:
T6 ─ T14（Go/No-Go）─┬─ T15 ─ T17 ─┐
                      └─ T16 ─ T18 ─┤   T21（T14 Go後いつでも）
Phase 3:                            ├─ T19 ─┐
Phase 4:                            └─ T20 ─┼─ T22 ─ T23
                                            ┘
※ T14 が No-Go の場合: T15〜T23 は中止し、§6.8 の代替案A（現状維持）+ 必要に応じ代替案B（手動登録）を別タスクとして起票する。
```

- T1〜T5: Web版のまま先行リリース可能な準備工事（審査と無関係に価値がある）。
- T6〜T13: アプリの骨格 + 審査要件。T13 で初期リリース。
- T14〜T18: 検証・調査（コードは main にマージしない。レポートとフィクスチャテストのみ）。
- T19〜T23: スマホ単体同期の実装と審査対応。

---

## 付録B: 今回の更新で変わった前提（改訂1、2026-07-08）

1. **スマホアプリ版の位置づけを変更**: 旧「PCで同期したデータを閲覧・操作する端末」→ 新「初期は閲覧・操作中心、将来的にはアプリ内ブラウザ経由でスマホ単体同期も可能なクライアント」（§1.8）。「アプリ内に同期機能を移植しようとしない」という旧方針は撤回し、**ユーザー操作起点・確認必須のアプリ内ブラウザ方式**として §6 に仕様化した。
2. **初期リリースのスコープは不変**: Phase 1（T1〜T13）は従来どおり閲覧・編集・通知のみで審査提出する。スマホ単体同期は Phase 2 の技術検証（T14〜T16）を通過した場合にのみ Phase 3〜4 で実装する。初期リリースの成立はこの検証結果に依存しない。
3. **拡張系 API の扱いを変更**: 旧「`/api/extension/*` はアプリから呼ばない」→ 新「Phase 3〜4 ではアプリが Chrome 拡張と同じ立場で `import-courses` / `import-lms-tasks` / `import-assignments` を呼ぶ」（§4.1）。バックエンド追加改修は原則不要という想定に変わった。
4. **大学の認証情報に関する方針を明文化**: 大学ポータル・LMS の ID/パスワードはアプリ・サーバーのいずれにも保存しない。ログインは常にユーザー自身が WebView 内で行い、セッションは WebView の Cookie に委ねる。自動入力機能・サーバー側代理取得（代替案D）は不採用（§6.3 / §6.8）。
5. **抽出仕様の正は既存 Chrome 拡張**: 取得項目・除外判定・is_done/is_hidden/重複判定はすべて `extension/src/` の実装とサーバ側 upsert を正とし、アプリはパーサーの共通パッケージ化（または同期コピー）で追随する（§6.6）。パーサーが DOMParser ベースの純関数であることは実装調査で確認済みだが、**WebView からの HTML 取得可否は未検証**であり Go/No-Go ゲート（T14）を設けた。
6. **審査・プライバシー要件を追加**: 大学非公式であることの明示（§5.4）、取得データ種別のプライバシーポリシー明記（§5.2）、審査を実際の大学アカウントに依存させないデモ整備（§5.1 / T23）を追加した。
7. **タスクとフェーズの拡張**: T14〜T23 と Phase 1〜5 のフェーズ計画（§7）を追加。章番号が変わった（旧§6 タスク分解 → 新§8。新§6=アプリ内ブラウザ方式、新§7=フェーズ計画）。
