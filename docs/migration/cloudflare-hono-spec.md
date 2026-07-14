# Cloudflare Workers + Hono 移行仕様書

FastAPI + React + PostgreSQL 構成のバックエンドを、Cloudflare Workers + Hono + TypeScript へ段階的に移行するための詳細仕様書。

- **目的**: 今すぐの完全移行ではなく、後日「下位モデル（実装補助AI）や経験の浅い実装者」でも安全に実装できる粒度までタスクを分解すること。
- **作成日**: 2026-07-07
- **調査対象コミット**: `569a2f1` 時点の `main` + 未コミットの personal_events 拡張（location / description カラム追加）

---

## 1. 現在のバックエンド構成の棚卸し

### 1.1 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | FastAPI（Python 3.12, uvicorn） |
| ORM | SQLAlchemy 2.0（Mapped / mapped_column スタイル） |
| DBドライバ | psycopg 3 |
| マイグレーション | Alembic（`backend/alembic/versions/` に29本） |
| バリデーション | Pydantic v2 |
| 認証 | Supabase Auth の JWT を JWKS で検証（PyJWT + PyJWKClient） |
| 本番環境 | Render（Docker 単一コンテナ、`docker/prod/Dockerfile`）+ Render PostgreSQL 16 |
| 開発環境 | Docker Compose（app + postgres:16） |
| フロント配信 | フロントのビルド出力を `backend/static/` に置き、FastAPI が静的配信 + SPA fallback |

### 1.2 APIエンドポイント一覧

すべて `backend/app/api/` 配下。認証は特記なき限り「Supabase JWT必須（Bearer）」。

| # | Method | Path | ファイル | 認証 | 概要 |
|---|---|---|---|---|---|
| 1 | GET | `/api/health` | `main.py` | 不要 | ヘルスチェック。`{"status":"ok"}` |
| 2 | GET | `/api/me` | `api/me.py` | 必須 | プロフィール取得（id / display_name / is_admin / assignment_sync_mode） |
| 3 | PATCH | `/api/me` | `api/me.py` | 必須 | display_name / assignment_sync_mode 更新。プロフィール無ければ作成 |
| 4 | POST | `/api/course` | `api/courses.py` | 必須 | 講義作成（Course + CourseDate + Enrollment を3コミット）。**レスポンスボディは JSON `null`** |
| 5 | DELETE | `/api/course/{course_id}` | `api/courses.py` | 必須 | 自分の履修講義を削除（204） |
| 6 | DELETE | `/api/courses` | `api/courses.py` | **admin** | 全講義削除（204） |
| 7 | GET | `/api/courses/{year_quarter}` | `api/courses.py` | 必須 | `{year}-{quarter}` 形式。履修中講義一覧（roomは表示用整形） |
| 8 | PUT | `/api/course/{course_id}` | `api/courses.py` | 必須 | name / room / teacher 更新 |
| 9 | GET | `/api/calendar/{year_month}` | `api/calendar.py` | 必須 | `{year}-{month}` 形式。講義の授業実施日を展開して返す（集中講義は除外） |
| 10 | GET | `/api/university-events/{year}` | `api/university_events.py` | 必須 | 年度の大学行事一覧 |
| 11 | POST | `/api/university-events` | `api/university_events.py` | **admin** | 行事作成 |
| 12 | PUT | `/api/university-events/{uni_event_id}` | `api/university_events.py` | **admin** | 行事更新 |
| 13 | DELETE | `/api/university-events/{uni_event_id}` | `api/university_events.py` | **admin** | 行事削除（204） |
| 14 | POST | `/api/extension/sync` | `api/extension.py` | 必須 | 拡張からのHTML受信（現状ログ出力のみ、DB書込なし） |
| 15 | POST | `/api/extension/import-courses` | `api/extension.py` | 必須 | 履修講義の一括upsert + syncスコープ外講義の削除 |
| 16 | POST | `/api/extension/import-assignments` | `api/extension.py` | 必須 | 課題（レポート一覧）の一括upsert |
| 17 | POST | `/api/extension/import-lms-tasks` | `api/extension.py` | 必須 | LMSタスクの一括upsert（is_hidden復元・is_done保持ロジックあり） |
| 18 | GET | `/api/assignments` | `api/tasks.py` | 必須 | 課題一覧（完了後1週間経過は除外、`is_assignment_candidate` でフィルタ） |
| 19 | GET | `/api/lms-system-types` | `api/tasks.py` | 必須 | `{lms_course_id: lms_system_type}` の辞書 |
| 20 | PUT | `/api/assignments/{id}/done` | `api/tasks.py` | 必須 | 完了フラグ更新（done_at 自動設定） |
| 21 | PUT | `/api/assignments/{id}/board-status` | `api/tasks.py` | 必須 | assignment/todo/done 移動（done なら is_done も連動） |
| 22 | PUT | `/api/assignments/{id}/title` | `api/tasks.py` | 必須 | タイトル変更 |
| 23 | DELETE | `/api/assignments/{id}` | `api/tasks.py` | 必須 | 論理削除（is_hidden=true、204） |
| 24 | GET | `/api/todos` | `api/tasks.py` | 必須 | Todo一覧（完了後1週間経過は除外） |
| 25 | POST | `/api/todos` | `api/tasks.py` | 必須 | Todo作成（201） |
| 26 | PUT | `/api/todos/{todo_id}` | `api/tasks.py` | 必須 | Todo更新（title / is_done 部分更新） |
| 27 | DELETE | `/api/todos/{todo_id}` | `api/tasks.py` | 必須 | 論理削除（is_hidden=true、204） |
| 28 | GET | `/api/personal-events` | `api/personal_events.py` | 必須 | 個人予定一覧 |
| 29 | POST | `/api/personal-events` | `api/personal_events.py` | 必須 | 個人予定作成（201） |
| 30 | PUT | `/api/personal-events/{event_id}` | `api/personal_events.py` | 必須 | 個人予定更新（全フィールド上書き） |
| 31 | DELETE | `/api/personal-events/{event_id}` | `api/personal_events.py` | 必須 | 個人予定削除（物理削除、204） |
| 32 | GET | `/privacy` | `api/privacy.py` | 不要 | プライバシーポリシーHTML（テンプレートの `__APP_URL__` を APP_URL で置換して起動時に生成） |
| 33 | GET | `/assets/*` | `main.py` | 不要 | 静的アセット（`Cache-Control: public, max-age=31536000, immutable`） |
| 34 | GET | `/{full_path:path}` | `main.py` | 不要 | SPA fallback（`index.html` を `Cache-Control: no-store` で返す。`api/` プレフィクスは404） |

### 1.3 認証方式

- **フロー**: フロント（`frontend/src/lib/supabase.ts`）と Chrome 拡張（`extension/src/background/background.ts`）が Supabase Auth からアクセストークンを取得し、`Authorization: Bearer <JWT>` で API を呼ぶ。
- **検証**（`app/core/auth.py`）:
  - JWKS URL: `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`（プロセス起動時に `PyJWKClient` を生成、キーはキャッシュされる）
  - アルゴリズム: `ES256`, `RS256`
  - `aud` は検証しない（`verify_aud: False`）。`sub` 必須。
  - 失敗時: **401** + `{"detail": "Could not validate credentials"}` + `WWW-Authenticate: Bearer` ヘッダ
- **CurrentUser の組み立て**（DBアクセスなし）:
  - `user_id` = `sub`
  - `email` = `email`（無ければ空文字）
  - `display_name` = `user_metadata.full_name`、無ければ email の `@` 前
  - `is_admin` = `app_metadata.is_admin`（bool化）
- **admin ガード**: `is_admin` でなければ **403** + `{"detail": "Admin only"}`
- **ensure_profile**: 書き込み系エンドポイントの冒頭で profiles 行を保証。同時リクエスト競合対策として `INSERT ... ON CONFLICT (user_id) DO NOTHING` を使用（重要: 移行後も同じ対策が必要）。
- **フロント側の挙動**: `authFetch` は 401 を受けると `supabase.auth.signOut()` して `/login` へリダイレクト。→ **401 のステータスコード互換は必須**。

### 1.4 DBアクセス箇所

- 接続: `app/db/session.py` — `create_engine(DATABASE_URL)` + リクエスト毎セッション（`get_db` 依存注入）。
- テーブル（`app/models/`）:

| テーブル | 主キー | 主要カラム | 備考 |
|---|---|---|---|
| `courses` | id (uuid文字列) | name, room, teacher, lms_course_id?, lms_system_type? | |
| `course_dates` | id | course_id (FK, CASCADE), year, quarter, day_of_week?, period, is_intensive_lct | day_of_week は「月〜日」の日本語1文字 |
| `enrollments` | id | course_id (FK, CASCADE), user_id (UUID) | user_id に FK なし |
| `profiles` | user_id (UUID) | display_name?, is_admin, assignment_sync_mode('auto'/'manual'), created_at, updated_at | updated_at は **SQLAlchemy の onupdate**（DBトリガではない）→ 移行側で明示更新が必要 |
| `tasks` | id | user_id, title, type('todo'/'assignment'), source_type, source_provider, is_done, done_at?, is_hidden, board_status, course_name?, lms_course_id?, task_contents_id?, source_url?, kind?, availability_start?, availability_end?, submitted_at?, result?, score?, is_due_estimated, is_active_url, created_at, updated_at | 日付系の多く（availability_* / submitted_at）は**文字列カラム** |
| `personal_events` | id | user_id, title, start, end?, all_day, color?, location?, description?, created_at | start/end は**文字列カラム**（ISO文字列をそのまま格納） |
| `university_event` | id | year, name, type, date, original_day | テーブル名が単数形なので注意 |

