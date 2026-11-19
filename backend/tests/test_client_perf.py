def test_client_perf_is_logged(client, caplog):
    with caplog.at_level("INFO", logger="uvicorn.error"):
        res = client.post(
            "/api/perf/client",
            json={
                "page": "courses",
                "total_ms": 1234.5,
                "api_count": 2,
                "api_wall_ms": 800.0,
                "server_ms": 610.0,
                "apis": ["/api/me", "/api/courses/2026-3"],
            },
        )

    assert res.status_code == 204
    logs = [r.getMessage() for r in caplog.records if r.getMessage().startswith("perf-client ")]
    assert logs == [
        "perf-client page=courses total_ms=1234.5 api_count=2 api_wall_ms=800.0 "
        "server_ms=610.0 apis=/api/me,/api/courses/2026-3"
    ]


def test_client_perf_rejects_unknown_page(client):
    res = client.post(
        "/api/perf/client",
        json={"page": "other", "total_ms": 1, "api_count": 0, "api_wall_ms": 0, "server_ms": 0},
    )
    assert res.status_code == 422
