# フロントエンド 開発ガイド

React + TypeScript + Vite + React Router + FullCalendar + Tailwind CSS による開発フローをまとめたガイドです(AI作成)。
参考程度に

---

## ファイル構成

```
frontend/
├── index.html              # エントリーポイント
├── public/                 # そのまま配信する静的ファイル
├── src/
│   ├── main.tsx            # Reactのマウント処理（BrowserRouterでAppを包む）
│   ├── App.tsx              # ルーティング・認証ガード（PrivateRoute/AdminRoute/GuestRoute）
│   ├── Layout.tsx            # 共通ヘッダー・ナビ・ユーザーメニュー
│   ├── index.css             # Tailwindのエントリーポイント + カスタムCSS変数
│   ├── periodToTime.ts       # 時限と時刻の対応表
│   ├── api/                  # バックエンドとの通信処理（fetchラッパー）
│   │   ├── client.ts         # authFetch（Supabaseトークン自動付与 + 401時ログアウト）
│   │   ├── auth.ts           # login / register / logout / loginWithGoogle
│   │   ├── me.ts, courses.ts, calendar.ts, universityEvents.ts, tasks.ts, personalEvents.ts
│   ├── hooks/                 # カスタムフック
│   │   ├── useMe.ts           # /api/me を取得（is_admin判定に使う）
│   │   ├── useIsMobile.ts
│   │   └── useExtensionInstalled.ts
│   ├── lib/                   # Supabaseクライアント、ユーティリティ
│   │   ├── supabase.ts
│   │   ├── tasksBoard.ts      # タスクボードの状態計算ロジック
│   │   └── universityUrls.ts
│   ├── components/             # 再利用コンポーネント（イベントポップオーバー等）
│   │   └── tasks/               # タスクボード関連コンポーネント
│   └── pages/                   # 画面単位のコンポーネント
│       ├── LoginPage.tsx, RegisterPage.tsx, AuthCallbackPage.tsx
│       ├── CalendarPage.tsx, CoursesPage.tsx, TasksPage.tsx
│       └── AdminEventsPage.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 認証（Supabase Auth）

ログイン・トークン管理は自前実装ではなく **`@supabase/supabase-js`** に任せている。

- `src/lib/supabase.ts` でクライアントを初期化（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を使用）
- `src/api/auth.ts`: `login` / `register` はメール＋パスワード、`loginWithGoogle` はOAuth
- `src/api/client.ts` の `authFetch`: バックエンドAPIを呼ぶ際は必ずこれを経由する
  - Supabaseのセッションからaccess tokenを取得し `Authorization: Bearer <token>` を自動付与
  - レスポンスが401なら自動で `signOut` + `/login` へリダイレクト
- `App.tsx` で `supabase.auth.getSession()` / `onAuthStateChange` を購読し、ログイン状態に応じて `PrivateRoute`（要ログイン）・`GuestRoute`（未ログイン専用）・`AdminRoute`（管理者専用、`useMe()`の`is_admin`で判定）を出し分ける

---

## Vite の使い方

### 開発サーバーの起動

```bash
npm run dev
```

http://localhost:5173 で確認できる。ファイル保存で自動リロード（HMR）。

> `vite.config.ts` は開発時（`vite dev`）に `VITE_API_PROXY_TARGET` が未設定だとエラーで起動を止める。`.env.development` にバックエンドのURL（例: `http://localhost:8000`）を設定しておくこと。`/api/**` へのリクエストがここにプロキシされる。

### ビルド（デプロイ用）

```bash
npm run build
```

`vite.config.ts` の `build.outDir` が `../backend/static` に設定されているため、`dist/` ではなく直接 `backend/static/` に出力される（FastAPIがそのまま静的配信できるように）。

ビルド時に必要な環境変数（`VITE_*` はビルド時にJSバンドルへ静的に埋め込まれる）:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_EXTENSION_STORE_URL`

本番ビルド（`docker/prod/Dockerfile`）ではこれらをDockerの`--build-arg`として渡す。

### 型チェック

```bash
npm run typecheck
```

Viteはビルド時に型チェックをしないため、型エラーの確認は別途このコマンドで行う。

### Lint

```bash
npm run lint
```

---

## スタイリング（Tailwind CSS）

Tailwind CSS v4（`@tailwindcss/vite` プラグイン）を使用。コンポーネント内でユーティリティクラスを直接書くスタイルが中心（`className="px-4 py-2 rounded-lg ..."`）。一部、動的な色などは `style={{ ... }}` のインラインスタイルも併用している（[Layout.tsx](../frontend/src/Layout.tsx)参照）。

`src/index.css` にTailwindのエントリーポイントとカスタムCSS変数（`--c-bg`, `--c-border` など）をまとめている。

---

## ルーティング（React Router）

`App.tsx` で `<Routes>` を定義。主なパス:

| パス | 認証 | コンポーネント |
|---|---|---|
| `/login`, `/register` | 未ログイン専用（`GuestRoute`） | LoginPage, RegisterPage |
| `/auth/callback` | 制限なし | AuthCallbackPage（OAuthコールバック受け口） |
| `/courses` | 要ログイン | CoursesPage |
| `/tasks` | 要ログイン | TasksPage |
| `/calendar` | 要ログイン | CalendarPage |
| `/admin/events` | 要ログイン＋管理者 | AdminEventsPage |

ホーム画面（`/`）はlocalStorageに保存された `ku-home-path`（デフォルト`/courses`）にリダイレクトされる。ユーザーがLayoutのメニューから切り替え可能。

---

## カレンダー表示（FullCalendar）

`@fullcalendar/react` + `daygrid` / `timegrid` / `interaction` プラグインを使用。`CalendarPage.tsx` が中心。時間割（`/api/calendar`）・大学イベント（`/api/university-events`）・祝日（holidays-jp API）・個人イベント（`/api/personal-events`）をフロント側で合成して1つのカレンダーに表示している。表示ルールは [DESIGN.md](./DESIGN.md) §2.4 を参照。
