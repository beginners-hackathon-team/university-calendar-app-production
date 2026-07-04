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
