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

- ユーザー登録（`POST /api/user`）
- ユーザーログイン / ログアウト（JWT 発行）
- 時間割登録（1〜4限、Q1〜Q4）
- 時間割の編集・削除
- カレンダー表示（月 / 週 / 日）
  - 時間割の自動展開（クォーター期間内の該当曜日に自動配置）
  - 祝日・大学イベントの表示
- 大学イベントの一覧表示（全ユーザー共通）
- **管理者** による大学イベント編集画面（追加・編集・削除）

### 1.3 未実装（将来拡張予定）

- 個人イベント（personal_events）の登録・編集
- ユーザー登録画面（現状は API 直叩きまたは Swagger UI 経由）
- Google アカウント連携・Gmail 連携
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
| ログイン画面 | `/login` | 不要 |
| カレンダー画面（メイン） | `/` | 要ログイン |
| 時間割画面 | `/courses` | 要ログイン |
| 大学イベント管理画面 | `/admin/events` | 要管理者 |

> ユーザー登録画面は未実装。現状は Swagger UI（`/docs`）または curl で `POST /api/user` を叩いて作成する。

### 2.2 画面遷移

```
[未ログイン]
    └─→ [ログイン]
            └─→ [カレンダー（メイン）]
                    ├─→ [時間割画面]
                    └─→ [大学イベント管理]（管理者のみ）
```

### 2.3 ナビゲーション

ヘッダー（[Layout.tsx](../frontend/src/Layout.tsx)）に以下を表示：

- カレンダー（全ユーザー）
- 時間割（全ユーザー）
- 大学イベント管理（**管理者のみ表示**、`useMe()` で判定）
- ログアウトボタン

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
users ─┬─< enrollments >─┬─ courses ─< course_dates
       │                 │
       └─（personal_events 未実装）

university_event（独立、ユーザーに紐づかない）
```

### 3.2 テーブル詳細

#### `users`（ユーザー情報）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| name | string | ログイン名（一意性制約は未設定） |
| email | string | |
| password_hash | string | bcrypt によるハッシュ |
| is_admin | boolean | 管理者フラグ。デフォルト false |

> 現状 `created_at` は持たない。将来必要なら追加。

#### `courses`（授業マスタ）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| name | string | 授業名 |
| room | string | 教室 |
| teacher | string | 教員名 |

> ユーザーへの紐付けは `enrollments` 経由。同一授業を複数ユーザーで共有可能な設計。

#### `course_dates`（授業の開講条件）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| course_id | FK → courses.id | CASCADE |
| year | int | 開講年度 |
| quarter | int | 1〜4 |
| day_of_week | string | "月"〜"日" |
| period | int | 時限 |

> このテーブルは「**いつ開講するか**」のメタ情報のみを持ち、実際の開催日（個別の日付）は API レスポンス時に [services/schedule.py](../backend/app/services/schedule.py) で計算する。詳細は §4 参照。

#### `enrollments`（履修登録）

| カラム | 型 | 備考 |
|---|---|---|
| id | string (UUID) | PK |
| course_id | FK → courses.id | CASCADE |
| user_id | FK → users.id | CASCADE |

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

> `date` を `MM-DD` 文字列にしているのは、年度を独立カラムにすることで JSON ファイル単位で年度ごとに管理しやすくするため。詳細は §8.4 参照。

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

**JWT (JSON Web Token) ベースのステートレス認証**。
- バックエンド：[FastAPI の OAuth2PasswordBearer](https://fastapi.tiangolo.com/tutorial/security/) を採用
- パスワードハッシュ：[bcrypt](https://github.com/pyca/bcrypt) を直接使用（`passlib` は使わない、§8.2 参照）
- トークン保存：フロントは **`localStorage`**

### 5.2 認証フロー

```
[1] ログイン
  Frontend → POST /api/login (form-data: username, password)
  Backend  → bcrypt.checkpw でパスワード検証
           → JWT 発行（payload: { sub: user.id, exp: 24h後 }）
  Frontend → access_token を localStorage に保存

[2] 認証付きリクエスト
  Frontend → authFetch ラッパーが Authorization: Bearer <token> を自動付与
  Backend  → get_current_user 依存関数で JWT を検証 → User を取得

[3] 401 時の挙動
  Frontend → authFetch が 401 を検知 → localStorage クリア → /login にリダイレクト
