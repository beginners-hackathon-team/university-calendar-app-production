# アプリ名

大学特化型カレンダー（時間割登録付き）

---
## ユーザーストーリー
- 既存のカレンダーアプリだと大学の学年暦がわからないので、個人の予定と大学の予定の把握がめんどくさい
- 時間割登録アプリ と カレンダーアプリ を統合することで、大学生のスケジュール管理を一括に

---
## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | TypeScript / React + Vite + React Router + FullCalendar + Tailwind CSS |
| バックエンド | Python / FastAPI |
| 認証 | [Supabase Auth](https://supabase.com/auth)（JWT。バックエンドはJWKSでトークンを検証） |
| データベース | PostgreSQL / SQLAlchemy / Alembic |
| デプロイ | Render |

---


## ディレクトリ構造

```
.
├── backend/                    # バックエンド（FastAPI）
│   ├── alembic/                # マイグレーション関連
│   │   ├── versions/           # マイグレーションファイル
│   │   ├── env.py              # Alembic 起動スクリプト
│   │   └── script.py.mako      # マイグレーションテンプレート
│   ├── app/
│   │   ├── core/               # 設定（環境変数）
│   │   ├── db/                 # データベース接続・シードスクリプト
│   │   ├── models/              # SQLAlchemy の Model 定義
│   │   ├── schemas/              # リクエスト・レスポンスの型定義（Pydantic）
│   │   ├── services/              # ビジネスロジック（授業日生成など）
│   │   ├── utils/                  # ユーティリティ（UUID生成など）
│   │   └── main.py                # アプリのエントリーポイント・全エンドポイント
│   ├── alembic.ini             # Alembic 設定ファイル
│   ├── uv.lock
│   └── pyproject.toml
│
├── frontend/                   # フロントエンド（React + TypeScript + Vite）
│   ├── public/                 # 静的ファイル（画像など）
│   ├── src/
│   │   ├── api/                 # API クライアント（authFetch ラッパー含む）
│   │   ├── hooks/                # カスタムフック（useMe など）
│   │   ├── lib/                   # Supabaseクライアント・共通ロジック
│   │   ├── components/             # 再利用コンポーネント
│   │   ├── pages/                   # 各ページのコンポーネント
│   │   ├── App.tsx                  # ルーティング・認証ガード
│   │   ├── Layout.tsx                # 共通レイアウト（ヘッダー・ナビ）
│   │   ├── periodToTime.ts            # 時限と時刻の対応表
│   │   └── main.tsx                    # エントリーポイント
│   ├── index.html              # HTML のエントリーポイント
│   └── package.json            # Node 依存パッケージの定義
│
├── extension/                   # Chrome拡張機能（大学ポータル/LMS連携）
├── docs/                        # 開発ドキュメント
├── scripts/                     # 開発用スクリプト
│   └── dev/
│       ├── start-backend.sh    # バックエンド起動
│       └── start-frontend.sh   # フロントエンド起動
├── docker/                     # Docker 設定
├── compose.yml                 # Docker Compose 設定
└── .devcontainer/              # Dev Container 設定
```


---

## 起動方法

### 開発環境の前提
Dev Container（VS Code）で起動するか、Docker Compose 経由で起動。初回セットアップの詳細は [docs/SETUP.md](docs/SETUP.md) を参照。

### バックエンド
```bash
bash scripts/dev/start-backend.sh
# → http://localhost:8000  (Swagger UI: http://localhost:8000/docs)
```

### フロントエンド
```bash
bash scripts/dev/start-frontend.sh
# → http://localhost:5173
```

---

## 初期セットアップ（要点）

詳細な手順（環境変数の設定含む）は [docs/SETUP.md](docs/SETUP.md) を参照。

### 1. データベースマイグレーション
```bash
cd backend
uv run alembic upgrade head
```

### 2. 大学イベントの初期投入（年度別）
```bash
cd backend
uv run python -m app.db.seed_university_event data/universityevent_2026.json
```
> JSON は `{ "year": 2026, "events": [...] }` 形式。`backend/data/` 配下に年度別ファイルを置く。
> 本番環境（Render）でも同じスクリプトを Shell から実行（パスは `data/universityevent_2026.json`）。

### 3. 初期管理者ユーザーの作成
ユーザー登録は Supabase Auth 経由（フロントの `/register`、またはSupabaseダッシュボード）で行う。登録後、Supabaseの SQL Editor で `app_metadata` に `is_admin: true` を設定して昇格させる：

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
where email = 'admin@example.com';
```

詳細は [docs/DEPLOY.md](docs/DEPLOY.md) を参照。

---

## API

エンドポイント一覧は [docs/API.md](docs/API.md) を参照。

## 設計
[docs/DESIGN.md](docs/DESIGN.md) を参照
