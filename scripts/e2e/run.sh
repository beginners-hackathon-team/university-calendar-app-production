#!/bin/bash
# E2Eハーネス実行スクリプト
#
# .claude/skills/verify/SKILL.md にあった手動の実機検証手順
# （Docker起動 → 認証バイパス版バックエンド起動 → Playwrightでブラウザ確認 → 後始末）
# をコード化し、コマンド一つで実行・再現できるようにしたもの。
#
# 使い方:
#   bash scripts/e2e/run.sh
#
# 初回のみ必要な準備（ホスト側）:
#   cd frontend && npm install && npx playwright install --with-deps chromium
#
# 注意:
#   - backend/app/e2e_server.py（ポート8000）と vite dev server（ポート5173）を使う。
#     通常の開発サーバーが起動中だとポートが競合するので、実行前に止めておくこと。
#   - Playwright自体はこのスクリプトを実行するホスト側で動く
#     （Docker内で完結させたい場合は要拡張）。

set -euo pipefail
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f compose.yml -f compose.override.yml"
BACKEND_PID_FILE=/tmp/e2e_backend.pid
FRONTEND_PID_FILE=/tmp/e2e_frontend.pid

cleanup() {
  echo "==> 後始末: プロセス停止とE2Eテストデータの削除..."
  $COMPOSE exec -T app bash -c "
    if [ -f ${FRONTEND_PID_FILE} ]; then kill \$(cat ${FRONTEND_PID_FILE}) 2>/dev/null || true; rm -f ${FRONTEND_PID_FILE}; fi
    if [ -f ${BACKEND_PID_FILE} ]; then kill \$(cat ${BACKEND_PID_FILE}) 2>/dev/null || true; rm -f ${BACKEND_PID_FILE}; fi
  " || true
  $COMPOSE exec -T app bash -c "cd backend && uv run python -m app.db.cleanup_e2e_data" || true
}
trap cleanup EXIT

echo "==> Dockerコンテナ起動..."
$COMPOSE up -d

echo "==> マイグレーション適用..."
$COMPOSE exec -T app bash -c "cd backend && uv run alembic upgrade head"

echo "==> バックエンド(認証バイパス版 e2e_server.py)を起動..."
$COMPOSE exec -T app bash -c "
  cd backend
  nohup uv run uvicorn app.e2e_server:app --host 0.0.0.0 --port 8000 > /tmp/e2e_backend.log 2>&1 &
  echo \$! > ${BACKEND_PID_FILE}
"

echo "==> フロントエンド(vite dev server)を起動..."
$COMPOSE exec -T app bash -c "
  cd frontend
  nohup npx vite --host --port 5173 > /tmp/e2e_frontend.log 2>&1 &
  echo \$! > ${FRONTEND_PID_FILE}
"

echo "==> 起動待ち..."
for i in $(seq 1 30); do
  curl -sf http://localhost:8000/api/health > /dev/null 2>&1 && break
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "!! バックエンドが起動しませんでした。ログ: docker compose exec app cat /tmp/e2e_backend.log" >&2
    exit 1
  fi
done
for i in $(seq 1 30); do
  curl -sf http://localhost:5173 > /dev/null 2>&1 && break
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "!! フロントエンドが起動しませんでした。ログ: docker compose exec app cat /tmp/e2e_frontend.log" >&2
    exit 1
  fi
done

echo "==> Playwrightテスト実行..."
cd frontend
npx playwright test