- ID生成: 全テーブルで **アプリ側の `uuid4()` 文字列**（`app/utils/uuid.py`）。DB側デフォルトなし → Hono側でも `crypto.randomUUID()` で生成する。
- 生SQL/特殊機能: `ensure_profile` の `ON CONFLICT DO NOTHING` のみ。他は素朴な CRUD。トランザクションは基本「1リクエスト=1コミット」だが、`create_course` は3回コミット、extension import系は多数の変更を最後に1コミット。

### 1.5 環境変数

**バックエンド（`app/core/config.py`、`.env`）**

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://...`（SQLAlchemy形式。Hono移行時は素の `postgresql://` になる） |
| `SUPABASE_URL` | JWKS取得元 |
| `CORS_ORIGINS` | カンマ区切りオリジン。本番は単一コンテナ同一オリジンのため空 |
| `APP_URL` | 公開URL。プライバシーポリシーの `__APP_URL__` 置換に使用 |

**フロント（ビルド時埋め込み）**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_EXTENSION_STORE_URL`（任意）, `VITE_API_PROXY_TARGET`（devのみ）

**拡張機能（ビルド時置換）**: `__APP_URL__`, `__SUPABASE_URL__`（manifest.template.json）+ SUPABASE_ANON_KEY（background.ts に埋め込み）

### 1.6 外部サービス連携

| サービス | 連携内容 | 移行影響 |
|---|---|---|
| Supabase Auth | JWT発行・JWKS公開・トークンリフレッシュ（拡張がSupabaseのtoken APIを直接叩く） | バックエンドは**検証のみ**。Hono側で JWKS 検証を再実装すれば互換 |
| Render | ホスティング + PostgreSQL | Workers から Render Postgres への直結は不可（TCP）。**Hyperdrive 経由**または **DB移設**が必要（§2.5） |
| Chrome拡張（KU-tasks同期） | `/api/courses/*`, `/api/me`, `/api/extension/*` を Bearer 付きで呼ぶ | API の URL・認証・レスポンス形式を維持すれば拡張の変更不要。**ホスト（URL）が変わる場合は manifest の host_permissions 更新 + ストア再審査が必要** |

### 1.7 バッチ処理・非同期処理

**なし。** cron・キュー・バックグラウンドタスク・WebSocket は一切使っていない。全APIが同期的なリクエスト/レスポンス。→ Workers の実行モデル（リクエスト駆動、CPU時間制限）と完全に相性が良い。

### 1.8 ファイル保存・Cookie・セッション

- **ファイル保存**: なし（アップロード機能なし）。静的配信のみ（フロントのビルド成果物 + privacy_policy.html テンプレート）。
- **Cookie**: 未使用。CORS設定に `allow_credentials=True` があるが実際には Bearer ヘッダのみ。
- **サーバーセッション**: なし。完全ステートレス。

### 1.9 その他の互換性上の注意（棚卸しで発見した罠）

1. `POST /api/course` は **ボディ `null` の200** を返す。フロントは `res.json()` を呼ぶため、Hono でも `c.json(null)` を返すこと（空ボディだと `res.json()` が例外になる）。
2. FastAPI のバリデーションエラーは **422**。フロント・拡張は `res.ok` しか見ていないため 400 でも動くが、揃えるなら zod validator の hook で 422 を返す。
3. エラーボディは `{"detail": "..."}` 形式。フロントはボディを読まないが、互換性維持のため踏襲を推奨。
4. `AssignmentPublic.task_name` は DB の `title` カラムの**別名**（レスポンスは `task_name`、リクエスト `PUT .../title` も `task_name`）。
5. `AssignmentPublic` は `task_contents_id` / `result` の `null` を空文字に変換して返す（Pydantic validator）。Hono 側でも `?? ''` が必要。
6. datetime（`done_at`, `created_at`）は timestamptz。FastAPI は `2026-07-07T12:34:56.789012+00:00` 形式で返す。フロントは `new Date()` でパースするため ISO 8601 なら互換（`Z` サフィックスでも可）。
7. `profiles.updated_at` の自動更新は SQLAlchemy の `onupdate`。Hono + SQL では UPDATE 文に `updated_at = now()` を明示する。
8. `GET /api/courses/{year_quarter}` の room は `format_room_for_display`（括弧書き除去）で整形済みの値を返すが、`PUT /api/course/{id}` のレスポンスは**未整形の room** を返す。この非対称も維持する。
9. `/api/extension/import-courses` の削除ロジックは「新規追加した講義のダミー `CourseDate()`（id=None）」を existing_map に入れる実装で、同一リクエスト内で追加→即削除対象になった場合 `CourseDate.id == None` の delete が走る（実質no-op）。移植時はこの挙動をそのまま再現するより、「今回追加した講義は削除対象にしない」と明示する方が安全（挙動は同一）。

---

## 2. Hono 移行後の構成案

### 2.1 全体アーキテクチャ

```
[Browser SPA / Chrome拡張]
        │ Authorization: Bearer <Supabase JWT>
        ▼
[Cloudflare Workers]
  ├─ Static Assets（フロントのビルド成果物、SPA fallback）
  └─ Hono app（/api/*, /privacy）
        │
        ▼
[Hyperdrive binding] ──TCP──> [PostgreSQL]（Supabase DB / Neon / Render のいずれか）
```

- 1つの Worker がフロント配信と API を兼ねる（現行の単一コンテナ構成と同じ、CORS不要を維持）。
- Workers Static Assets の `not_found_handling: "single-page-application"` で SPA fallback を実現し、`run_worker_first: ["/api/*", "/privacy"]` で API を Worker に通す。

### 2.2 ディレクトリ構成

```
workers/
├── wrangler.jsonc              # Worker設定（bindings, assets, hyperdrive）
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # エントリ。app生成・ルート登録・エラーハンドラ
│   ├── env.ts                  # Bindings型定義（Hyperdrive, SUPABASE_URL, ...）
│   ├── middleware/
│   │   ├── auth.ts             # JWT検証 → CurrentUser を c.set()。requireAdmin も
│   │   └── db.ts               # リクエスト毎のDBクライアント生成・後始末
│   ├── db/
│   │   ├── client.ts           # postgres.js クライアント生成（Hyperdrive接続文字列）
│   │   └── types.ts            # 全テーブルのRow型定義（付録Cの完成品をそのまま使用）
│   ├── schemas/                # zodスキーマ（Pydanticの対応物）
│   │   ├── course.ts
│   │   ├── task.ts
│   │   ├── extension.ts
│   │   └── universityEvent.ts
│   ├── routes/                 # FastAPIのapi/と1:1対応
│   │   ├── health.ts
│   │   ├── me.ts
│   │   ├── courses.ts
│   │   ├── calendar.ts
│   │   ├── universityEvents.ts
│   │   ├── extension.ts
│   │   ├── assignments.ts      # tasks.py のassignment系
│   │   ├── todos.ts            # tasks.py のtodo系
│   │   ├── personalEvents.ts
│   │   └── privacy.ts
│   ├── services/               # 純粋ロジック（app/services/ と1:1）
│   │   ├── schedule.ts         # build_class_dates / get_quarter_range
│   │   ├── assignmentFilter.ts # is_assignment_candidate
│   │   ├── courseDisplay.ts    # format_room_for_display
│   │   └── ensureProfile.ts    # ON CONFLICT DO NOTHING の移植
│   └── templates/
│       └── privacyPolicy.ts    # HTML文字列をTSモジュール化（Workersにfsは無い）
└── test/
    ├── services/               # 純粋ロジックのユニットテスト（vitest）
    └── routes/                 # ルートのテスト（@cloudflare/vitest-pool-workers）
```

### 2.3 ルーティング設計

Hono の `app.route()` でファイル分割。パスは現行と**完全一致**させる。

```ts
// src/index.ts の骨子
const app = new Hono<AppEnv>();
app.onError(errorHandler);            // §2.8
app.get('/api/health', ...);          // 認証なし
app.get('/privacy', ...);             // 認証なし
app.use('/api/*', authMiddleware);    // /api/health より後に登録しない（下記注意）
app.route('/', meRoutes);
app.route('/', courseRoutes);
// ...
```

**注意**: `/api/health` と `/privacy` は認証不要。Hono はミドルウェアを登録順に評価するため、`app.get('/api/health')` を `app.use('/api/*', auth)` より**先に**登録するか、auth ミドルウェア内で `c.req.path === '/api/health'` をスキップする。前者を推奨。

パスパラメータの複合形式（`{year}-{quarter}` 等）は現行同様に文字列で受けて `split('-')` する。パースに失敗した場合、FastAPI は 500 を返している（`map(int, ...)` の ValueError）。Hono では 400 を返してよい（フロントは正しい形式しか送らない）。

### 2.4 middleware 設計

| ミドルウェア | 適用範囲 | 内容 |
|---|---|---|
| `authMiddleware` | `/api/*`（health除く） | Bearerトークン抽出 → jose で JWKS 検証 → `c.set('user', currentUser)`。失敗時 401 `{"detail":"Could not validate credentials"}` + `WWW-Authenticate: Bearer` |
| `requireAdmin` | admin系4本 | `c.get('user').isAdmin` を確認。403 `{"detail":"Admin only"}` |
| `dbMiddleware` | `/api/*` | postgres.js クライアントを `c.set('db')`。Hyperdrive がプール管理するためリクエスト毎に `postgres(env.HYPERDRIVE.connectionString)` を生成し、レスポンス後 `ctx.waitUntil(sql.end())` で解放 |
| CORS | 環境変数で有効化時のみ | §2.9 |

認証実装の要点:

```ts
// src/middleware/auth.ts の骨子
import { createRemoteJWKSet, jwtVerify } from 'jose';

// モジュールスコープでキャッシュ（isolate生存中は再利用される）
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return unauthorized(c);
  jwks ??= createRemoteJWKSet(new URL(`${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  try {
    const { payload } = await jwtVerify(header.slice(7), jwks, {
      algorithms: ['ES256', 'RS256'],
      // audは検証しない（現行仕様に合わせる）
    });
    if (!payload.sub) return unauthorized(c);
    const meta = (payload as any).user_metadata ?? {};
    const appMeta = (payload as any).app_metadata ?? {};
    const email = (payload as any).email ?? '';
    c.set('user', {
      userId: payload.sub,
      email,
      displayName: meta.full_name || email.split('@')[0],
      isAdmin: Boolean(appMeta.is_admin),
    });
    return next();
  } catch {
    return unauthorized(c);
  }
});
```

- `jose` の `createRemoteJWKSet` はキーをメモリキャッシュし、未知の kid のときだけ再取得する（PyJWKClient と同等の挙動）。
- **exp 検証は jose がデフォルトで行う**（PyJWT も同様）。挙動互換。

### 2.5 DB接続設計

**前提**: Workers から素の TCP 接続は張れないため、Postgres へは **Hyperdrive**（Cloudflare のコネクションプール/プロキシ）を経由する。

| 選択肢 | 内容 | 推奨度 |
|---|---|---|
| A. Hyperdrive + 既存 Render Postgres | DB移設不要。Hyperdrive に Render の External URL を登録 | ◎ 移行期はこれ。DBを動かさないのでロールバックも容易 |
| B. Supabase Postgres へ移設 | Auth と DB が同居。Hyperdrive from Supabase URL でも可 | ○ 将来の統合案。データ移行（pg_dump/restore）が別途必要 |
| C. Neon 等サーバーレスPostgres | HTTPドライバ（@neondatabase/serverless）で Hyperdrive 不要 | △ DB移設コストが増えるだけなら A/B 優先 |

**方針: A で移行し、完全切替後に B を検討する。** DBを動かさないことで「新旧バックエンドが同一DBを見る」並行稼働（§4）が成立する。

- ドライバ: `postgres`（postgres.js）。`nodejs_compat` フラグを wrangler に設定。
- ORM: **導入しない（確定事項）**。素の postgres.js のタグ付きテンプレート（`` sql`SELECT ...` ``）+ 付録Cの Row 型で書く。理由: (1) 本プロジェクトのクエリは全て素朴な CRUD で ORM の恩恵が薄い (2) マイグレーションは当面 Alembic を正とするため、ORM側スキーマ定義との二重管理が事故の元 (3) 実装者（下位モデル）の判断余地を消す。Drizzle 等の導入は**完全移行後（T-21以降）に別途検討**し、この移行作業では一切触れない。
- **SQL記述上の必須注意**: `personal_events` の `end` カラムは **PostgreSQL の予約語**。生SQLでは必ず `"end"` とダブルクォートする（`start` は予約語ではないが、揃えて `"start"` と書いてよい）。SQLAlchemy は自動でクォートしていたため、この罠は生SQL移行で初めて顕在化する。
- `ensure_profile` の移植:

```sql
INSERT INTO profiles (user_id, display_name, is_admin)
VALUES ($1, NULL, false)
ON CONFLICT (user_id) DO NOTHING;
```

- トランザクション: extension import 系は `sql.begin(async (tx) => {...})` で1トランザクションに包む（現行の「最後に1コミット」と同等）。単発 CRUD は自動コミットで可。

### 2.6 バリデーション方針

- **zod v3 + @hono/zod-validator** を使用。Pydantic スキーマと 1:1 対応の zod スキーマを `src/schemas/` に置く。
- Pydantic → zod の対応規則:

| Pydantic | zod |
|---|---|
| `str` | `z.string()` |
| `Optional[str] = None` | `z.string().nullable().optional().default(null)`（受信時。※後述） |
| `int = Field(ge=1, le=4)` | `z.number().int().min(1).max(4)` |
| `Literal["a","b"]` | `z.enum(["a","b"])` |
| `list[X] = Field(min_length=1)` | `z.array(X).min(1)` |
| デフォルト値あり | `.default(...)` |

  ※ Pydantic の `Optional[str] = None` は「キー省略可・null可」。zod では `z.string().nullish()` を使い、ハンドラ側で `?? null` に正規化するのが最も互換的。
- バリデーション失敗時のステータス: zValidator の hook で **422** + `{"detail": [...]}` を返し FastAPI に揃える（detail の中身の形式までは互換不要。フロント・拡張はボディを読まない）。

### 2.7 認証設計

§2.4 の通り。追加事項:

- `CurrentUser` 型は `{ userId, email, displayName, isAdmin }`。ハンドラは `c.get('user')` で取得。
- Supabase 側の設定変更は**不要**（JWKSは公開エンドポイント。バックエンドがどこにあっても検証可能）。
- トークンリフレッシュはクライアント（supabase-js / 拡張のbackground.ts）の責務のまま変更なし。

### 2.8 エラーハンドリング方針

- `HTTPException` 相当として Hono の `HTTPException` を使い、`app.onError` で FastAPI 互換の形に整形:

```ts
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const res = err.getResponse();
    // detail形式に統一
    return c.json({ detail: err.message }, res.status as any,
      err.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined);
  }
  console.error(err);                    // Workers Logsに出る
  return c.json({ detail: 'Internal Server Error' }, 500);
});
```

- 404（リソース無し）は各ハンドラで `throw new HTTPException(404, { message: 'Assignment not found' })` のように投げる。メッセージは現行と同一文字列にする（§3の対応表参照）。
- 500 のスタックトレースはレスポンスに含めない。

### 2.9 CORS方針

- **現行本番は同一オリジンなので CORS 不要**。移行後も Worker がフロントを配信する限り不要。
- ただし移行期の並行稼働（フロント=Render / API検証用=Workers など）で必要になる場合に備え、Hono の `cors()` ミドルウェアを `CORS_ORIGINS` 環境変数（カンマ区切り）が非空のときだけ登録する。挙動は現行（origin列挙, credentials: true, 全メソッド・全ヘッダ許可）と同一にする。

### 2.10 ログ方針

- `console.log` / `console.error` を使用（Workers Logs / `wrangler tail` で閲覧）。
- 現行の運用ログ（`[get-courses]`, `[import-lms-tasks]`, `[get-assignments]` の件数・除外理由ログ）は**そのまま移植する**。デバッグ運用に使われているため勝手に削らない。
- リクエストログが欲しければ Hono の `logger()` ミドルウェアを dev のみ有効化。個人情報（email等）はログに出さない現行方針を維持（user_id は出してよい）。

### 2.11 静的配信・SPA fallback

wrangler.jsonc:

```jsonc
{
  "name": "ku-tasks",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "../frontend/dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/privacy"]
  },
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<hyperdrive-id>" }],
  "vars": { "SUPABASE_URL": "...", "APP_URL": "...", "CORS_ORIGINS": "" }
}
```

- フロントの `vite.config.ts` の `outDir` は現在 `../backend/static`。Workers 移行時は `../frontend/dist`（デフォルト）へ戻すか assets.directory を合わせる。
- キャッシュヘッダ: Workers Static Assets はハッシュ付きアセットに適切な ETag を付けるが、現行の `immutable` 長期キャッシュ / `index.html no-store` を厳密に再現したい場合は `_headers` ファイルで指定する:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/index.html
  Cache-Control: no-store
```

  （`index.html no-store` は拡張機能の `chrome.tabs.update` によるbfcache問題対策。**必ず維持する**。）

---

## 3. FastAPI と Hono の対応表

### 3.1 共通の型定義（src/types.ts 相当）

```ts
export type CurrentUser = { userId: string; email: string; displayName: string; isAdmin: boolean };
export type AppEnv = {
  Bindings: { HYPERDRIVE: Hyperdrive; SUPABASE_URL: string; APP_URL: string; CORS_ORIGINS: string; ASSETS: Fetcher };
  Variables: { user: CurrentUser; db: import('postgres').Sql };
};
```

### 3.2 エンドポイント対応表

難易度: ★=単純CRUD写経 / ★★=ロジック移植あり / ★★★=複雑なupsert・要注意

| FastAPI | Hono移行先 | Request schema (zod) | Response | 難易度 | 注意点 |
|---|---|---|---|---|---|
| `main.py: health` | `routes/health.ts` | なし | `{status:"ok"}` | ★ | 認証ミドルウェアより先に登録 |
| `me.py: read_me` | `routes/me.ts` `getMe` | なし | `{id, display_name, is_admin, assignment_sync_mode}` | ★ | profile無しでも200（display_name=null, mode="auto"） |
| `me.py: update_me` | `routes/me.ts` `patchMe` | `UpdateMePayload`: `{display_name?: string, assignment_sync_mode?: 'auto'\|'manual'}` | `{display_name, assignment_sync_mode}` | ★★ | mode不正は**400**（422でなく。Pydantic通過後の手動チェックのため）。profile無ければINSERT。`updated_at=now()` を明示 |
| `courses.py: create_course` | `routes/courses.ts` `createCourse` | `CreateCourse` | JSON `null` (200) | ★★ | **`c.json(null)` を返す**（§1.9-1）。Course→CourseDate→Enrollment の順にINSERT（1トランザクションで可） |
| `courses.py: delete_course` | `routes/courses.ts` `deleteCourse` | path: course_id | 204 | ★ | enrollment所有チェック→無ければ404 "Enrollment not found"。courses削除でcourse_dates/enrollmentsはCASCADE |
| `courses.py: delete_all_courses` | `routes/courses.ts` `deleteAllCourses` | なし | 204 | ★ | requireAdmin。`DELETE FROM courses`（CASCADE） |
| `courses.py: get_courses` | `routes/courses.ts` `getCourses` | path: `{year}-{quarter}` | 配列（§3.3参照） | ★★ | roomは `formatRoomForDisplay` で整形。運用ログ移植 |
| `courses.py: update_course` | `routes/courses.ts` `updateCourse` | `UpdateCourse`: `{name, room, teacher}` | `{id, name, room, teacher}` | ★ | enrollment所有チェック。roomは**未整形**で返す |
| `calendar.py: get_calendar` | `routes/calendar.ts` | path: `{year}-{month}` | 配列（§3.3参照） | ★★ | `buildClassDates` 移植が本体。is_intensive_lct除外。dates は `YYYY-MM-DD` 文字列配列 |
| `university_events.py` 4本 | `routes/universityEvents.ts` | `CreateUniEvent`/`UpdateUniEvent` | §3.3 | ★ | GET以外requireAdmin。POST/PUTはモデル全カラム返却（created系タイムスタンプなし） |
| `extension.py: extension_sync` | `routes/extension.ts` `sync` | `ExtensionSyncPayload` | `{status:"received", type}` | ★ | DB書込なし。html長のログのみ |
| `extension.py: import_courses` | `routes/extension.ts` `importCourses` | `ImportCoursesPayload` | `{status:"ok", count}` | ★★★ | §3.4参照。1トランザクション必須 |
| `extension.py: import_assignments` | `routes/extension.ts` `importAssignments` | `ImportAssignmentsPayload` | `{status:"ok", count}` | ★★ | upsertキー: task_contents_id → (title, course_name) の2段フォールバック |
| `extension.py: import_lms_tasks` | `routes/extension.ts` `importLmsTasks` | `ImportLmsTasksPayload` | `{status:"ok", count}` | ★★★ | §3.4参照。is_done保持・is_hidden復元・provider判定。運用ログ移植 |
| `tasks.py: get_assignments` | `routes/assignments.ts` `list` | なし | `AssignmentPublic[]` | ★★ | 完了1週間で除外（`NOT (is_done AND done_at < now()-'7 days')`）+ `isAssignmentCandidate` でアプリ側フィルタ。null→''変換（§1.9-5）。task_name=title |
| `tasks.py: get_lms_system_types` | `routes/assignments.ts` `lmsSystemTypes` | なし | `Record<string,string\|null>` | ★ | enrollments JOIN courses、lms_course_id NOT NULL |
| `tasks.py: update_assignment_done` | `routes/assignments.ts` `updateDone` | `{is_done: boolean}` | `{status:"ok"}` | ★ | done_at連動。404 "Assignment not found" |
| `tasks.py: update_assignment_board_status` | `routes/assignments.ts` `updateBoardStatus` | `{board_status: 'assignment'\|'todo'\|'done'}` | `{status:"ok"}` | ★ | done→is_done=true+done_at、他→false+null |
| `tasks.py: update_assignment_title` | `routes/assignments.ts` `updateTitle` | `{task_name: string}` | `{status:"ok"}` | ★ | titleカラムに書く |
| `tasks.py: delete_assignment` | `routes/assignments.ts` `remove` | path | 204 | ★ | 論理削除 is_hidden=true |
| `tasks.py: get_todos` | `routes/todos.ts` `list` | なし | `TodoPublic[]` | ★ | assignmentsと同じ1週間除外 |
| `tasks.py: create_todo` | `routes/todos.ts` `create` | `{title: string}` | `TodoPublic` (201) | ★ | ensureProfile。type='todo', source_type='manual', source_provider='user' |
| `tasks.py: update_todo` | `routes/todos.ts` `update` | `{title?, is_done?}` | `TodoPublic` | ★ | 部分更新。is_done変更時done_at連動 |
| `tasks.py: delete_todo` | `routes/todos.ts` `remove` | path | 204 | ★ | 論理削除 |
| `personal_events.py` 4本 | `routes/personalEvents.ts` | `CreatePersonalEvent`/`UpdatePersonalEvent` | `PersonalEventPublic` | ★ | PUTは全フィールド上書き。DELETEは物理削除。start/endは文字列のまま |
| `privacy.py` | `routes/privacy.ts` | なし | HTML | ★ | HTMLをTS文字列モジュール化し `__APP_URL__` を `c.env.APP_URL` で置換（fs無し） |
| `main.py: static/SPA` | wrangler assets設定 | — | — | ★ | §2.11。コード不要、設定+_headersのみ |

### 3.3 レスポンス型定義（フロントの期待と一致させる）

```ts
// GET /api/courses/{y}-{q} の要素
type CourseListItem = {
  id: string; name: string; room: string; teacher: string;
  year: number; quarter: number; day_of_week: string | null; period: number;
  is_intensive_lct: boolean; lms_course_id: string | null; lms_system_type: string | null;
};

// GET /api/calendar/{y}-{m} の要素
type CalendarItem = {
  id: string; name: string; room: string; teacher: string;
  dates: string[];   // "YYYY-MM-DD"（Python の date → ISO。ゼロ埋め必須）
  period: number;
};

// GET /api/university-events/{year} の要素
type UniversityEvent = {
  id: string; name: string;
  type: 'exam' | 'interval' | 'transfer' | 'other' | 'holiday';
  date: string; original_day: string;
};

type AssignmentPublic = {
  id: string; task_name: string; task_contents_id: string;  // null→''
  course_name: string | null; submitted_at: string | null;
  result: string;                                            // null→''
  score: string | null; kind: string | null;
  availability_start: string | null; availability_end: string | null;
  source_url: string | null; is_due_estimated: boolean; is_active_url: boolean;
  board_status: 'assignment' | 'todo' | 'done'; lms_course_id: string | null;
  is_done: boolean; done_at: string | null;                  // ISO 8601
  created_at: string;                                        // ISO 8601
};

type TodoPublic = {
  id: string; title: string; is_done: boolean;
  done_at: string | null; created_at: string;
};

type PersonalEventPublic = {
  id: string; title: string; start: string; end: string | null;
  all_day: boolean; color: string | null; location: string | null;
  description: string | null; created_at: string;
};
```

### 3.4 複雑ロジックの移植仕様（★★★）

**import-courses（`extension.py:34-125`）**

1. `makeKey(year, quarter, day_of_week, period, name)`: 集中講義（day_of_week=null かつ period=0）のときのみ name をキーに含める。それ以外は name を null にする。
2. ユーザーの enrollments から既存 (Course, CourseDate) のマップを構築。
3. payload.courses を走査: キー一致 → 既存 Course/CourseDate を上書き（name, room, teacher, lms_course_id, lms_system_type, is_intensive_lct）。不一致 → Course + CourseDate + Enrollment を新規INSERT。
4. 削除フェーズ: `year == sync_year && quarter ∈ sync_quarters` の**既存**講義のうち incoming に無いものについて、該当ユーザーの Enrollment・その CourseDate・Course を削除。**このリクエストで新規追加した講義は削除対象にしない**（現行実装のダミーCourseDate挙動と等価）。
5. 全体を1トランザクション。レスポンス `{status:"ok", count: <payloadの件数>}`。

**import-lms-tasks（`extension.py:183-306`）**

1. ユーザーの type='assignment' 全件を取得し、2つのマップを作る:
   - 主キー: `(lms_course_id, task_contents_id)`（両方非空のもの）
   - フォールバック: `(lms_course_id, source_url)`（task_contents_id が**空**のもののみ）
2. enrolled コースから `lms_course_id → lms_system_type` マップを構築。provider は `lms_system_type === 'webclass' ? 'webclass' : 'kanazawa_lms'`（マップに無い course_id も 'kanazawa_lms'）。
3. 各 item: 既存一致→ title, kind, course_name, lms_course_id, availability_start/end, is_due_estimated(=available_untilの有無), source_url, source_provider, is_active_url を上書き。content_id があれば task_contents_id 更新。**is_hidden を必ず false に戻す**（削除済みの復元）。is_done は**触らない**。
4. 新規: type='assignment', source_type='lms', result='', task_contents_id = content_id ?? '' でINSERT。
5. 統計ログ（received/created/updated/done_preserved/hidden_restored）と item毎の candidate 判定ログを出力。

**services の純粋関数3つ**（`schedule.py` / `assignment_filter.py` / `course_display.py`）は既存の pytest（`test_schedule.py` 等）のケースを vitest に写して等価性を担保する。特に:

- `getQuarterRange`: Q1=4/6〜6/4, Q2=6/11〜8/6, Q3=10/1〜12/2, Q4=12/9〜**翌年**2/10。不正quarterは例外。
- `buildClassDates`: JSの `Date.getDay()` は日曜=0、Python の `weekday()` は月曜=0。**曜日マッピングの写し間違いが最頻出バグ**になるので DAY_MAP をテストで固定する。
- `formatRoomForDisplay`: 全角/半角括弧の除去を再帰的に行う正規表現。JSでも同じパターンで可（`/\s*[（(][^（）()]*[）)]\s*/g` をループ）。

---

## 4. 段階的移行手順

### 4.1 移行戦略: ストラングラーパターン（同一DB並行稼働）

```
Phase A（現状）    : Render(FastAPI+static) ── Render PG
Phase B（並行稼働）: Workers(Hono+assets) ─┬─ Hyperdrive ─ Render PG
                     Render(FastAPI) ──────┘   （WorkersがフォールバックとしてRenderへproxy）
