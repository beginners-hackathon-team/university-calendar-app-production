from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    calendar,
    courses,
    extension,
    me,
    personal_events,
    privacy,
    tasks,
    university_events,
)
from app.core.config import settings

app = FastAPI()

# settings.cors_origins はカンマ区切り文字列（例: "https://example.com,http://localhost:5173"）
_cors_origins: list[str] = [
    o.strip() for o in settings.cors_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(me.router)
app.include_router(courses.router)
app.include_router(calendar.router)
app.include_router(university_events.router)
app.include_router(extension.router)
app.include_router(tasks.router)
app.include_router(personal_events.router)
app.include_router(privacy.router)


# 静的ファイル配信（本番のみ）
STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():

    class ImmutableStaticFiles(StaticFiles):
        # ファイル名にハッシュが入っているため長期キャッシュして問題ない
        def file_response(self, *args, **kwargs):
            response = super().file_response(*args, **kwargs)
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

    app.mount(
        "/assets",
        ImmutableStaticFiles(directory=STATIC_DIR / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        index = STATIC_DIR / "index.html"
        if index.exists():
            # index.html は assets への参照を持つため毎回必ずネットワークから取得させる。
            # no-cache では back-forward cache (bfcache) 対象から外れないため、
            # 拡張機能の chrome.tabs.update で使い回されるタブが古いページを
            # bfcacheから復元してしまう余地が残る。no-store で確実に防ぐ。
            return FileResponse(index, headers={"Cache-Control": "no-store"})
        raise HTTPException(status_code=404)
