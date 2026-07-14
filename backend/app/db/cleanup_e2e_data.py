"""E2Eテスト実行で作られたデータを削除する。

scripts/e2e/run.sh の後始末フェーズから呼ばれる。E2E_USER_ID
（backend/app/e2e_server.py と共通）に紐づく行だけを消すので、
通常の開発・本番データには影響しない。

実行:
    uv run python -m app.db.cleanup_e2e_data
"""

from app.core.e2e import E2E_USER_ID
from app.db.session import SessionLocal
from app.models.personal_event import PersonalEvent
from app.models.profile import Profile
from app.models.task import Task


def cleanup() -> None:
    db = SessionLocal()
    try:
        deleted_events = (
            db.query(PersonalEvent)
            .filter(PersonalEvent.user_id == E2E_USER_ID)
            .delete()
        )
        deleted_tasks = (
            db.query(Task).filter(Task.user_id == E2E_USER_ID).delete()
        )
        db.query(Profile).filter(Profile.user_id == E2E_USER_ID).delete()
        db.commit()
        print(
            f"E2Eデータを削除しました "
            f"(personal_events: {deleted_events}件, tasks: {deleted_tasks}件)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    cleanup()
