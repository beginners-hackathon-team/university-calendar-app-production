# マルチステージビルド
# フロントエンドビルド
FROM node:22-slim AS frontend

WORKDIR /app

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./

# Render が --build-arg として渡す環境変数を受け取る
# VITE_* はビルド時に JS バンドルへ静的に埋め込まれるため、ここで宣言が必要
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build
# → /backend/static/ に出力される

# バックエンド
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /workspace

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv sync --no-dev --frozen --no-install-project

COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY backend/data ./data
COPY --from=frontend /backend/static ./static

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
