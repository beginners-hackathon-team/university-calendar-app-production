from datetime import datetime, timedelta, timezone

from conftest import TEST_USER_ID

from app.models.task import Task


def _make_assignment(db_session, **overrides) -> Task:
    defaults = dict(
        user_id=TEST_USER_ID,
        title="レポート課題A",
        type="assignment",
        source_type="lms",
        source_provider="kanazawa_lms",
        result="",
    )
    defaults.update(overrides)
    task = Task(**defaults)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)
    return task


def test_get_assignments_returns_created_assignment(client, db_session):
    _make_assignment(db_session)

    res = client.get("/api/assignments")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["task_name"] == "レポート課題A"


def test_get_assignments_excludes_hidden(client, db_session):
    _make_assignment(db_session, is_hidden=True)

    res = client.get("/api/assignments")
    assert res.json() == []


def test_get_assignments_excludes_non_candidate_kind(client, db_session):
    _make_assignment(db_session, title="第1回講義資料", kind="資料")

    res = client.get("/api/assignments")
    assert res.json() == []


def test_get_assignments_excludes_done_over_a_week_ago(client, db_session):
    old_done_at = datetime.now(timezone.utc) - timedelta(weeks=2)
    _make_assignment(db_session, is_done=True, done_at=old_done_at)

    res = client.get("/api/assignments")
    assert res.json() == []


def test_get_assignments_includes_done_within_a_week(client, db_session):
    recent_done_at = datetime.now(timezone.utc) - timedelta(days=1)
    _make_assignment(db_session, is_done=True, done_at=recent_done_at)

    res = client.get("/api/assignments")
    body = res.json()
    assert len(body) == 1
    assert body[0]["is_done"] is True


def test_update_assignment_done(client, db_session):
    a = _make_assignment(db_session)

    res = client.put(f"/api/assignments/{a.id}/done", json={"is_done": True})
    assert res.status_code == 200

    db_session.refresh(a)
    assert a.is_done is True
    assert a.done_at is not None


def test_update_assignment_board_status_to_done_sets_is_done(client, db_session):
    a = _make_assignment(db_session)

    res = client.put(
        f"/api/assignments/{a.id}/board-status", json={"board_status": "done"}
    )
    assert res.status_code == 200

    db_session.refresh(a)
    assert a.board_status == "done"
    assert a.is_done is True


def test_update_assignment_title(client, db_session):
    a = _make_assignment(db_session)

    res = client.put(f"/api/assignments/{a.id}/title", json={"task_name": "改題"})
    assert res.status_code == 200

    db_session.refresh(a)
    assert a.title == "改題"


def test_delete_assignment_hides_instead_of_removing(client, db_session):
    a = _make_assignment(db_session)

    res = client.delete(f"/api/assignments/{a.id}")
    assert res.status_code == 204

    db_session.refresh(a)
    assert a.is_hidden is True
    assert client.get("/api/assignments").json() == []


def test_assignment_endpoints_404_for_other_users_task(client, db_session):
    a = _make_assignment(db_session, user_id="00000000-0000-0000-0000-000000000099")

    assert client.put(f"/api/assignments/{a.id}/done", json={"is_done": True}).status_code == 404
    assert client.delete(f"/api/assignments/{a.id}").status_code == 404


def test_create_list_update_delete_todo(client):
    res = client.post("/api/todos", json={"title": "教科書を買う"})
    assert res.status_code == 201
    todo = res.json()
    assert todo["title"] == "教科書を買う"
    assert todo["is_done"] is False

    listed = client.get("/api/todos").json()
    assert len(listed) == 1

    updated = client.put(
        f"/api/todos/{todo['id']}", json={"title": "教科書を買う", "is_done": True}
    ).json()
    assert updated["is_done"] is True
    assert updated["done_at"] is not None

    res = client.delete(f"/api/todos/{todo['id']}")
    assert res.status_code == 204
    assert client.get("/api/todos").json() == []


def test_update_todo_404_for_missing(client):
    res = client.put("/api/todos/does-not-exist", json={"title": "x"})
    assert res.status_code == 404
