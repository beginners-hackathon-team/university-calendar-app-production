from contextlib import contextmanager

from sqlalchemy import event

def _course_item(**overrides):
    item = {
        "name": "データ構造とアルゴリズム",
        "teacher": "山田太郎",
        "room": "第1講義室",
        "year": 2026,
        "quarter": 1,
        "day_of_week": "月",
        "period": 2,
        "is_intensive_lct": False,
    }
    item.update(overrides)
    return item


def test_import_courses_creates_new_courses(client):
    res = client.post(
        "/api/extension/import-courses",
        json={
            "courses": [_course_item(), _course_item(name="英語", day_of_week="火", period=1)],
            "sync_year": 2026,
            "sync_quarters": [1],
        },
    )
    assert res.status_code == 200
    assert res.json()["count"] == 2

    listed = client.get("/api/courses/2026-1").json()
    assert {c["name"] for c in listed} == {"データ構造とアルゴリズム", "英語"}


def test_import_courses_updates_existing_course_in_place(client):
    client.post(
        "/api/extension/import-courses",
        json={"courses": [_course_item()], "sync_year": 2026, "sync_quarters": [1]},
    )

    res = client.post(
        "/api/extension/import-courses",
        json={
            "courses": [_course_item(room="第2講義室", teacher="鈴木花子")],
            "sync_year": 2026,
            "sync_quarters": [1],
        },
    )
    assert res.status_code == 200

    listed = client.get("/api/courses/2026-1").json()
    assert len(listed) == 1
    assert listed[0]["room"] == "第2講義室"
    assert listed[0]["teacher"] == "鈴木花子"


def test_import_courses_removes_course_missing_from_sync_scope(client):
    client.post(
        "/api/extension/import-courses",
        json={
            "courses": [_course_item(), _course_item(name="英語", day_of_week="火", period=1)],
            "sync_year": 2026,
            "sync_quarters": [1],
        },
    )

    # 2回目の取得結果に「英語」が含まれない → 削除される
    res = client.post(
        "/api/extension/import-courses",
        json={"courses": [_course_item()], "sync_year": 2026, "sync_quarters": [1]},
    )
    assert res.status_code == 200

    listed = client.get("/api/courses/2026-1").json()
    assert {c["name"] for c in listed} == {"データ構造とアルゴリズム"}


def test_import_courses_leaves_courses_outside_sync_scope_untouched(client):
    client.post(
        "/api/extension/import-courses",
        json={
            "courses": [_course_item(quarter=2, day_of_week="水", period=3)],
            "sync_year": 2026,
            "sync_quarters": [2],
        },
    )

    # sync_quarters=[1] のみを対象にした同期では、Q2の授業には触れない
    client.post(
        "/api/extension/import-courses",
        json={"courses": [], "sync_year": 2026, "sync_quarters": [1]},
    )

    listed = client.get("/api/courses/2026-2").json()
    assert len(listed) == 1


@contextmanager
def _count_statements(db_session):
    """ブロック内で発行されたSQLの数を数える（トランザクション制御は除く）。"""
    connection = db_session.get_bind()
    statements = []

    def _record(conn, cursor, statement, parameters, context, executemany):
        if not statement.startswith(("SAVEPOINT", "RELEASE", "ROLLBACK")):
            statements.append(statement)

    event.listen(connection, "before_cursor_execute", _record)
    try:
        yield statements
    finally:
        event.remove(connection, "before_cursor_execute", _record)


def _import_statement_counts(client, db_session, size):
    """同じユーザーの授業を size 件 追加→更新→全削除 したときの各SQL数を返す。"""
    items = [
        _course_item(name=f"授業{i}", day_of_week="月火水木金土"[i % 6], period=i // 6 + 1)
        for i in range(size)
    ]

    def sync(courses):
        with _count_statements(db_session) as statements:
            res = client.post(
                "/api/extension/import-courses",
                json={"courses": courses, "sync_year": 2026, "sync_quarters": [1]},
            )
        assert res.status_code == 200
        return len(statements)

    # 初回だけ ensure_profile のINSERTが混ざるので、先に済ませておく
    sync([])
    created = sync(items)
    updated = sync([{**item, "room": "別の教室"} for item in items])
    deleted = sync([])
    assert client.get("/api/courses/2026-1").json() == []
    return created, updated, deleted


def test_import_courses_statement_count_does_not_grow_with_course_count(client, db_session):
    # 授業数に比例してSQLが増える（N+1）と、件数が違うときに一致しなくなる
    assert _import_statement_counts(client, db_session, 2) == _import_statement_counts(
        client, db_session, 30
    )


def test_import_courses_applies_create_update_and_delete_in_one_sync(client):
    client.post(
        "/api/extension/import-courses",
        json={
            "courses": [_course_item(), _course_item(name="英語", day_of_week="火", period=1)],
            "sync_year": 2026,
            "sync_quarters": [1],
        },
    )

    res = client.post(
        "/api/extension/import-courses",
        json={
            "courses": [
                _course_item(room="第2講義室"),
                _course_item(name="線形代数", day_of_week="水", period=3),
            ],
            "sync_year": 2026,
            "sync_quarters": [1],
        },
    )
    assert res.status_code == 200

    listed = {c["name"]: c for c in client.get("/api/courses/2026-1").json()}
    assert set(listed) == {"データ構造とアルゴリズム", "線形代数"}
    assert listed["データ構造とアルゴリズム"]["room"] == "第2講義室"


def test_import_lms_tasks_creates_task_reachable_via_assignments(client):
    res = client.post(
        "/api/extension/import-lms-tasks",
        json={
            "tasks": [
                {
                    "content_id": "c-1",
                    "source_url": "https://example.com/c-1",
                    "title": "第1回レポート提出",
                    "kind": "レポート",
                    "course_id": "lms-course-1",
                    "course_name": "データ構造とアルゴリズム",
                    "available_from": None,
                    "available_until": None,
                    "is_active_url": True,
                }
            ]
        },
    )
    assert res.status_code == 200
    assert res.json()["count"] == 1

    assignments = client.get("/api/assignments").json()
    assert len(assignments) == 1
    assert assignments[0]["task_name"] == "第1回レポート提出"


def test_import_lms_tasks_upserts_by_content_id(client):
    payload = {
        "tasks": [
            {
                "content_id": "c-1",
                "source_url": "https://example.com/c-1",
                "title": "第1回レポート提出",
                "kind": "レポート",
                "course_id": "lms-course-1",
                "course_name": "データ構造とアルゴリズム",
                "is_active_url": True,
            }
        ]
    }
    client.post("/api/extension/import-lms-tasks", json=payload)

    payload["tasks"][0]["title"] = "第1回レポート提出（締切延長）"
    client.post("/api/extension/import-lms-tasks", json=payload)

    assignments = client.get("/api/assignments").json()
    assert len(assignments) == 1
    assert assignments[0]["task_name"] == "第1回レポート提出（締切延長）"