```

### 5.3 認可（管理者ロール）

- `users.is_admin` カラム（boolean）
- `get_admin_user` 依存関数で「ログイン済み」かつ「`is_admin=true`」を要求
- 最初の管理者は **SQL で `UPDATE users SET is_admin = true WHERE ...`** で昇格させる
- フロント側では `useMe()` フックで `is_admin` を取得し、管理者リンクの表示制御 + `<AdminRoute>` でルートガード

### 5.4 認可マトリクス

| エンドポイント | 認証 | 認可 |
|---|---|---|
| `POST /api/user` | 不要 | - |
| `POST /api/login` | 不要 | - |
| `GET /api/me` | 要 | - |
| `GET /api/courses/{year-quarter}` | 要 | 自分の履修のみ |
| `POST/PUT/DELETE /api/course[/{id}]` | 要 | 自分の履修のみ（PUT/DELETE）|
| `GET /api/calendar/{year-month}` | 要 | 自分の履修のみ |
| `GET /api/university-events/{year}` | 要 | 全ユーザー共通 |
| `POST/PUT/DELETE /api/university-events[/{id}]` | 要 | **管理者のみ** |
| `GET /api/users` | 要 | **管理者のみ** |
| `DELETE /api/courses` | 要 | **管理者のみ**（全削除）|
| `DELETE /api/user/{id}` | 要 | 本人 or 管理者 |

---

## 6. API設計

### 6.1 共通ルール

| 項目 | 値 |
|---|---|
| 認証方式 | JWT（`Authorization: Bearer <token>` ヘッダー） |
| エラー形式 | `{ "detail": "エラーメッセージ" }` |
| 日付形式（API 全般） | ISO 8601（`2026-04-01`） |
| 大学イベント `date` | `MM-DD`（例：`"04-01"`） |
| 認証エンドポイントの形式 | OAuth2 準拠の form-data |

### 6.2 認証

```
POST /api/user                ユーザー登録（認証不要）
  req: { name, email, password }
  res: 201 User オブジェクト

POST /api/login               ログイン（認証不要、form-data）
  req: username=...&password=...
  res: 200 { access_token, token_type: "bearer" }
  err: 401 認証失敗

GET  /api/me                  自分の情報（要認証）
  res: 200 { id, name, email, is_admin }
```

> ログアウトは **クライアント側で `localStorage` を削除するだけ**。サーバー側にトークン無効化機構はない（§8.3 参照）。

### 6.3 ユーザー（管理者向け）

```
GET    /api/users             一覧（管理者のみ。password_hash は除外）
  res:   200 [{ id, name, email, is_admin }]

GET    /api/user/{id}         詳細（要認証）
  res:   200 { id, name, email, is_admin }

DELETE /api/user/{id}         削除（本人 or 管理者）
  res:   204
```

### 6.4 時間割（courses）

```
GET    /api/courses/{year-quarter}    自分の時間割一覧（年度-クォーター指定）
  例:   /api/courses/2026-1
  res:  200 [{ id, name, room, teacher, year, quarter, day_of_week, period }]

POST   /api/course                    追加（同時に course_date と enrollment も作成）
  req:  { name, room, teacher, year, quarter, day_of_week, period }
  res:  200

PUT    /api/course/{id}               編集
  req:  { name, room, teacher }
  res:  200 { id, name, room, teacher }

DELETE /api/course/{id}               削除（自分の履修のみ）
  res:  204

DELETE /api/courses                   全削除（管理者のみ）
  res:  204
```

### 6.5 カレンダー（集約）

```
GET /api/calendar/{year-month}        指定月の自分の時間割
  例:   /api/calendar/2026-4
  res:  200 [{ id, name, room, teacher, dates: ["2026-04-15", ...], period }]
```

> 大学イベント・祝日はフロント側で別途取得して合成する。バックエンドの集約は時間割のみ。

### 6.6 大学イベント

```
GET    /api/university-events/{year}      指定年度の一覧（要認証）
  res:  200 [{ id, name, type, date, original_day }]

POST   /api/university-events             追加（管理者のみ）
  req:  { year, name, type, date, original_day }
  res:  200 created event

PUT    /api/university-events/{id}        編集（管理者のみ）
  req:  { year, name, type, date, original_day }
  res:  200 updated event

DELETE /api/university-events/{id}        削除（管理者のみ）
  res:  204
```

### 6.7 シード（バッチ処理、API ではない）

CLI スクリプト [`backend/app/db/seed_university_event.py`](../backend/app/db/seed_university_event.py) で年度別 JSON を一括投入。
同年度の既存データを削除してから再投入する **冪等処理**。

```bash
cd backend
uv run python -m app.db.seed_university_event ../frontend/src/Universityevent_2026.json
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
│   ├── auth.ts           # ログイン・ログアウト・トークン管理
│   ├── client.ts         # authFetch ラッパー（Bearer 自動付与）
│   ├── courses.ts        # 時間割 CRUD
│   ├── calendar.ts       # カレンダー集約
│   └── universityEvents.ts # 大学イベント CRUD
├── hooks/
│   └── useMe.ts          # 自分の情報を取得するカスタムフック
└── pages/
    ├── LoginPage.tsx
    ├── CalendarPage.tsx
    ├── CoursesPage.tsx
    └── AdminEventsPage.tsx
