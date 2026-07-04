# 設計

大学の学年歴に特化したカレンダーアプリの設計ドキュメント。
本ドキュメントは 現在の実装に基づく 設計を記述する。設計判断の根拠は §8 を参照。

---

## 1. 要件定義

### 1.1 ユーザーストーリー

- 既存のカレンダーアプリだと大学の学年暦に対応していないので、カレンダーアプリと学年暦の両方を見る必要があるのが不便。
- 登録した時間割を学年暦に合ったスケジュール（大学独自の休日の時は休み、振替日に授業）で一目でわかる。
- 大学の授業の予定と個人の予定を一目で確認したい。

### 1.2 機能一覧（実装済み）

- ユーザー登録 / ログイン / ログアウト（Supabase Auth。メール+パスワード、またはGoogleアカウントでのログイン）
- 時間割登録（1〜4限、Q1〜Q4）
- 時間割の編集・削除
- Chrome拡張機能（[extension/](../extension/)）経由での履修情報・LMS課題情報の取得・同期
- カレンダー表示（月 / 週 / 日）
  - 時間割の自動展開（クォーター期間内の該当曜日に自動配置）
  - 祝日・大学イベントの表示
  - 個人イベント（personal_events）の登録・編集・削除
- 大学イベントの一覧表示（全ユーザー共通）
- **管理者** による大学イベント編集画面（追加・編集・削除）
- 課題・Todoのタスクボード（「課題」「Todo」「完了」の3カラム、ドラッグ&ドロップで並び替え・ステータス変更。[TasksPage.tsx](../frontend/src/pages/TasksPage.tsx)）

### 1.3 未実装（将来拡張予定）

- 大学イベント表示時の振替日に応じた時間割の調整（フロント側補正）

### 1.4 スコープ外

- 複数大学への対応（金沢大学のみ）
- モバイルアプリ対応（Web のみ。レスポンシブ対応は実施）
- シラバス連携などの自動取得
- 複数ユーザーでの予定共有
- 通知機能

---

## 2. 画面設計

### 2.1 画面一覧

| 画面 | パス | 認証 |
|---|---|---|
| ログイン画面 | `/login` | 未ログイン専用（ログイン済みなら`/`へリダイレクト） |
| 新規登録画面 | `/register` | 未ログイン専用 |
| OAuthコールバック | `/auth/callback` | 不要（Google等のOAuthログイン後に一時的に経由） |
| ホーム | `/` | 要ログイン。ユーザー設定のホームパス（`/courses`または`/tasks`、既定は`/courses`）へリダイレクト |
| カレンダー画面 | `/calendar` | 要ログイン |
| 時間割画面 | `/courses` | 要ログイン |
| タスクボード画面 | `/tasks` | 要ログイン |
| 大学イベント管理画面 | `/admin/events` | 要管理者 |

ルーティング定義は [App.tsx](../frontend/src/App.tsx)。`PrivateRoute`（要ログイン）・`GuestRoute`（未ログイン専用）・`AdminRoute`（要管理者）の3種のガードで制御する。

### 2.2 画面遷移

```
[未ログイン]
    ├─→ [ログイン]（メール+パスワード or Googleログイン）
    │       └─→ [/auth/callback]（Google等のOAuth時のみ経由）
    └─→ [新規登録]
            └─→ [ホーム（ユーザー設定のパスへ）]
                    ├─→ [時間割画面]
                    ├─→ [タスクボード画面]
                    ├─→ [カレンダー画面]
                    └─→ [大学イベント管理]（管理者のみ）
```

### 2.3 ナビゲーション

ヘッダー（[Layout.tsx](../frontend/src/Layout.tsx)）に以下を表示：

- 時間割（全ユーザー）
- タスクボード（全ユーザー）
- 大学イベント管理（**管理者のみ表示**、`useMe()` で判定）
- ユーザーメニュー（表示名編集・ホーム画面設定・課題取得モード設定・ログアウト）

