#!/bin/bash
# CI相当のチェックをローカルで一括実行するスクリプト（ホスト側で実行）
#
# .github/workflows/ci.yml と同じチェックを app コンテナ内で走らせる。
# ここが通ればCIも通る＝pushする前の自己検証用。
#
# 使い方:
#   bash scripts/check.sh            # 全部
#   bash scripts/check.sh backend    # backendのみ (ruff + pytest)
#   bash scripts/check.sh frontend   # frontendのみ (eslint + tsc + vitest)

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f compose.yml -f compose.override.yml"
TARGET="${1:-all}"

run_backend() {
  echo "==> Backend: ruff check"
  $COMPOSE exec -T app bash -c "cd backend && uvx ruff check ."
  echo "==> Backend: pytest"
  $COMPOSE exec -T app bash -c "cd backend && uv run pytest"
}

run_frontend() {
  echo "==> Frontend: eslint"
  $COMPOSE exec -T app bash -c "cd frontend && npm run lint"
  echo "==> Frontend: tsc --noEmit"
  $COMPOSE exec -T app bash -c "cd frontend && npm run typecheck"
  echo "==> Frontend: vitest"
  $COMPOSE exec -T app bash -c "cd frontend && npm run test"
}

case "$TARGET" in
  backend)  run_backend ;;
  frontend) run_frontend ;;
  all)      run_backend && run_frontend ;;
  *)
    echo "usage: bash scripts/check.sh [backend|frontend]" >&2
    exit 1
    ;;
esac

echo ""
echo "✅ すべてのチェックが通りました（CIと同一の内容です）"