```

### 7.2 認証ガード（ルート保護）

[App.tsx](../frontend/src/App.tsx) で 2 段階のガード：

```
<PrivateRoute>           ← ログイン必須（isAuthenticated() で判定）
  └─ <Layout>
      ├─ <CalendarPage />
      ├─ <CoursesPage />
      └─ <AdminRoute>    ← 管理者必須（useMe() で判定）
          └─ <AdminEventsPage />
```

### 7.3 通信ラッパー

`api/client.ts` の `authFetch` は通常の `fetch` をラップして:
- localStorage からトークンを取得して `Authorization: Bearer ...` を自動付与
- レスポンスが 401 なら自動ログアウト + `/login` にリダイレクト

すべての保護エンドポイントは `authFetch` 経由で叩く。

---

## 8. 設計判断メモ

実装中に行った主要な設計判断と、その根拠を記録する。

### 8.1 認証方式に JWT を採用した理由

- **セッション Cookie 方式** と比較して、サーバーがセッションストアを持つ必要がなく、ステートレスにできる
- FastAPI の `OAuth2PasswordBearer` で標準的に扱える（Swagger UI と相性◎）
- ハッカソン規模では複雑なセッション管理が不要

**トレードオフ:**
- ログアウト時にサーバー側でトークン無効化できない（クライアントが捨てるだけ）
- 短い有効期限（24h）にして緩和

### 8.2 パスワードハッシュに bcrypt を直接使う

`passlib` は長期間メンテナンスが滞っており、新しい `bcrypt>=4.1` と互換性問題（`__about__` 属性エラー、72 バイト制限の例外など）が発生する。
[utils/password.py](../backend/app/utils/password.py) で `bcrypt` ライブラリを直接呼ぶ実装に統一。

### 8.3 トークン保存先に `localStorage` を採用

- 実装が単純（Cookie のドメイン設定や CSRF 対策が不要）

**トレードオフ:**
- XSS 攻撃でトークン窃取される可能性あり
- 本番環境ではトークン保存場所を要検討（HttpOnly Cookie, in-memoryなど）

### 8.4 `university_event.date` を `"MM-DD"` 文字列で持つ

- 大学イベントは年度ごとに使い回しを想定（年は別カラム `year` で持つ）
- JSON ファイル単位で年度別管理（`Universityevent_2026.json` のように）

**トレードオフ:**
- DB レベルでの日付演算ができない
- 年またぎの集計などが発生したらリファクタが必要

### 8.5 授業開催日を DB に持たず実行時計算

`course_dates` テーブルには「年度・クォーター・曜日・時限」のメタ情報のみを持ち、実際の日付列は `services/schedule.py` で計算。

**理由:**
- 実装が単純
- 振替日・休日に応じた補正をフロント側で柔軟にやりたい

**トレードオフ:**
- パフォーマンス的にはオンザフライ計算で毎回再計算
- 大学イベントの「振替」「休日」反映ロジックがバックエンドに無いので、現状は時間割と大学イベントが独立

### 8.6 管理者ロールに `is_admin` boolean 1 つ

- ロール体系は将来必要なら拡張（`role: enum` 化）
- 最初の管理者は SQL で手動昇格
  - 自動的に「最初に登録したユーザーを管理者にする」もあり

### 8.7 `course` ↔ `user` を `enrollments` 経由（多対多）

- 直接 `Course.user_id` にせず、`Enrollment` テーブルを噛ませた
- 同一講義を複数ユーザーで共有する将来拡張に備える
- 現状は実質「1ユーザー1履修」だが、構造は変えていない

### 8.8 fetch ラッパー `authFetch` で認証ヘッダ付与を一元化

- 各 API 関数で `Authorization` ヘッダを書くのは DRY 違反
- 401 時の自動リダイレクトも一箇所にまとめられる

### 8.9 ルート保護を 2 段階に（`PrivateRoute` / `AdminRoute`）

- 「ログイン必須」と「管理者必須」を別コンポーネントに分離
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
- ユーザー登録画面の追加
- 管理画面の UI 改善（テーブル整形、フォームバリデーション）
- 大学イベントの **休日反映** をカレンダー側で実装（`type='holiday'` を時間割から除外）
- 大学イベントの **振替反映**（`type='transfer'` の日に対応曜日の授業を表示）
- ログアウト時のメッセージ表示
- 個人イベント（personal_events）テーブルと CRUD の追加

### 中期
- クォーター期間を DB の `quarters` テーブルに切り出し
- 認証トークン保存場所の変更
- ユーザー名の一意性制約追加
- メール認証によるパスワードリセット
- レスポンシブ対応の強化

### 長期
- 複数大学対応（`universities` テーブル、`users.university_id`）
- 通知機能（授業開始前リマインド）
- Google カレンダー連携