Phase C（完了）    : Workers のみ。Render 停止
```

- Workers 側で**未実装のルートは Render へ素通しproxy**する:

```ts
app.all('/api/*', (c) => fetch(new URL(c.req.path + search, c.env.LEGACY_ORIGIN), c.req.raw));
```

  これにより「1エンドポイント移行するたびに本番反映」が安全にできる。認証ヘッダはそのまま転送されるので Render 側で従来通り検証される。
- **DBは動かさない**（Render PG のまま Hyperdrive で接続）。データ移行ゼロ、ロールバックは DNS/ルート切替のみ。
- DNS 切替（本番ドメインを Workers に向ける）は Phase B の開始時点で行い、以降のリスクは「Worker側実装の正しさ」だけに限定する。
- **拡張機能への影響**: 公開URLを変えなければ manifest 変更不要。URL が変わる場合のみ `__APP_URL__` の差し替え + ストア再審査が必要（リードタイム数日）ので、**独自ドメイン or 既存URLの温存を強く推奨**。

### 4.2 移行順序（依存関係と難易度に基づく）

| 順 | 対象 | 理由 |
|---|---|---|
| 0 | 基盤（プロジェクト作成、Hyperdrive、proxy fallback、CI） | 全ての前提 |
| 1 | `GET /api/health` | 認証もDBも不要。デプロイ検証用 |
| 2 | 認証ミドルウェア + `GET /api/me` | 認証の疎通確認。read-only |
| 3 | 純粋サービス3関数 + テスト | ルート実装の前提。DBも認証も不要 |
| 4 | read系: `GET /api/university-events/{year}`, `GET /api/courses/{y}-{q}`, `GET /api/calendar/{y}-{m}`, `GET /api/lms-system-types` | DB read-only。壊れてもデータは無事 |
| 5 | personal-events 4本 | 他テーブルと関係しない独立CRUD。write系の練習台として最適 |
| 6 | todos 4本 + `PATCH /api/me` | ensureProfile を含むwrite。tasksテーブルの単純側 |
| 7 | assignments 5本（list/done/board-status/title/delete） | tasksテーブルのread+更新。import系より単純 |
| 8 | course CRUD（POST/PUT/DELETE /api/course, DELETE /api/courses） | CASCADE削除・null応答など罠あり |
| 9 | university-events の admin 3本 | requireAdmin の検証 |
| 10 | extension 4本（sync → import-assignments → import-courses → import-lms-tasks） | **最後**。最も複雑・拡張機能の実データが絡む。sync は単純なので先に |
| 11 | `/privacy` + 静的配信切替（assets + _headers） | フロント配信の切替。全API移行後 |
| 12 | Render 停止・Alembic運用の引き継ぎ判断 | クリーンアップ |

**後回しにすべきAPI**: extension import 3本（複雑upsert・失敗時の影響大）、静的配信（切替は一度きりで良い）。

**認証が絡むAPI**: health と privacy 以外すべて。→ 順序2で認証ミドルウェアを最初に固め、以降は全ルートが同じミドルウェアを使う。admin 系（6,11,12,13番）は requireAdmin の追加のみ。

**DB変更が必要なAPI**: **なし**。スキーマは一切変更しない（変更しないことが並行稼働の前提）。移行完了までは Alembic が唯一のマイグレーション手段。

### 4.3 検証方法

1. **ユニットテスト（vitest）**: services 3関数は既存 pytest のケースを写経。曜日・境界日付を重点的に。
2. **ルートテスト（@cloudflare/vitest-pool-workers）**: 各ルートについて 200/201/204、401（トークン無し）、404（他人のリソース）、admin 403 を最低限。JWT はテスト用に自前署名した ES256 鍵ペア + JWKS モックで検証する。
3. **パリティテスト（移行期の要）**: 同一DBに対して FastAPI と Hono の両方へ同じ GET リクエストを投げ、JSONを正規化比較するスクリプトを `scripts/parity-check.ts` として用意。read系エンドポイント全部に対して実行し、差分ゼロを確認してからルートを切り替える。**正規化ルールは以下に固定**（実装者が挙動を「合わせるために」どちらかを歪めることを防ぐ）:
   - **比較前の正規化（許容する差分）**:
     - タイムスタンプ表記の違い: `created_at` / `updated_at` / `done_at` は `Date.parse()` して**ミリ秒精度のepoch値**で比較する。FastAPI はマイクロ秒 + `+00:00`（例 `2026-07-07T12:34:56.789012+00:00`）、JS は ミリ秒 + `Z`（例 `2026-07-07T12:34:56.789Z`）を返すが、**これは仕様上許容される差分**であり、どちらかの出力形式を無理に変えてはならない（フロントは `new Date()` でパースするため両形式とも動く）。
     - 配列の並び順: 現行実装に `ORDER BY` は無く順序は非保証。**`id` キーで両者をソートしてから**要素比較する。
     - JSONオブジェクトのキー順: deep-equal で比較（キー順は無視）。
   - **許容しない差分（1件でもあれば Hono 側のバグ）**:
     - キーの過不足（`undefined` によるキー欠落を含む。FastAPI は全キーを必ず出力する）
     - `null` と `''` の違い（例: `task_contents_id` は null→'' 変換が仕様。§1.9-5）
     - 数値と文字列の型違い（例: `year: 2026` vs `"2026"`）
     - 配列の件数差、bool値の差
   - **差分が出たときの対応原則**: 必ず **Hono 側を FastAPI に合わせる**。FastAPI・DB・フロントエンドの変更でつじつまを合わせることを禁止する。
   - スクリプトの入力: 比較対象エンドポイントのリスト、テストユーザーの有効なJWT（環境変数 `PARITY_TOKEN` で渡す）、両バックエンドのベースURL。出力: エンドポイント毎の PASS/FAIL と、FAILの場合は正規化後JSONの最初の差分パス（例 `[3].done_at`）。
4. **手動E2E**: `/verify` スキル（リポジトリの実機検証レシピ）に従い、本物のフロント + 拡張機能で「ログイン → 講義同期 → 課題同期 → Todo/個人予定 CRUD」を通す。特に拡張機能は import 系切替後に必ず実施。
5. **ロールバック手順**: 各ルート切替は Worker 内のルート登録1行（proxy fallback に戻す）で戻せる。デプロイは `wrangler rollback` も可。

---

## 5. 下位モデル向け実装タスク分解

原則: 1タスク = 1PR = レビュー可能な最小単位。各タスクは前のタスクの完了を前提とする。**すべてのタスクで「FastAPI側のコードは変更しない」**。

> 表記: 対象ファイルは `workers/` 起点。完了条件の「パリティ」は §4.3-3 のスクリプト比較を指す。

### 5.0 人間（オペレーター）作業の分離 — 実装AIはやらない・待つ

以下はダッシュボード操作・課金・DNS・審査を伴うため**人間が実施する**。実装AI（下位モデル）への絶対ルール:

> **OP タスクで発行される値（Hyperdrive ID、URL 等）が未提供の場合、推測値やダミー値を埋めて「完了」と報告してはならない。** 設定ファイルには `<OP-02で発行されるID>` のようなプレースホルダを残し、「OP-xx 待ちでブロック中」と報告して停止すること。`wrangler dev` はローカル値で動くため、ローカル検証まで進めてよいが、デプロイを完了条件に含むタスクはOP完了まで完了扱いにしない。

| ID | 作業 | 内容 | ブロックされるタスク |
|---|---|---|---|
| OP-01 | Cloudflareアカウント準備 | アカウント作成（Workers 有料プラン推奨。Hyperdrive はFreeでも可だが制限確認）、`wrangler login`、Workersプロジェクト名の確定 | T-01 のデプロイ確認 |
| OP-02 | Hyperdrive 作成 | Render PostgreSQL の **External Database URL** を取得し、Cloudflare ダッシュボード（またはwrangler CLI）で Hyperdrive 構成を作成。発行された ID を実装AIに渡す。ローカル開発用に compose の PG を指す `localConnectionString`（`postgresql://app:app@localhost:5432/app`）も設定 | T-05 以降のデプロイ環境での動作確認（ローカル実装・テストは進められる） |
| OP-03 | 環境変数・vars 設定 | `wrangler.jsonc` の vars（`SUPABASE_URL` / `APP_URL` / `CORS_ORIGINS` / `LEGACY_ORIGIN`=RenderのURL）の**本番値**を確定して渡す。フロントビルド用の `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_EXTENSION_STORE_URL` を CI に設定 | T-02（LEGACY_ORIGIN）、T-20（フロントビルド） |
| OP-04 | DNS / ルーティング切替 | 本番ドメインを Workers に向ける（Custom Domain 設定）。切替前に Workers の `*.workers.dev` URL で最終確認。Render 側は削除せず温存 | T-20 の本番切替、T-21 |
| OP-05 | Chrome拡張の対応判断 | 公開URLを温存する場合: 作業なし。URLが変わる場合: `manifest.template.json` の `__APP_URL__` 差し替え → ストア再審査（リードタイム数日）→ 承認後に旧URL停止 | T-21（旧環境停止の前提） |
| OP-06 | 本番DBのバックアップ | T-12（最初のwrite系）着手前と T-17〜19（extension import系）着手前に `pg_dump` を取得 | T-12, T-17 の本番投入 |

