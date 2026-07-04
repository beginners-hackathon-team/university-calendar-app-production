from app.models.course_date import CourseDate


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


def test_calendar_returns_empty_when_not_enrolled(client):
    res = client.get("/api/calendar/2026-4")
    assert res.status_code == 200
    assert res.json() == []


def test_calendar_returns_course_dates_within_month(client):
    _create_course(client)

    res = client.get("/api/calendar/2026-4")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["name"] == "データ構造とアルゴリズム"
    assert body[0]["period"] == 2
    assert all(d.startswith("2026-04") for d in body[0]["dates"])
    assert len(body[0]["dates"]) > 0


def test_calendar_returns_empty_for_month_outside_any_quarter(client):
    # Q4(12/9〜2/10)とQ1(4/6〜)の間の3月はどの学期にも属さない
    _create_course(client)

    res = client.get("/api/calendar/2026-3")
    assert res.status_code == 200
    assert res.json() == []


def test_calendar_excludes_intensive_lecture(client, db_session):
    _create_course(client)

    course_date = db_session.query(CourseDate).one()
    course_date.is_intensive_lct = True
    db_session.commit()

    res = client.get("/api/calendar/2026-4")
    assert res.status_code == 200
    assert res.json() == []
