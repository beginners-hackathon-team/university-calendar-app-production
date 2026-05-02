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
| フロントエンド | TypeScript / React + Vite + React Router + FullCalendar |
| バックエンド | Python / FastAPI |
| 認証 | JWT (PyJWT) + bcrypt によるパスワードハッシュ化 |
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
│   │   ├── core/               # 設定（環境変数・JWT 設定）
│   │   ├── db/                 # データベース接続・シードスクリプト
│   │   ├── models/             # SQLAlchemy の Model 定義
│   │   ├── schemas/            # リクエスト・レスポンスの型定義（Pydantic）
│   │   ├── services/           # ビジネスロジック（授業日生成など）
│   │   ├── utils/              # ユーティリティ（UUID 生成・パスワード・JWT）
│   │   └── main.py             # アプリのエントリーポイント・全エンドポイント
│   ├── alembic.ini             # Alembic 設定ファイル
│   ├── uv.lock
│   └── pyproject.toml
│
├── frontend/                   # フロントエンド（TypeScript + Vite）
│   ├── public/                 # 静的ファイル（画像など）
│   ├── src/
│   │   ├── api/                # API クライアント（authFetch ラッパー含む）
│   │   ├── hooks/              # カスタムフック（useMe など）
│   │   ├── pages/              # 各ページのコンポーネント
│   │   ├── App.tsx             # ルーティング・認証ガード
│   │   ├── Layout.tsx          # 共通レイアウト（ヘッダー・ナビ）
│   │   ├── periodToTime.ts     # 時限と時刻の対応表
│   │   └── main.tsx            # エントリーポイント
│   ├── index.html              # HTML のエントリーポイント
│   └── package.json            # Node 依存パッケージの定義
│
├── docs/                       # 開発ドキュメント
├── scripts/                    # 開発用スクリプト
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
Dev Container（VS Code）で起動するか、Docker Compose 経由で起動。詳細は [docs/SETUP.md](docs/SETUP.md) を参照。

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

## 初期セットアップ

### 1. データベースマイグレーション
```bash
cd backend
uv run alembic upgrade head
```

### 2. 大学イベントの初期投入（年度別）
```bash
cd backend
uv run python -m app.db.seed_university_event ../frontend/src/Universityevent.json
```
> JSON は `{ "year": 2026, "events": [...] }` 形式。

### 3. 初期管理者ユーザーの作成
ユーザー登録 API でユーザーを作成後、SQL で `is_admin` を付与：

```bash
# ユーザー作成（Swagger UI から POST /api/user でも可）
curl -X POST http://localhost:8000/api/user \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","email":"admin@example.com","password":"<password>"}'

# 管理者に昇格
docker compose exec db psql -U app -d app -c \
  "UPDATE users SET is_admin = true WHERE email = 'admin@example.com';"
```

---

## 設計
[DESIGN.md](docs/DESIGN.md) を参照