### T-01: Workersプロジェクト雛形の作成
- **目的**: Hono + TypeScript の空プロジェクトを作り、ローカルで起動できるようにする。
- **対象**: `workers/package.json`, `wrangler.jsonc`, `tsconfig.json`, `src/index.ts`, `src/env.ts`
- **内容**: `npm create hono@latest`（cloudflare-workersテンプレート）相当を手動作成。依存: `hono`, `zod`, `@hono/zod-validator`, `jose`, `postgres`, devDeps: `wrangler`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`。`compatibility_flags: ["nodejs_compat"]`。`src/index.ts` は `GET /api/health` → `{"status":"ok"}` のみ実装。
- **完了条件**: `wrangler dev` で起動し `curl localhost:8787/api/health` が `{"status":"ok"}` を返す。`tsc --noEmit` が通る。
- **テスト**: vitest で health の200を1本。

### T-02: レガシーproxyフォールバックの実装
- **目的**: 未実装ルートを既存 Render バックエンドへ素通しする。
- **前提**: OP-03（`LEGACY_ORIGIN` の本番値）。未提供ならプレースホルダで実装しローカル検証まで（§5.0）。
- **対象**: `src/index.ts`, `src/env.ts`（`LEGACY_ORIGIN` 追加）, `wrangler.jsonc`
- **内容**: 全ルート定義の**最後**に `app.all('/api/*', proxyToLegacy)` と `app.all('/privacy', proxyToLegacy)` を追加。メソッド・ヘッダ・ボディ・クエリ文字列をそのまま転送し、レスポンスをそのまま返す。
- **完了条件**: `wrangler dev` 経由で `/api/me`（有効なトークン付き）が Render 経由と同じレスポンスを返す。
- **テスト**: LEGACY_ORIGIN をモックし、パス・メソッド・Authorizationヘッダが転送されることを確認。

### T-03: エラーハンドラと共通レスポンスヘルパ
- **目的**: FastAPI互換のエラー形式（`{"detail": ...}`）を一元化。
- **対象**: `src/middleware/error.ts`（onErrorハンドラ）, `src/index.ts`
- **内容**: §2.8 のコードを実装。`notFound(c, msg)` / `unauthorized(c)` / `forbidden(c, msg)` ヘルパも `src/lib/httpError.ts` に定義。
- **完了条件**: 存在しないルート以外で throw された HTTPException が `{"detail": "..."}` になる。401 に `WWW-Authenticate: Bearer` が付く。
- **テスト**: 各ヘルパのステータス・ボディ・ヘッダを検証。

### T-04: 認証ミドルウェア
- **目的**: Supabase JWT の検証と CurrentUser の注入。
- **対象**: `src/middleware/auth.ts`, `src/types.ts`
- **内容**: §2.4 のコードを実装。`requireAdmin` ミドルウェアも同ファイルに。`/api/health` は auth 適用前に登録されていることを index.ts で確認。
- **完了条件**: 有効トークンで next() に到達し `c.get('user')` が §3.1 の形。トークン無し/不正/期限切れで 401 + `{"detail":"Could not validate credentials"}`。sub無しトークンで401。
- **テスト**: **付録Dのテストハーネスをそのまま使う**（自作のスタブで検証をスキップするモックは禁止。署名検証が実際に行われるテストであること）。is_admin あり/なし、user_metadata.full_name あり/なし（email前方フォールバック）、期限切れトークン、別鍵で署名したトークン（署名不一致→401）を網羅。

### T-05: DB接続（Hyperdrive + postgres.js）
- **目的**: Workers から既存 Postgres へ接続する。
- **前提**: OP-02（Hyperdrive作成）。未完了ならローカル実装+テストまで進めてプレースホルダを残す（§5.0のルール）。
- **対象**: `src/db/client.ts`, `src/db/types.ts`, `src/middleware/db.ts`, `wrangler.jsonc`（hyperdrive binding。ローカルは `localConnectionString` で compose の PG を指す）
- **内容**: リクエスト毎に `postgres(env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false })` を生成し `c.set('db', sql)`、レスポンス後 `c.executionCtx.waitUntil(sql.end())`。`src/db/types.ts` は**付録Cの完成品をそのまま貼る**（自分でモデルから再翻訳しない）。
- **完了条件**: dev環境で `SELECT 1` を返す一時ルートが動く（確認後削除）。
- **テスト**: vitest-pool-workers でローカルPGに対する接続テスト1本（CI では compose の PG を利用）。

### T-06: services/schedule.ts（純粋関数）
- **目的**: 授業日展開ロジックの移植。
- **対象**: `src/services/schedule.ts`, `test/services/schedule.test.ts`
- **内容**: `getQuarterRange(year, quarter)` と `buildClassDates(year, quarter, dayOfWeek)` を `backend/app/services/schedule.py` から移植。戻り値は `"YYYY-MM-DD"` 文字列配列（ゼロ埋め必須）。日付計算は UTC ずれを避けるため `Date.UTC` ベースか単純な日数ループで実装。
- **完了条件**: `backend/tests/test_schedule.py` の全ケースと同じ入出力。Q4 が翌年2/10まで含むこと、曜日マップ（月〜日）が正しいこと。
- **テスト**: pytest のケースを写経 + 「2026年Q1の月曜日一覧」のスナップショット。

### T-07: services/assignmentFilter.ts + courseDisplay.ts（純粋関数）
- **目的**: 課題フィルタと教室名整形の移植。
- **対象**: `src/services/assignmentFilter.ts`, `src/services/courseDisplay.ts`, 対応テスト
- **内容**: `is_assignment_candidate`（キーワードリスト3種を**そのままの文字列で**移植。判定順序: 含むキーワード→kind除外→タイトル除外→true）と `format_room_for_display`（括弧除去の固定点ループ + 空白正規化）。
- **完了条件**: 既存 pytest 相当ケースで一致。「提出」「資料」「Lesson Materials」「掲示板」等の日英ケースを網羅。
- **テスト**: 各キーワード分岐1ケース以上。

### T-08: GET /api/me
- **目的**: 認証+DB read の最小ルートで疎通確認。
- **対象**: `src/routes/me.ts`, `src/index.ts`（proxy より前に登録）
- **内容**: profiles を user_id で1件取得。無ければ `display_name: null, assignment_sync_mode: "auto"`。レスポンス4キーは §1.2-2 参照。
- **完了条件**: FastAPI とのパリティ一致（profileあり/なし両方）。
- **テスト**: profileあり・なしの2ケース。

### T-09: GET /api/university-events/{year}
- **目的**: read系の最初の一般ルート。
- **対象**: `src/routes/universityEvents.ts`
- **内容**: `university_event` テーブル（**単数形**）から year で絞って全件。キーは id/name/type/date/original_day のみ。
- **完了条件**: パリティ一致。year は数値でない場合404か400（現行は int パスパラメータで422。フロントは正しい値しか送らないので 400 で可と明記）。
- **テスト**: データあり/なし。

### T-10: GET /api/courses/{year_quarter} + GET /api/lms-system-types
- **目的**: enrollments/courses/course_dates を跨ぐ read の移植。
- **対象**: `src/routes/courses.ts`, `src/routes/assignments.ts`（lms-system-types はどちらのファイルでも可、tasks系に置くなら assignments.ts）
- **内容**: §1.2-7, -19 のロジック。get_courses は enrollments → course_ids → courses + course_dates(year, quarter) を結合し、room を `formatRoomForDisplay` で整形。件数ログと明細ログ（§2.10）を console.log で移植。
- **完了条件**: パリティ一致（enrollments 0件 → `[]` を含む）。
- **テスト**: enrollments無し、複数講義、集中講義（day_of_week=null）を含むケース。

### T-11: GET /api/calendar/{year_month}
- **目的**: schedule サービスを使う read の移植。
- **対象**: `src/routes/calendar.ts`
- **内容**: §1.2-9。course_dates 全件（quarter絞りなし）→ is_intensive_lct 除外 → buildClassDates → 対象年月のみ filter → dates 空なら要素ごと除外。room は**未整形**（calendar は format しない。courses との違いに注意）。
- **完了条件**: パリティ一致（月跨ぎのQ4を含む）。
- **テスト**: 対象月に授業がある/ない、Q4の1月分。

### T-12: personal-events 4本
- **目的**: 独立テーブルへの最初の write。
- **前提**: 本番ルート切替前に OP-06（DBバックアップ）。
- **対象**: `src/routes/personalEvents.ts`, `src/schemas/task.ts`（zod: CreatePersonalEvent / UpdatePersonalEvent）, `src/services/ensureProfile.ts`
- **内容**: §1.2-28〜31。POST は ensureProfile（`ON CONFLICT DO NOTHING`）→ INSERT（id は `crypto.randomUUID()`）→ 201 で全カラム返却。PUT は所有チェック（無ければ404 "Personal event not found"）→ 全フィールド上書き。DELETE は物理削除204。created_at は ISO 文字列で返す。
- **完了条件**: フロントの個人予定 CRUD が Worker 経由で完動。パリティ（GET）一致。
- **テスト**: CRUD 4本 + 他人のイベントに対する 404 + 未認証401。

### T-13: todos 4本 + PATCH /api/me
- **目的**: tasks テーブルへの write と profile 更新。
- **対象**: `src/routes/todos.ts`, `src/routes/me.ts`, `src/schemas/task.ts`
- **内容**: §1.2-24〜27, -3。get_todos の除外条件は `is_hidden = false AND NOT (is_done = true AND done_at < now() - interval '7 days')`。update_todo は渡されたキーだけ更新、is_done=true で done_at=now()、false で null。PATCH /api/me は mode 不正時 **400** `{"detail":"assignment_sync_mode must be 'auto' or 'manual'"}`、profiles 更新時に `updated_at = now()` を明示。
- **完了条件**: フロントの Todo 操作が完動。1週間前に完了した Todo が出ないこと。
- **テスト**: 除外境界（done_at がちょうど7日前後）、部分更新、mode バリデーション400。

### T-14: assignments 5本
- **目的**: 課題の read + 状態更新。
- **対象**: `src/routes/assignments.ts`, `src/schemas/task.ts`
- **内容**: §1.2-18, -20〜23。list は todos と同じ除外条件 + `isAssignmentCandidate(title, kind)` を**アプリ側で**適用し、除外件数・明細を console.log。レスポンスは §3.3 AssignmentPublic（task_name=title、task_contents_id/result の null→''）。board-status 更新の is_done/done_at 連動を正確に。
- **完了条件**: フロントの課題ボード操作（done切替・列移動・改名・削除）が完動。GETパリティ一致。
- **テスト**: フィルタ除外あり課題の list、board_status 3値の遷移、404。

### T-15: course CRUD（POST/PUT/DELETE + admin全削除）
- **目的**: 講義の手動 CRUD 移植。
- **対象**: `src/routes/courses.ts`, `src/schemas/course.ts`
- **内容**: §1.2-4〜6, -8。**POST は `c.json(null)` を返す（200）**。zod: day_of_week は `z.enum(['月','火','水','木','金','土','日'])`, quarter 1-4, period 1-6。DELETE は enrollment チェック→ courses を削除（CASCADE確認）。DELETE /api/courses は requireAdmin。
- **完了条件**: フロントの講義追加/編集/削除が完動。POST 後にフロントの `res.json()` が例外にならない。
- **テスト**: POST の null 応答、非enrollユーザーの404、admin/非adminの403。

### T-16: university-events admin 3本
- **目的**: requireAdmin 付き write の移植。
- **対象**: `src/routes/universityEvents.ts`, `src/schemas/universityEvent.ts`
- **内容**: §1.2-11〜13。POST/PUT は行の全カラムをそのまま返す。404メッセージは "University Event not found"。
- **完了条件**: adminユーザーで CRUD 完動、非adminは403。
- **テスト**: 403/404/正常系。

### T-17: extension/sync + import-assignments
- **目的**: 拡張連携の単純な2本を移植。
- **前提**: 本番ルート切替前に OP-06（DBバックアップ再取得）。
- **対象**: `src/routes/extension.ts`, `src/schemas/extension.ts`, `src/schemas/task.ts`
- **内容**: sync はログ出力（user_id, type, url, html長）のみで `{status:"received", type}`。import-assignments は §3.2 の2段フォールバックupsert（task_contents_id 一致 → (title, course_name) 一致 → 新規）。新規時 `task_contents_id = item.task_contents_id || ''`, `result = item.result || ''`, source_provider='kanazawa_lms'。1トランザクション。
- **完了条件**: 拡張機能の「レポート一覧同期」が Worker 経由で成功し、再実行で重複が増えない。
- **テスト**: 新規/上書き/フォールバック一致の3ケース、冪等性（同一payload 2回で件数不変）。

### T-18: extension/import-courses
- **目的**: 最複雑ルート①の移植。
- **対象**: `src/routes/extension.ts`
- **内容**: §3.4 の仕様に厳密に従う。1トランザクション必須。削除フェーズは「既存講義のみ対象」。
- **完了条件**: 拡張機能の履修同期で (a) 新規講義が入る (b) 既存講義が上書きされる (c) 履修を落とした講義が消える (d) sync_quarters 外の講義は消えない、の4点を実データで確認。
- **テスト**: 上記4ケース + 集中講義（同一枠複数）のキー衝突が起きないこと + 冪等性。

### T-19: extension/import-lms-tasks
- **目的**: 最複雑ルート②の移植。
- **対象**: `src/routes/extension.ts`
- **内容**: §3.4 の仕様に厳密に従う。特に (1) 2種の照合マップの構築条件 (2) is_hidden 復元 (3) is_done 非破壊 (4) provider 判定 (5) 統計ログ。1トランザクション。
- **完了条件**: 拡張機能のLMSタスク同期後、完了済み課題の is_done が保持され、削除済み課題が復活する（現行と同じ挙動）。冪等。
- **テスト**: done_preserved / hidden_restored / webclass provider / content_id無しでsource_url一致、の4ケース + 冪等性。

### T-20: /privacy + 静的配信の切替
- **目的**: フロント配信を Workers Static Assets に切替え、全トラフィックを Workers 完結にする。
- **前提**: OP-03（フロントビルド用環境変数）、本番切替は OP-04。
- **対象**: `src/routes/privacy.ts`, `src/templates/privacyPolicy.ts`, `wrangler.jsonc`（assets設定）, `frontend/vite.config.ts`（outDir変更）, `public/_headers`, CI/デプロイ設定
- **内容**: privacy_policy.html を TS テンプレート文字列化し `__APP_URL__` 置換。assets 設定は §2.11 の通り（SPA fallback + run_worker_first + _headers で index.html no-store / assets immutable）。
- **完了条件**: 直リンク（例 `/settings`）リロードで index.html が返る。`/api/xxx` 未知パスが404。`curl -I /assets/<hash>.js` が immutable、`/` が no-store。
- **テスト**: 上記 curl 検証 + フロント全画面の手動確認。

### T-21: proxyフォールバック撤去とクリーンアップ
- **目的**: 移行完了の確定。
- **前提**: OP-04 完了、OP-05 の判断確定。
- **対象**: `src/index.ts`（proxy削除）, `src/env.ts`（LEGACY_ORIGIN削除）, `docs/DEPLOY.md`（Workers手順に書き換え）
- **内容**: 全ルート移行とパリティ確認完了後、proxy を削除。Render サービスは即削除せず**2週間サスペンド**で温存（ロールバック保険）。Alembic は当面継続（マイグレーション実行はローカル/CIから）。
- **完了条件**: Workers Logs で LEGACY_ORIGIN への転送が7日間ゼロであることを確認してから削除。全E2E（/verify レシピ）合格。
- **テスト**: パリティスクリプトを read 系全ルートで最終実行。

### タスク依存図

```
T-01 → T-02 → T-03 → T-04 → T-05 ─┬→ T-08 → T-09 → T-10 → T-11
T-06, T-07（T-01後ならいつでも）───┘         （T-10,11はT-06,07に依存）
T-05 → T-12 → T-13 → T-14 → T-15 → T-16 → T-17 → T-18 → T-19 → T-20 → T-21
```

---

## 付録A: 主要ライブラリ対応表

| 現行（Python） | 移行後（TypeScript） |
|---|---|
| FastAPI | hono |
| Pydantic | zod + @hono/zod-validator |
| PyJWT + PyJWKClient | jose（createRemoteJWKSet / jwtVerify） |
| SQLAlchemy + psycopg | postgres（postgres.js）の生SQL + 付録CのRow型。**ORMは導入しない（§2.5で確定）** |
| Alembic | **当面 Alembic 継続**（完全移行後にTS側マイグレーションツールへの引き継ぎを別途検討） |
| uvicorn / Render | wrangler / Cloudflare Workers |
| StaticFiles + SPA fallback | Workers Static Assets（single-page-application） |
| pytest + httpx | vitest + @cloudflare/vitest-pool-workers |

## 付録B: 移行してはいけないもの・変えてはいけないもの

1. **APIのパス・メソッド・ステータスコード・レスポンスキー名**（フロントと公開済みChrome拡張が依存。特に拡張は再審査リードタイムがある）
2. **DBスキーマ**（並行稼働の前提。カラム追加等は移行完了まで凍結が望ましい。やむを得ず変更する場合は FastAPI/Hono 両方を同時更新）
3. **401時のセマンティクス**（フロントが強制ログアウトに使用）
4. **`index.html` の no-store**（拡張のbfcache問題対策）
5. **Supabase プロジェクト設定**（変更不要のものを触らない）

## 付録C: `src/db/types.ts` 完成品（写経禁止・このまま使う）

既存スキーマ（Alembic管理）と1:1対応の Row 型。**実装者はこのコードをそのまま使い、Pythonモデルから再翻訳しない**（翻訳ミス防止のため本仕様書を正とする。スキーマ変更があった場合はまず本付録を更新する）。

```ts
// src/db/types.ts
// 既存PostgreSQLスキーマ（Alembic管理）のRow型。
// - id は全テーブルでアプリ側生成のUUID文字列（DBデフォルトなし）→ INSERT時に crypto.randomUUID() を渡す
// - timestamptz カラムは postgres.js が Date にパースして返す。レスポンスでは date.toISOString() でシリアライズ
// - 「文字列カラム」注記のある日時風フィールドは DB上 varchar/text。Date に変換せずそのまま扱う
// - personal_events."end" は予約語。SQLでは必ずダブルクォートすること（§2.5）

