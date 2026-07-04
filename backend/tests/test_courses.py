def _create_course(client, **overrides):
    payload = {
        "name": "データ構造とアルゴリズム",
        "room": "第1講義室",
        "teacher": "山田太郎",
        "year": 2026,
        "quarter": 1,
        "day_of_week": "月",
        "period": 2,
    }
    payload.update(overrides)
    res = client.post("/api/course", json=payload)
    assert res.status_code == 200
    return payload


def test_create_and_list_course(client):
    _create_course(client)

    res = client.get("/api/courses/2026-1")
    assert res.status_code == 200
    courses = res.json()
    assert len(courses) == 1
    assert courses[0]["name"] == "データ構造とアルゴリズム"
    assert courses[0]["room"] == "第1講義室"
    assert courses[0]["day_of_week"] == "月"
    assert courses[0]["period"] == 2


def test_list_courses_excludes_other_quarter(client):
    _create_course(client, quarter=1)

    res = client.get("/api/courses/2026-2")
    assert res.status_code == 200
    assert res.json() == []


def test_list_courses_returns_empty_when_no_enrollments(client):
    res = client.get("/api/courses/2026-1")
    assert res.status_code == 200
    assert res.json() == []


def test_update_course_requires_own_enrollment(client):
    res = client.put(
        "/api/course/does-not-exist",
        json={"name": "x", "room": "y", "teacher": "z"},
    )
    assert res.status_code == 404


def test_update_course_updates_fields(client):
    _create_course(client)
    course_id = client.get("/api/courses/2026-1").json()[0]["id"]

    res = client.put(
        f"/api/course/{course_id}",
        json={"name": "新しい授業名", "room": "第2講義室", "teacher": "鈴木花子"},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "新しい授業名"

    listed = client.get("/api/courses/2026-1").json()
    assert listed[0]["name"] == "新しい授業名"
    assert listed[0]["room"] == "第2講義室"


def test_delete_course_removes_enrollment(client):
    _create_course(client)
    course_id = client.get("/api/courses/2026-1").json()[0]["id"]

    res = client.delete(f"/api/course/{course_id}")
    assert res.status_code == 204

    assert client.get("/api/courses/2026-1").json() == []


def test_delete_course_404_when_not_enrolled(client):
    res = client.delete("/api/course/does-not-exist")
    assert res.status_code == 404


def test_delete_all_courses_requires_admin(client):
    _create_course(client)
    res = client.delete("/api/courses")
    assert res.status_code == 403


def test_delete_all_courses_as_admin(admin_client):
    # client と admin_client を同時に使うと app.dependency_overrides の書き換えが競合するため、
    # 同一クライアント内で作成・全削除まで完結させる
    _create_course(admin_client)
    res = admin_client.delete("/api/courses")
    assert res.status_code == 204

    assert admin_client.get("/api/courses/2026-1").json() == []
