import re

import pytest
from sqlalchemy import event

from app.core.perf import _after_cursor_execute, _before_cursor_execute


@pytest.fixture()
def counted_engine(engine):
    # アプリ本体のengineにはmain.pyでリスナーが付いているが、
    # テストは別のengine（app_test）を使うため、ここで付け外しする
    event.listen(engine, "before_cursor_execute", _before_cursor_execute)
    event.listen(engine, "after_cursor_execute", _after_cursor_execute)
    yield engine
    event.remove(engine, "before_cursor_execute", _before_cursor_execute)
    event.remove(engine, "after_cursor_execute", _after_cursor_execute)


def _db_query_count(server_timing: str) -> int:
    match = re.search(r'db;desc="(\d+) queries"', server_timing)
    assert match, server_timing
    return int(match.group(1))


def test_server_timing_header_counts_queries(counted_engine, client):
    res = client.get("/api/me")
    assert res.status_code == 200

    server_timing = res.headers["Server-Timing"]
    assert _db_query_count(server_timing) >= 1
    assert re.search(r"app;dur=[\d.]+", server_timing)
    assert re.search(r"total;dur=[\d.]+", server_timing)


def test_server_timing_header_is_zero_queries_without_db(counted_engine, client):
    res = client.get("/api/health")
    assert _db_query_count(res.headers["Server-Timing"]) == 0


def test_perf_log_escapes_control_characters_in_path(client, caplog):
    with caplog.at_level("INFO", logger="uvicorn.error"):
        client.get("/api/%1b%5b2J")

    perf_logs = [r.getMessage() for r in caplog.records if r.getMessage().startswith("perf ")]
    assert perf_logs
    assert "\x1b" not in perf_logs[-1]
    assert "path=/api/\\x1b[2J" in perf_logs[-1]
