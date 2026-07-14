def _create_event(client, **overrides):
    payload = {
        "title": "友人と食事",
        "start": "2026-04-10T12:00:00",
        "end": "2026-04-10T13:00:00",
        "all_day": False,
        "color": "#4B82F5",
    }
    payload.update(overrides)
    return client.post("/api/personal-events", json=payload)


def test_create_and_list_personal_event(client):
    res = _create_event(client)
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "友人と食事"

    listed = client.get("/api/personal-events").json()
    assert len(listed) == 1
    assert listed[0]["title"] == "友人と食事"


def test_update_personal_event(client):
    created = _create_event(client).json()

    res = client.put(
        f"/api/personal-events/{created['id']}",
        json={
            "title": "予定変更",
            "start": "2026-04-11T09:00:00",
            "end": None,
            "all_day": True,
            "color": None,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "予定変更"
    assert body["all_day"] is True


def test_update_personal_event_404_for_missing(client):
    res = client.put(
        "/api/personal-events/does-not-exist",
        json={"title": "x", "start": "2026-04-10T00:00:00", "end": None, "all_day": False, "color": None},
    )
    assert res.status_code == 404


def test_delete_personal_event(client):
    created = _create_event(client).json()

    res = client.delete(f"/api/personal-events/{created['id']}")
    assert res.status_code == 204
    assert client.get("/api/personal-events").json() == []


def test_personal_events_are_scoped_to_owner(client, db_session):
    from app.models.personal_event import PersonalEvent

    other = PersonalEvent(
        user_id="00000000-0000-0000-0000-000000000099",
        title="他ユーザーの予定",
        start="2026-04-10T00:00:00",
        all_day=True,
    )
    db_session.add(other)
    db_session.commit()

    assert client.get("/api/personal-events").json() == []
    assert client.delete(f"/api/personal-events/{other.id}").status_code == 404


def test_location_and_description_roundtrip(client):
    res = _create_event(client, location="中央図書館", description="レポート相談")
    assert res.status_code == 201
    body = res.json()
    assert body["location"] == "中央図書館"
    assert body["description"] == "レポート相談"

    res = client.put(
        f"/api/personal-events/{body['id']}",
        json={
            "title": body["title"],
            "start": body["start"],
            "end": body["end"],
            "all_day": body["all_day"],
            "color": body["color"],
            "location": None,
            "description": "場所は未定に変更",
        },
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["location"] is None
    assert updated["description"] == "場所は未定に変更"


def test_location_and_description_default_to_none(client):
    body = _create_event(client).json()
    assert body["location"] is None
    assert body["description"] is None