export type CourseRow = {
  id: string;
  name: string;
  room: string;
  teacher: string;
  lms_course_id: string | null;
  lms_system_type: string | null;   // 'kanazawa_lms' | 'webclass' 想定だが制約なし
};

export type CourseDateRow = {
  id: string;
  course_id: string;                // FK courses.id ON DELETE CASCADE
  year: number;
  quarter: number;                  // 1-4
  day_of_week: string | null;       // '月'〜'日' の1文字。集中講義は null
  period: number;                   // 通常1-6。拡張importは0-8を許容（0=集中講義）
  is_intensive_lct: boolean;
};

export type EnrollmentRow = {
  id: string;
  course_id: string;                // FK courses.id ON DELETE CASCADE
  user_id: string;                  // UUID。FKなし（Supabase Authのユーザー）
};

export type ProfileRow = {
  user_id: string;                  // PK。Supabase Auth の sub
  display_name: string | null;
  is_admin: boolean;
  assignment_sync_mode: 'auto' | 'manual';
  created_at: Date;                 // timestamptz
  updated_at: Date;                 // timestamptz。DBトリガなし → UPDATE文で updated_at = now() を明示（§1.9-7）
};

export type TaskRow = {
  id: string;
  user_id: string;                  // UUID。FKなし
  title: string;
  description: string | null;
  type: 'todo' | 'assignment';
  source_type: string;              // 'manual' | 'lms' | 'ai' | 'calendar'
  source_provider: string;          // 'user' | 'kanazawa_lms' | 'webclass' | 'google_calendar'
  is_done: boolean;
  done_at: Date | null;             // timestamptz
  is_hidden: boolean;
  created_at: Date;                 // timestamptz
  updated_at: Date;                 // timestamptz。UPDATE時に now() を明示
  // ---- assignment専用フィールド（todoでは全てnull/デフォルト） ----
  course_name: string | null;
  lms_course_id: string | null;
  task_contents_id: string | null;  // レスポンスでは null → '' 変換（§1.9-5）
  source_url: string | null;
  kind: string | null;
  availability_start: string | null; // 文字列カラム（timestamptzではない）
  availability_end: string | null;   // 文字列カラム
  submitted_at: string | null;       // 文字列カラム
  result: string | null;             // レスポンスでは null → '' 変換
  score: string | null;              // 文字列カラム
  is_due_estimated: boolean;
  is_active_url: boolean;
  board_status: 'assignment' | 'todo' | 'done';
};

