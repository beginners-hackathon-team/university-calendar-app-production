# CLAUDE.md

- @AGENTS.mdを必ず参照すること（学習用プロジェクトとしての回答スタイルを含む）。
- デザインは @docs/DESIGN.md を参照すること。

# Development Environment

このプロジェクトは Docker 環境で動作する。

## Commands

すべてのコマンドは app コンテナ内で実行する。

```bash
docker compose -f compose.yml -f compose.override.yml exec app bash -c "<command>"
```

## 検証コマンド（コード変更後は必ず実行すること）

一括実行:

```bash
bash scripts/check.sh            # backend + frontend 全チェック
bash scripts/check.sh backend    # backendのみ
bash scripts/check.sh frontend   # frontendのみ
```

個別に実行する場合（appコンテナ内）:

| 対象 | コマンド（コンテナ内の作業ディレクトリ） |
|---|---|
| Backend lint | `cd backend && uvx ruff check .` |
| Backend test | `cd backend && uv run pytest` |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend 型チェック | `cd frontend && npm run typecheck` |
| Frontend test | `cd frontend && npm run test` |
| E2E（ホスト側で実行） | `bash scripts/e2e/run.sh` |

- CIと同一のチェック（`.github/workflows/ci.yml`）。ローカルで通ればCIも通る。
- 実機（ブラウザ）検証の手順は `.claude/skills/verify` を参照。

## 構成の要点

- `backend/` FastAPI + SQLAlchemy + Alembic。認証はSupabase JWT（`app/main.py` の `get_current_user`）
- `frontend/` React + TypeScript + FullCalendar。API通信は `authFetch` ラッパー経由
- DBスキーマ変更は Alembic マイグレーションで行う（`cd backend && uv run alembic revision --autogenerate`）
- ドキュメント: `docs/API.md` `docs/DATABASE.md` `docs/FRONTEND.md` `docs/DEPLOY.md` `docs/CICD.md` `docs/GIT.md`

## ハマりどころ

- ユニットテスト用DB `app_test` は `Base.metadata.create_all` 生成のため、カラム追加時はalembicが適用されない（`.claude/skills/verify` 参照）
- 開発サーバー起動中は E2E（ポート8000/5173）と競合する
