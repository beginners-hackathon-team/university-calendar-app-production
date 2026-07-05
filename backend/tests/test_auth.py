import threading

from sqlalchemy.orm import Session, sessionmaker

from app.core.auth import ensure_profile
from app.models.profile import Profile


def test_ensure_profile_survives_concurrent_first_requests(engine, monkeypatch):
    """新規ユーザーの初回アクセスで2つのリクエストがほぼ同時に ensure_profile を
    呼んでも、どちらも例外にならず、profiles 行はちょうど1件だけ作られることを確認する。

    db_session フィクスチャ（1コネクション・1トランザクション）では並行実行を
    再現できないため、engine から独立した2つのセッションを別スレッドで動かす。
    さらに Session.get にバリアを仕込み、両スレッドの「まだ存在しない」判定が
    確実に同時に成立するタイミングを強制する（そうしないと競合が再現するかは
    スレッドスケジューリング任せになり、テストとして信頼できない）。
    """
    user_id = "00000000-0000-0000-0000-000000000099"
    session_factory = sessionmaker(bind=engine)

    barrier = threading.Barrier(2)
    thread_local = threading.local()
    original_get = Session.get

    def patched_get(self, entity, ident, *args, **kwargs):
        result = original_get(self, entity, ident, *args, **kwargs)
        if entity is Profile and ident == user_id:
            call_count = getattr(thread_local, "call_count", 0) + 1
            thread_local.call_count = call_count
            if call_count == 1:
                # 最初の存在チェックだけを両スレッドで足並みを揃えさせる。
                # (2回目以降のget=INSERT後の再取得では待たない)
                barrier.wait(timeout=5)
        return result

    monkeypatch.setattr(Session, "get", patched_get)

    errors: list[Exception] = []

    def worker():
        session = session_factory()
        try:
            ensure_profile(user_id, session)
            session.commit()
        except Exception as e:  # noqa: BLE001
            errors.append(e)
        finally:
            session.close()

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    try:
        assert errors == [], f"ensure_profileが競合で例外を起こした: {errors}"

        cleanup_session = session_factory()
        try:
            rows = (
                cleanup_session.query(Profile)
                .filter(Profile.user_id == user_id)
                .all()
            )
            assert len(rows) == 1
        finally:
            cleanup_session.close()
    finally:
        # engine は他のテストとも共有されるため、作成した行を必ず消しておく。
        with engine.connect() as conn:
            conn.execute(
                Profile.__table__.delete().where(Profile.user_id == user_id)
            )
            conn.commit()