export type PersonalEventRow = {
  id: string;
  user_id: string;                  // UUID。FKなし
  title: string;
  start: string;                    // 文字列カラム。ISO文字列をそのまま格納・返却
  end: string | null;               // 文字列カラム。★SQLでは "end" とクォート必須
  all_day: boolean;
  color: string | null;
  location: string | null;
  description: string | null;
  created_at: Date;                 // timestamptz
};

export type UniversityEventRow = {
  id: string;
  year: number;
  name: string;
  type: string;                     // 'exam' | 'interval' | 'transfer' | 'other' | 'holiday'
  date: string;                     // 文字列カラム
  original_day: string;             // type='transfer' 以外は ''
};
```

**テーブル名の対応**（コード内で列挙定数にしてよい）: `courses` / `course_dates` / `enrollments` / `profiles` / `tasks` / `personal_events` / **`university_event`（単数形！）**

timestamptz → JSON のシリアライズヘルパ（レスポンス組み立てで共通利用）:

```ts
// src/lib/serialize.ts
export const toIso = (d: Date | null): string | null => (d ? d.toISOString() : null);
```

（FastAPIはマイクロ秒+`+00:00`、これはミリ秒+`Z` を出力する。両者の差はパリティテストの許容差分（§4.3-3）。出力形式を無理に揃えるコードを書かないこと。）

## 付録D: 認証テストハーネス完成品（T-04以降の全ルートテストで共用）

方針: **署名検証を実際に通す**。検証をスキップするスタブ・ミドルウェア差し替えは禁止（テストが形骸化するため）。`createRemoteJWKSet` は内部で `fetch` を使うので、JWKS URL への fetch だけを横取りして自前の公開鍵を返す。

```ts
// test/helpers/auth.ts
import { generateKeyPair, exportJWK, SignJWT, type JWK } from 'jose';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

