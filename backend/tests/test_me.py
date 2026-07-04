from app.models.profile import Profile


def test_get_me_returns_defaults_when_no_profile_row_yet(client, db_session):
    res = client.get("/api/me")
    assert res.status_code == 200
    body = res.json()
    assert body["display_name"] is None
    assert body["assignment_sync_mode"] == "auto"
    assert body["is_admin"] is False

    # GET /api/me だけではprofile行は作られない
    assert db_session.query(Profile).count() == 0


def test_patch_me_creates_profile_and_updates_fields(client, db_session):
    res = client.patch(
        "/api/me", json={"display_name": "岡島", "assignment_sync_mode": "manual"}
    )
    assert res.status_code == 200
    assert res.json()["display_name"] == "岡島"
    assert res.json()["assignment_sync_mode"] == "manual"

    profile = db_session.query(Profile).one()
    assert profile.display_name == "岡島"
    assert profile.assignment_sync_mode == "manual"

    followup = client.get("/api/me").json()
    assert followup["display_name"] == "岡島"
    assert followup["assignment_sync_mode"] == "manual"


def test_patch_me_rejects_invalid_sync_mode(client):
    res = client.patch("/api/me", json={"assignment_sync_mode": "invalid"})
    assert res.status_code == 400
