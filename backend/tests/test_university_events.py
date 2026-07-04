def _create_event(client, **overrides):
    payload = {
        "year": 2026,
        "name": "学園祭",
        "type": "other",
        "date": "10-15",
        "original_day": "",
    }
    payload.update(overrides)
    res = client.post("/api/university-events", json=payload)
    return res


def test_create_university_event_requires_admin(client):
    res = _create_event(client)
    assert res.status_code == 403


def test_create_and_list_university_event_as_admin(admin_client):
    res = _create_event(admin_client)
    assert res.status_code == 200

    listed = admin_client.get("/api/university-events/2026").json()
    assert len(listed) == 1
    assert listed[0]["name"] == "学園祭"
    assert listed[0]["type"] == "other"


def test_any_authenticated_user_can_read_events_created_by_admin(client, as_admin):
    with as_admin() as admin:
        _create_event(admin)

    res = client.get("/api/university-events/2026")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_update_university_event_requires_admin(client, as_admin):
    with as_admin() as admin:
        created = _create_event(admin).json()

    res = client.put(
        f"/api/university-events/{created['id']}",
        json={
            "year": 2026,
            "name": "変更後",
            "type": "exam",
            "date": "12-01",
            "original_day": "",
        },
    )
    assert res.status_code == 403


def test_update_university_event_as_admin(as_admin):
    with as_admin() as admin:
        created = _create_event(admin).json()
        res = admin.put(
            f"/api/university-events/{created['id']}",
            json={
                "year": 2026,
                "name": "変更後",
                "type": "exam",
                "date": "12-01",
                "original_day": "",
            },
        )
        assert res.status_code == 200
        assert res.json()["name"] == "変更後"


def test_delete_university_event_requires_admin(client, as_admin):
    with as_admin() as admin:
        created = _create_event(admin).json()

    res = client.delete(f"/api/university-events/{created['id']}")
    assert res.status_code == 403


def test_delete_university_event_as_admin(as_admin):
    with as_admin() as admin:
        created = _create_event(admin).json()
        res = admin.delete(f"/api/university-events/{created['id']}")
        assert res.status_code == 204
        assert admin.get("/api/university-events/2026").json() == []


def test_update_missing_university_event_404(admin_client):
    res = admin_client.put(
        "/api/university-events/does-not-exist",
        json={
            "year": 2026,
            "name": "x",
            "type": "other",
            "date": "01-01",
            "original_day": "",
        },
    )
    assert res.status_code == 404