カレンダー画面（`/calendar`）はヘッダーの主要ナビには表示されないが、ルートとしては存在する。

### 2.4 カレンダーでの表示ルール

| 種類 | 表示 |
|---|---|
| 時間割 | 青色、時限単位のブロック |
| 祝日 | 日付を赤色（[holidays-jp API](https://holidays-jp.github.io/) から取得） |
| 大学イベント `exam` | 黄色（試験期間） |
| 大学イベント `transfer` | 赤色＋「○曜授業」表示 |
| 大学イベント `interval` | 緑色（休業期間） |
| 大学イベント `other` | 水色 |

---

## 3. データベース設計

PostgreSQL（Render のマネージドサービス）を使用。マイグレーションは Alembic。
モデル定義は [backend/app/models/](../backend/app/models/) を参照。

### 3.1 ER 図

```
auth.users（Supabase管理、アプリDB外）
   │ 同じUUIDを共有（FK制約なし）
   ▼
profiles ─┬─< enrollments >─┬─ courses ─< course_dates
          ├─< tasks（課題・Todo）
          └─< personal_events（個人イベント）

university_event（独立、ユーザーに紐づかない）
```

### 3.2 テーブル詳細

#### `profiles`（ユーザーの追加情報。認証情報自体はSupabaseの`auth.users`が保持）

| カラム | 型 | 備考 |
|---|---|---|
| user_id | string (UUID) | PK。Supabaseの`auth.users.id`と同じ値（FK制約はなし） |
| display_name | string, nullable | 表示名 |
| is_admin | boolean | デフォルト false。**現状バックエンドの認可判定には未使用**（§5.3参照。実際の管理者判定はJWTの`app_metadata.is_admin`） |
| assignment_sync_mode | string | `auto` \| `manual`。課題取得の同期モード |
| created_at / updated_at | datetime | |

> 初回アクセス時に自動作成される（`ensure_profile`）。ユーザー登録・ログイン自体はSupabase Authが行うため、このテーブルはアプリ固有の付随情報のみを持つ。

#### `courses`（授業マスタ）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| name | string | 授業名 |
| room | string | 教室 |
| teacher | string | 教員名 |
| lms_course_id | string, nullable | LMS（WebClass等）側のコースID。拡張機能連携で使用 |
| lms_system_type | string, nullable | LMSシステム種別（例: `webclass`, `kanazawa_lms`） |

> ユーザーへの紐付けは `enrollments` 経由。同一授業を複数ユーザーで共有可能な設計。

#### `course_dates`（授業の開講条件）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| course_id | FK → courses.id | CASCADE |
| year | int | 開講年度 |
| quarter | int | 1〜4 |
| day_of_week | string, nullable | "月"〜"土"。集中講義は `None` |
| period | int | 時限。集中講義は `0` |
| is_intensive_lct | boolean | 集中講義フラグ（true の場合カレンダーへの自動展開対象外） |

> このテーブルは「**いつ開講するか**」のメタ情報のみを持ち、実際の開催日（個別の日付）は API レスポンス時に [services/schedule.py](../backend/app/services/schedule.py) で計算する。詳細は §4 参照。

#### `enrollments`（履修登録）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| course_id | FK → courses.id | CASCADE |
| user_id | string (UUID) | `profiles.user_id`に対応する値。**FK制約は無い**（Supabase移行時に外した） |

#### `tasks`（課題・Todo。1テーブルに統合）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| user_id | string (UUID) | FK制約なし |
| title | string | |
| type | string | `assignment` \| `todo` |
| source_type | string | `manual` \| `lms` \| `ai` \| `calendar` |
| source_provider | string | `user` \| `kanazawa_lms` \| `webclass` \| `google_calendar` |
| is_done / done_at | boolean / datetime | |
| is_hidden | boolean | 削除は物理削除ではなくこのフラグを立てる |
| board_status | string | `assignment` \| `todo` \| `done`（タスクボードのカラム位置） |
| course_name, lms_course_id, task_contents_id, source_url, kind, availability_start, availability_end, submitted_at, result, score, is_due_estimated, is_active_url | 各種nullable | 課題（`type=assignment`）専用の付加情報。LMS連携で埋まる |

> `type` によって「課題」と「Todo」の2種類を1テーブルで表現している。

#### `personal_events`（個人イベント）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| user_id | string (UUID) | FK制約なし |
| title | string | |
| start | string | ISO日時文字列 |
| end | string, nullable | |
| all_day | boolean | |
| color | string, nullable | |
| created_at | datetime | |

#### `university_event`（大学独自イベント）

休日・振替日・休業期間・試験期間など。**年度ごとに JSON ファイルから一括投入** する。

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| year | int | 年度（2026 = 2026/4〜2027/3） |
| name | string | 例：「学園祭」「Q1試験」 |
| type | string | `exam` / `transfer` / `interval` / `other` / `holiday` |
| date | string | **MM-DD 形式**（例：`"04-01"`） |
| original_day | string | `transfer` の場合の振替元曜日（例：`"水"`）。それ以外は空文字 |

> `date` を `MM-DD` 文字列にしているのは、年度を独立カラムにすることで JSON ファイル単位で年度ごとに管理しやすくするため。詳細は §8.2 参照。

### 3.3 平日・祝日の扱い

日本の祝日は **フロントから [holidays-jp API](https://holidays-jp.github.io/) を直接呼ぶ**。DB には持たない。
DB に持つのは大学独自のイベントのみ。

---

## 4. ビジネスロジック

### 4.1 授業開催日の計算（オンザフライ方式）

事前に `course_dates` テーブルを展開する設計ではなく、**API レスポンス生成時に計算** する。
[backend/app/services/schedule.py](../backend/app/services/schedule.py) の `build_class_dates(year, quarter, day_of_week)` が担当。

#### クォーター期間（ハードコード）

```python
quarter_ranges = {
    1: (date(year, 4, 6), date(year, 6, 4)),
    2: (date(year, 6, 11), date(year, 8, 6)),
    3: (date(year, 10, 1), date(year, 12, 2)),
    4: (date(year, 12, 9), date(year + 1, 2, 10)),
}
```

> クォーター期間は将来的に DB の `quarters` テーブルに切り出すべきだが、現状は実装簡略化のためコード内に持つ。

#### 計算手順

1. `course_dates` から `(year, quarter, day_of_week, period)` を取得
2. 上記の `quarter_ranges` から開始/終了日を取得
3. 期間内の該当曜日（例：月曜）を全列挙して返す

### 4.2 振替日・休業の反映（**現状未実装**）

`university_event.type = 'transfer'` の振替日に応じて時間割を調整する機能は **未実装**。
現状は時間割と大学イベントを **それぞれ独立に表示** している。

将来的には:
- フロント側で `university_event` を取得し、`type = 'holiday'` の日に該当する `course_dates` を表示から除外
- `type = 'transfer'` の日に対応する曜日の `course_dates` を表示に追加

---

## 5. 認証・認可設計

### 5.1 認証方式

**Supabase Auth** に認証そのものを委譲している（自前のパスワードハッシュ・JWT発行は行わない）。
- ログイン方式：メール+パスワード、または Google OAuth（PKCEフロー）
- フロントエンド：`@supabase/supabase-js` の `supabase.auth` API（[api/auth.ts](../frontend/src/api/auth.ts)）でログイン/登録/ログアウトを行う
- セッション保持：Supabase SDKが内部で管理（ブラウザのlocalStorageにSupabase SDKがトークンを保存する）
- バックエンド：Supabaseが発行したJWTを**JWKS（JSON Web Key Set）で直接検証**する。共有シークレットは持たない（[main.py](../backend/app/main.py) の `verify_supabase_jwt`、`PyJWKClient`）

### 5.2 認証フロー

```
[1] ログイン（メール+パスワード）
  Frontend → supabase.auth.signInWithPassword({ email, password })
  Supabase → JWT発行、SDKがセッションを保持

[1'] ログイン（Google OAuth）
  Frontend → supabase.auth.signInWithOAuth({ provider: "google" })
           → Googleの認可画面へリダイレクト
           → /auth/callback に authorization code 付きで戻る
  Frontend → supabase.auth.exchangeCodeForSession(...) でセッションに交換

[2] 認証付きリクエスト
  Frontend → authFetch ラッパー（api/client.ts）が
             supabase.auth.getSession() からaccess tokenを取得し
             Authorization: Bearer <token> を自動付与
  Backend  → verify_supabase_jwt が SupabaseのJWKSエンドポイントから公開鍵を取得し検証
           → get_current_user が JWTペイロード（sub, email, user_metadata, app_metadata）から
             CurrentUser を組み立てる（DBアクセスなし）

[3] 401 時の挙動
  Frontend → authFetch が 401 を検知 → supabase.auth.signOut() → /login にリダイレクト
```

### 5.3 認可（管理者ロール）

- 管理者判定は **JWTの `app_metadata.is_admin`** を見る（Supabase側の `auth.users.raw_app_meta_data`）
- `get_admin_user` 依存関数で「ログイン済み」かつ「`is_admin=true`」を要求（403で拒否）
- 最初の管理者はSupabaseのSQL Editorで `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE email = ...` で昇格させる（[DEPLOY.md](./DEPLOY.md) 参照）
- フロント側では `useMe()` フック（`GET /api/me` を叩く）で `is_admin` を取得し、管理者リンクの表示制御 + `<AdminRoute>` でルートガード
- なお `profiles.is_admin` カラムも存在するが、現状バックエンドの認可判定には使われていない（JWT側の値のみを見る）

### 5.4 認可マトリクス

エンドポイントごとの認証・認可要件は [API.md](./API.md) を参照。概要:

| 種別 | 例 |
|---|---|
| 認証不要 | `GET /api/health`, `GET /privacy` |
| 要ログインのみ | 自分のcourses/calendar/assignments/todos/personal-events/me |
| 要ログイン + 管理者 | university-events の作成・編集・削除、`DELETE /api/courses`（全削除） |

---

## 6. API設計

エンドポイントの完全な一覧（リクエスト/レスポンス形式含む）は **[API.md](./API.md)** を参照。ここでは設計上の要点のみ記載する（二重管理を避けるため詳細はAPI.md側に一本化）。

### 6.1 共通ルール

| 項目 | 値 |
|---|---|
| 認証方式 | Supabase Auth の JWT（`Authorization: Bearer <token>` ヘッダー）。バックエンドはJWKSで検証し、自前のユーザー/パスワードテーブルは持たない |
| エラー形式 | `{ "detail": "エラーメッセージ" }` |
| 日付形式（API 全般） | ISO 8601（`2026-04-01`） |
| 大学イベント `date` | `MM-DD`（例：`"04-01"`） |
| 認証エンドポイント | 存在しない。ログイン/登録はフロントから直接Supabaseへ（`supabase.auth.*`）。バックエンドはトークン検証のみ行う |

### 6.2 ユーザー情報（me）

```
GET  /api/me     自分の情報（要認証）
PATCH /api/me    表示名・課題取得モードの更新
```

詳細は [API.md](./API.md#ユーザー情報meprofiles) を参照。`profiles` テーブルの行は初回アクセス時に自動作成される（`ensure_profile`）。

### 6.3 時間割（courses）

`courses` / `course_date` / `enrollments` の3テーブルにまたがるCRUD。`POST /api/course`は追加時に3テーブルを同時に作成する。詳細は [API.md](./API.md#時間割courses) 参照。

### 6.4 カレンダー（集約）

`GET /api/calendar/{year-month}` が指定月の自分の時間割を返す。大学イベント・祝日・個人イベントはフロント側で別途取得して合成する（バックエンドの集約は時間割のみ）。詳細は [API.md](./API.md#カレンダー集約) 参照。

### 6.5 大学イベント・課題・Todo・個人イベント・拡張機能連携

`university-events` / `assignments` / `todos` / `personal-events` / `extension` の各エンドポイントは [API.md](./API.md) を参照。

### 6.6 シード（バッチ処理、API ではない）

CLI スクリプト [`backend/app/db/seed_university_event.py`](../backend/app/db/seed_university_event.py) で年度別 JSON を一括投入。
同年度の既存データを削除してから再投入する **冪等処理**。

```bash
cd backend
uv run python -m app.db.seed_university_event data/universityevent_2026.json
```

---

## 7. フロントエンド構成

### 7.1 ディレクトリ

```
frontend/src/
├── App.tsx               # ルーティング・PrivateRoute・AdminRoute
├── Layout.tsx            # 共通ヘッダー・ナビ・ログアウト
├── main.tsx
├── periodToTime.ts       # 時限と時刻の対応表
├── api/                  # API クライアント
│   ├── auth.ts           # login/register/loginWithGoogle/logout（Supabase Auth）
│   ├── client.ts         # authFetch ラッパー（Bearer 自動付与）
│   ├── me.ts             # 表示名・課題取得モードの更新
│   ├── courses.ts        # 時間割 CRUD
│   ├── calendar.ts       # カレンダー集約
│   ├── universityEvents.ts # 大学イベント CRUD
│   ├── tasks.ts          # 課題・Todo CRUD
│   └── personalEvents.ts # 個人イベント CRUD
├── hooks/
│   ├── useMe.ts                  # /api/me を取得するカスタムフック
│   ├── useIsMobile.ts            # 画面幅によるモバイル判定
│   └── useExtensionInstalled.ts  # Chrome拡張機能の導入有無を検出
├── lib/
│   ├── supabase.ts        # Supabaseクライアントの初期化
│   ├── tasksBoard.ts      # タスクボードの並び替え・フィルタ計算ロジック
│   └── universityUrls.ts
├── components/
│   ├── Event*.tsx         # カレンダーのイベント作成・編集ポップオーバー等
│   ├── ExtensionBanner.tsx # 拡張機能未導入時の案内バナー
│   └── tasks/              # タスクボードのカラム・カード等
└── pages/
    ├── LoginPage.tsx, RegisterPage.tsx, AuthCallbackPage.tsx
    ├── CalendarPage.tsx, CoursesPage.tsx, TasksPage.tsx
    └── AdminEventsPage.tsx
```

### 7.2 認証ガード（ルート保護）

[App.tsx](../frontend/src/App.tsx) で 3 種類のガードを使い分ける：

```
<GuestRoute>             ← 未ログイン専用（ログイン済みならホームへリダイレクト）
  ├─ <LoginPage />
  └─ <RegisterPage />

<PrivateRoute>           ← ログイン必須（Supabaseのsessionで判定）
  └─ <Layout>
      ├─ <CalendarPage />
      ├─ <CoursesPage />
      ├─ <TasksPage />
      └─ <AdminRoute>    ← 管理者必須（useMe() の is_admin で判定）
          └─ <AdminEventsPage />
```

セッションの取得・監視は `App.tsx` が `supabase.auth.getSession()` / `onAuthStateChange` で行い、`session` / `loading` をルートガードに渡す。

### 7.3 通信ラッパー

`api/client.ts` の `authFetch` は通常の `fetch` をラップして:
- Supabaseのセッションから `access_token` を取得して `Authorization: Bearer ...` を自動付与
- レスポンスが 401 なら `supabase.auth.signOut()` + `/login` にリダイレクト

すべての保護エンドポイントは `authFetch` 経由で叩く。

---

## 8. 設計判断メモ

実装中に行った主要な設計判断と、その根拠を記録する。

### 8.1 認証をSupabase Authに移行した理由

初期は自前JWT（`OAuth2PasswordBearer` + bcrypt + `localStorage`保存）を実装していたが、Supabase Authに移行した。

- パスワードハッシュ・トークン発行・OAuth（Google連携）を自前実装する必要がなくなる
- Google等のソーシャルログインを追加コストなく提供できる
- バックエンドは受け取ったJWTをJWKSで検証するだけでよく、シークレット共有が不要

**トレードオフ:**
- Supabaseというマネージドサービスへの依存が増える
- ローカル開発でもSupabaseプロジェクトへの接続が必要（完全にオフラインでは動かせない）

### 8.2 `university_event.date` を `"MM-DD"` 文字列で持つ

- 大学イベントは年度ごとに使い回しを想定（年は別カラム `year` で持つ）
- JSON ファイル単位で年度別管理（`backend/data/universityevent_2026.json` のように）

**トレードオフ:**
- DB レベルでの日付演算ができない
- 年またぎの集計などが発生したらリファクタが必要

### 8.3 授業開催日を DB に持たず実行時計算

`course_dates` テーブルには「年度・クォーター・曜日・時限」のメタ情報のみを持ち、実際の日付列は `services/schedule.py` で計算。

**理由:**
- 実装が単純
- 振替日・休日に応じた補正をフロント側で柔軟にやりたい

**トレードオフ:**
- パフォーマンス的にはオンザフライ計算で毎回再計算
- 大学イベントの「振替」「休日」反映ロジックがバックエンドに無いので、現状は時間割と大学イベントが独立

### 8.4 管理者ロールに `is_admin` boolean 1 つ

- ロール体系は将来必要なら拡張（`role: enum` 化）
- 判定元はSupabaseの `auth.users.raw_app_meta_data.is_admin`（アプリDBの`profiles.is_admin`ではない、§5.3参照）
- 最初の管理者はSupabaseのSQL Editorから手動昇格
  - 自動的に「最初に登録したユーザーを管理者にする」もあり

### 8.5 `course` ↔ `user` を `enrollments` 経由（多対多）

- 直接 `Course.user_id` にせず、`Enrollment` テーブルを噛ませた
- 同一講義を複数ユーザーで共有する将来拡張に備える
- 現状は実質「1ユーザー1履修」だが、構造は変えていない

### 8.6 fetch ラッパー `authFetch` で認証ヘッダ付与を一元化

- 各 API 関数で `Authorization` ヘッダを書くのは DRY 違反
- 401 時の自動リダイレクトも一箇所にまとめられる

### 8.7 ルート保護を用途別コンポーネントに分離（`GuestRoute` / `PrivateRoute` / `AdminRoute`）

- 「未ログイン専用」「ログイン必須」「管理者必須」を別コンポーネントに分離
- ネストしてかぶせることで、認可レベルが宣言的に表現できる

```tsx
<PrivateRoute>
  <Layout>
    <AdminRoute>
      <AdminEventsPage />
    </AdminRoute>
  </Layout>
</PrivateRoute>
```

---

## 9. 今後の改善案

### 短期
- 管理画面の UI 改善（テーブル整形、フォームバリデーション）
- 大学イベントの **休日反映** をカレンダー側で実装（`type='holiday'` を時間割から除外）
- 大学イベントの **振替反映**（`type='transfer'` の日に対応曜日の授業を表示）
- ログアウト時のメッセージ表示

### 中期
- クォーター期間を DB の `quarters` テーブルに切り出し
- ユーザー名（表示名）の一意性制約追加
- レスポンシブ対応の強化

### 長期
- 複数大学対応（`universities` テーブル、`profiles.university_id`）
- 通知機能（授業開始前リマインド）
- Google カレンダー連携
