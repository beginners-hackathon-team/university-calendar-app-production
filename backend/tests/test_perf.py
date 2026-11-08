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