let privateKey: CryptoKey;
let publicJwk: JWK;

/** テストスイート開始時に1回呼ぶ（beforeAll） */
export async function setupTestAuth(supabaseUrl: string) {
  const pair = await generateKeyPair('ES256', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };

  // JWKS URLへのfetchだけ横取りし、それ以外は素通し
  const realFetch = globalThis.fetch;
  const jwksPath = '/auth/v1/.well-known/jwks.json';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === `${supabaseUrl}${jwksPath}`) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(input as any, init);
  }) as typeof fetch;
}

type TokenOptions = {
  sub?: string | null;          // null で sub無しトークン（401ケース用）
  email?: string;
  fullName?: string | null;     // user_metadata.full_name
  isAdmin?: boolean;            // app_metadata.is_admin
  expiresIn?: string;           // 例 '1h'。'-1h' で期限切れトークン
};

/** 有効な（または意図的に不正な）Supabase風JWTを発行する */
export async function makeToken(opts: TokenOptions = {}): Promise<string> {
  const {
    sub = TEST_USER_ID, email = 'test@example.com',
    fullName = null, isAdmin = false, expiresIn = '1h',
  } = opts;
  const jwt = new SignJWT({
    email,
    user_metadata: fullName ? { full_name: fullName } : {},
    app_metadata: isAdmin ? { is_admin: true } : {},
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuedAt()
    .setExpirationTime(expiresIn);
  if (sub !== null) jwt.setSubject(sub);
  return jwt.sign(privateKey);
}

/** 署名不一致テスト用: JWKSに載っていない別鍵で署名したトークン */
export async function makeTokenWithWrongKey(): Promise<string> {
  const { privateKey: wrongKey } = await generateKeyPair('ES256');
  return new SignJWT({ email: 'evil@example.com' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' }) // kidは同じでも署名が合わない
    .setSubject(TEST_USER_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(wrongKey);
}

export { TEST_USER_ID };
```

使い方の骨子（vitest）:

```ts
// test/routes/me.test.ts の骨子
import { beforeAll, describe, expect, it } from 'vitest';
import { setupTestAuth, makeToken } from '../helpers/auth';
import app from '../../src/index';

const env = { SUPABASE_URL: 'https://test.supabase.co', /* HYPERDRIVE等はテスト用を注入 */ };

beforeAll(() => setupTestAuth(env.SUPABASE_URL));

describe('GET /api/me', () => {
  it('401 without token', async () => {
    const res = await app.request('/api/me', {}, env);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: 'Could not validate credentials' });
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
  });
  it('200 with valid token', async () => {
    const token = await makeToken();
    const res = await app.request('/api/me', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(200);
  });
});
```

**注意事項**:
- `src/middleware/auth.ts` の `jwks` はモジュールスコープキャッシュ（§2.4）なので、テストプロセス内で `SUPABASE_URL` を変えない（スイート全体で1つのURLと1つの鍵ペアを使い回す）。
- `expiresIn: '-1h'` で期限切れ401、`makeTokenWithWrongKey()` で署名不一致401、`sub: null` でsub欠落401、をT-04で必ずテストする。
- DBが要るルートのテストは、この認証ハーネス + ローカルPG（compose の `postgresql://app:app@localhost:5432/app`）の組み合わせで行う。
