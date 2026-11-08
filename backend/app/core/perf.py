# リクエストごとの処理時間とSQL実行回数・時間を計測する。
# 結果は Server-Timing ヘッダー（DevToolsのTimingタブで見える）とログに出す。
#
# 仕組み:
# - ミドルウェアがリクエスト開始時に RequestStats を ContextVar に入れる
# - SQLAlchemy のイベントで、SQL実行のたびにその RequestStats に回数と時間を足す
# - 同期エンドポイントは別スレッドで動くが、ContextVar はスレッドにコピーされる。
#   中身の RequestStats は同じオブジェクトなので、スレッド側で足した値がミドルウェアから見える

import logging
import time
from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import FastAPI, Request
from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger("uvicorn.error")


@dataclass
class RequestStats:
    db_count: int = 0
    db_ms: float = 0.0


_current_stats: ContextVar[RequestStats | None] = ContextVar(
    "perf_request_stats", default=None
)


# 1つの接続ではSQLは1つずつ順番に実行されるので、開始時刻は1つ持てば足りる。
# SQLが失敗して after が呼ばれなくても、次の before で上書きされるので溜まらない。
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info["perf_query_start"] = time.perf_counter()


def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    started = conn.info.pop("perf_query_start", None)
    stats = _current_stats.get()
    if stats is None or started is None:
        return  # リクエスト外（シードスクリプト等）のSQLは数えない
    stats.db_count += 1
    stats.db_ms += (time.perf_counter() - started) * 1000


def install_query_listeners(engine: Engine) -> None:
    event.listen(engine, "before_cursor_execute", _before_cursor_execute)
    event.listen(engine, "after_cursor_execute", _after_cursor_execute)


def install_timing_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def timing_middleware(request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        stats = RequestStats()
        token = _current_stats.set(stats)
        started = time.perf_counter()
        status = 500  # 例外で抜けた場合はこのまま500として記録する
        try:
            response = await call_next(request)
            status = response.status_code
        finally:
            _current_stats.reset(token)
            total_ms = (time.perf_counter() - started) * 1000
            # 例外で抜けた場合も、遅い失敗を調べられるようにログは必ず出す
            logger.info(
                "perf method=%s path=%s status=%d total_ms=%.1f db_ms=%.1f db_count=%d",
                request.method,
                # パスに制御文字（例: %1b → ESC）が含まれてもログ表示を壊さないようにする
                request.url.path.encode("unicode_escape").decode("ascii"),
                status,
                total_ms,
                stats.db_ms,
                stats.db_count,
            )

        response.headers["Server-Timing"] = ", ".join(
            [
                f'db;desc="{stats.db_count} queries";dur={stats.db_ms:.1f}',
                f"app;dur={total_ms - stats.db_ms:.1f}",
                f"total;dur={total_ms:.1f}",
            ]
        )
        return response
