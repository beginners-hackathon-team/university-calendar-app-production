# 初回セットアップ
Macは多少異なるかも

## 主なディレクトリ構造

[README.md](/README.md)を参照

> 実際にコードを書くのは `backend/app/` と `frontend/src/` の中が中心になる。

---
### 必要なもの

以下を事前にインストールしておく。

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Visual Studio Code](https://code.visualstudio.com/)
（Antigravityなどでも可）
- VSCode 拡張機能: [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Supabase](https://supabase.com/) プロジェクト（認証基盤。無料プランで可）

### 手順

**1. リポジトリをクローンする**

```bash
git clone https://github.com/{組織名}/{リポジトリ名}.git
cd {リポジトリ名}
```

**2. ファイルをコピーする**

```bash
cp compose.override.yml.example compose.override.yml
```

`compose.override.yml` は個人設定用（`.gitignore`済み）。

続いて、バックエンド用の `.env` をルートに作成する：

```bash
cp .env.example .env
```

`.env` の中身（`SUPABASE_URL` は各自のSupabaseプロジェクトのものに書き換える）：

```bash
DATABASE_URL=postgresql+psycopg://app:app@db:5432/app
SUPABASE_URL=https://<your-project>.supabase.co
CORS_ORIGINS=http://localhost:5173
APP_URL=http://localhost:5173
```

- `DATABASE_URL`: Dev Container内では上記の値で固定（`db`はcompose内のPostgresサービス名）
- `SUPABASE_URL`: SupabaseプロジェクトのURL。JWT検証（JWKS取得）に使う
- `CORS_ORIGINS`: フロントのオリジンをカンマ区切りで（開発時は`http://localhost:5173`のみでOK）
- `APP_URL`: プライバシーポリシーページなどで表示するアプリの公開URL

フロントエンド用の環境変数もコピーする：

```bash
cd frontend
cp .env.example .env.development
```

`frontend/.env.development` の中身：

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabaseのanon key>
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_EXTENSION_STORE_URL=（任意。Chrome拡張機能のストアURL）
```

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` はSupabaseダッシュボードの Project Settings → API から取得する。

**3. Docker Desktop を起動する**

タスクバー（またはアプリ一覧）から Docker Desktop を起動し、クジラのアイコンが表示されるまで待つ。
WSLを使う場合は別途設定が必要

**4. VSCode でフォルダを開く**

```bash
code .
```

または VSCode の「ファイル → フォルダを開く」でクローンしたフォルダを選択する。

**5. Dev Container で開く**

VSCode の右下に通知が表示されたら「コンテナーで再度開く」をクリックする。

通知が出ない場合はコマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）を開き、以下を実行する。

```
Dev Containers: Reopen in Container
```

初回は以下が自動で実行されるため、数分かかる。完了するまでそのまま待つ。

- Docker イメージのビルド
- Python 依存パッケージのインストール（`uv sync`）
- Node 依存パッケージのインストール（`npm install`）

> 手動でのビルドコマンドは不要。

**6. データベースのセットアップ**

DB コンテナは Dev Container で自動起動するが、**テーブルは自分で作成する必要がある**。
コンテナ内のターミナルで以下を実行する。

```bash
cd backend
uv run alembic upgrade head
```

これでマイグレーション（Git で共有されている DB スキーマ履歴）がローカル DB に反映される。

確認：

```bash
docker compose exec db psql -U app -d app -c "\dt"
```

`profiles`, `courses`, `course_dates`, `enrollments`, `university_event`, `tasks`, `personal_events`, `alembic_version` などのテーブルが表示されればOK（詳細は [DATABASE.md](./DATABASE.md) を参照）。

**7. 大学イベントの初期データ投入**

```bash
cd backend
uv run python -m app.db.seed_university_event data/universityevent_2026.json
```

年度別のJSONファイルを `backend/data/` 配下に配置して投入する。詳細は [README.md](/README.md) を参照。

**8. 管理者ユーザーの設定**

Supabase Auth でユーザー登録（フロントの `/register` から、またはSupabaseダッシュボードから）した後、そのユーザーを管理者にする場合はSupabaseの `raw_app_meta_data` に `is_admin: true` を設定する（詳細は [DEPLOY.md](./DEPLOY.md) を参照）。

**9. 動作確認**

コンテナが起動したら、VSCode のターミナルを2つ開いて以下を実行する。

ターミナル1（バックエンド）:
```bash
bash scripts/dev/start-backend.sh
```

ターミナル2（フロントエンド）:
```bash
bash scripts/dev/start-frontend.sh
```

ブラウザで http://localhost:5173 を開き、画面が表示されれば完了。

---
