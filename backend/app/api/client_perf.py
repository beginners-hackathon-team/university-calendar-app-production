# フロントで測った「ページを開いてからデータが表示されるまで」の時間を受け取り、ログに出す。
# サーバー側の perf ログ（app/core/perf.py）と同じ Render のログで、体感時間を並べて見るためのもの。

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, get_current_user

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


class ClientPerfPayload(BaseModel):
    page: Literal["courses", "tasks"]
    total_ms: float = Field(ge=0, le=600_000)  # ページを開いてからデータが表示されるまで
    api_count: int = Field(ge=0, le=1000)  # その間に呼んだ /api/ の数
    api_wall_ms: float = Field(ge=0, le=600_000)  # 最初のAPI開始〜最後のAPI終了
    server_ms: float = Field(ge=0, le=600_000)  # Server-Timing の total の合計（サーバー内の時間）
    apis: list[str] = Field(default_factory=list, max_length=50)  # 呼んだAPIのパス


@router.post("/api/perf/client", status_code=204)
def report_client_perf(
    payload: ClientPerfPayload,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    # パスは表示用に制御文字をエスケープし、長さも切り詰める
    apis = ",".join(
        p[:80].encode("unicode_escape").decode("ascii") for p in payload.apis
    )
    logger.info(
        "perf-client page=%s total_ms=%.1f api_count=%d api_wall_ms=%.1f server_ms=%.1f apis=%s",
        payload.page,
        payload.total_ms,
        payload.api_count,
        payload.api_wall_ms,
        payload.server_ms,
        apis,
    )
