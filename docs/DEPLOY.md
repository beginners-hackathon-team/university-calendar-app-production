# デプロイ手順メモ

## 前提
- Renderにデプロイ済み
- リモートリポジトリの`main`ブランチへのプッシュでデプロイ（`develop`→`main`へのマージ。ブランチ運用は[GIT.md](./GIT.md)参照）
- 認証基盤は Supabase Auth（JWT検証はバックエンドがSupabaseのJWKSエンドポイントを直接参照する。自前のシークレット共有は不要）

### 単一コンテナ
- フロントのビルド出力（静的ファイル）をバックエンドの `static/` に入れて、バックエンドのみコンテナ起動（[docker/prod/Dockerfile](../docker/prod/Dockerfile) 参照）
### 別々デプロイと比較
| 観点 | 単一コンテナ | 別々デプロイ|
|----|----|----|
| Renderサービス数 | 1個 | 2個 |
| CORS設定 | 不要 | 必要 |
| 環境変数管理 | 1か所 | 2か所 |
| フロント単独再デプロイ | 不可（全体リビルド）| 可（高速なCDN反映）|
| ビルド時間 | やや長い | 短い |
| フロント配信速度 | サーバー経由 | CDN(高速) |

- CORSのデバッグなどがいらない
- URL管理が楽（フロントは/api/...のみ本番URLを意識しなくていい）
- 本番運用でフロントの変更が頻繁なら別々がいい
- UXを意識するなら別々（配信速度から）

### 小規模で短期間なら単一コンテナが楽

---
## 初回Renderセットアップ（1度だけ）

### 1. Supabaseプロジェクトの準備
- 本番用のSupabaseプロジェクトを作成（開発用と分けるのが望ましい）
- Authentication → Providers でメール認証・Google OAuthなど必要なプロバイダを有効化
- Project Settings → API から `Project URL` と `anon key` を控えておく

### 2. PostgreSQL作成（アプリのデータ用。Supabase自体のDBではない）
- Render → New → PostgreSQL
- Plan: Free, Version: 16
- Region: Singapore or Oregon（Web Serviceと揃える）
- 作成後、Internal Database URL をメモ

### 3. DATABASE_URL の driver 指定に書き換え
Renderが発行する URL は driver 指定が無いので、pydantic向けに置換が必要:
```
postgresql://xxx:yyy@host/db
↓
postgresql+psycopg://xxx:yyy@host/db
```

### 4. Web Service作成
- Render → New → Web Service
- リポジトリ選択 → Branch: `main`
- Runtime: **Docker**
- Dockerfile Path: `docker/prod/Dockerfile`
- Build Context: `.`
- Region: **DBと同じ**（Internal URL使用のため必須）
- Plan: Free

### 5. ビルド時環境変数（Docker Build Args）を設定
フロントのビルドに埋め込む値。Render の Web Service → Settings → **Environment** → **Build Args** に設定する（`docker/prod/Dockerfile` の `ARG` 宣言に対応）。

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | SupabaseのProject URL |
| `VITE_SUPABASE_ANON_KEY` | Supabaseのanon key |
| `VITE_EXTENSION_STORE_URL` | Chrome拡張機能のストアURL（任意） |

### 6. 実行時環境変数を設定
Web Service → Settings → **Environment Variables**。

| Key | Value |
|---|---|
| `DATABASE_URL` | 手順3で書き換えた Internal URL |
| `SUPABASE_URL` | SupabaseのProject URL |
| `CORS_ORIGINS` | 空欄（単一コンテナ・同一オリジンなので不要） |
| `APP_URL` | 本番の公開URL（例: `https://<service-name>.onrender.com`） |

### 7. Auto-Deploy 確認
Settings → Build & Deploy → Auto-Deploy: **`After CI Checks Pass`**, Branch: `main`
→ 以降 `main` への push で、GitHub ActionsのCIが全て通った場合のみ自動再デプロイ
（CIが落ちたコミットは本番に出ない。詳細は [CICD.md](./CICD.md) 参照）

### 8. デプロイ確認
- `https://<service-name>.onrender.com/` でフロントが表示
- `/api/health` で `{"status":"ok"}`
- 初回ビルドは 5〜10分

### 9. 初回データ投入（1度だけ）

DBが空なので、初期データを投入する。Render Web Service の **Shell** タブから実行：

```bash
# 大学イベントを投入
uv run python -m app.db.seed_university_event data/universityevent_2026.json
```

### 10. 初期管理者ユーザーの設定

1. 本番URLの `/register`（またはSupabaseダッシュボードのAuthentication → Users → Add user）でユーザーを作成する
2. SupabaseのSQL Editorで `app_metadata` に `is_admin: true` を追加して昇格させる

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
where email = 'admin@example.com';
```

> バックエンドは JWT の `app_metadata.is_admin` を見て管理者判定するため（`backend/app/main.py` の `get_current_user`）、`profiles.is_admin` カラムではなくSupabase側の値を変更する必要がある。

---

## 通常のデプロイ手順

### 1. developの最新を取り込む

```bash
git switch develop
git pull origin develop
```

### 2. ローカルで動作確認（必要な場合）

```bash
docker build -f docker/prod/Dockerfile -t calendar-app:prod \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  .

docker run --rm -p 8001:8000 \
  --network $(basename $PWD | tr '[:upper:]' '[:lower:]')_default \
  -e DATABASE_URL=postgresql+psycopg://app:app@db:5432/app \
  -e SUPABASE_URL=... \
  -e APP_URL=http://localhost:8001 \
  calendar-app:prod
```
localhost:8001 にアクセスし動作確認

### 3. 変更をコミット・プッシュ

```bash
git add path/to/file
git commit -m "comment"
git push origin develop
```
→ 動作確認

### 4. PRを作成してマージ

リモートの `develop` → `main` へのPRをマージする。

### 5. Renderのデプロイを確認

CI（GitHub Actions）が全て通ると Render が自動デプロイを開始する。
Render のダッシュボードでビルドログ・デプロイ完了を確認する。
CIが失敗した場合はデプロイされないので、修正して再度マージする。
