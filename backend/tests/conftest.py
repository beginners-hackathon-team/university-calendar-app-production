from contextlib import contextmanager
from urllib.parse import urlsplit, urlunsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

# Base.metadata に全テーブルを登録させるための import（副作用目的）
from app.models import (  # noqa: F401
    course,
    course_date,
    enrollment,
    personal_event,
    profile,
    task,
    university_event,
)

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_USER_ID = "00000000-0000-0000-0000-000000000002"


def _with_database(url: str, database: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


TEST_DATABASE_URL = _with_database(settings.database_url, "app_test")


@pytest.fixture(scope="session", autouse=True)
def _ensure_test_database() -> None:
    admin_engine = create_engine(settings.database_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": "app_test"},
        ).scalar()
        if not exists:
            conn.execute(text("CREATE DATABASE app_test"))
    admin_engine.dispose()


@pytest.fixture(scope="session")
def engine(_ensure_test_database):
    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    connection = engine.connect()
    outer_transaction = connection.begin()

    # エンドポイント側が db.commit() を呼んでも外側のトランザクションは終わらせず、
    # テスト終了時に outer_transaction.rollback() で全変更を巻き戻せるようにする。
    session_factory = sessionmaker(
        bind=connection, join_transaction_mode="create_savepoint"
    )
    session: Session = session_factory()

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()


def _override_get_db(session: Session):
    def _get_db():
        yield session

    return _get_db


def _current_user(user_id: str, is_admin: bool) -> CurrentUser:
    return CurrentUser(
        user_id=user_id,
        email="test@example.com",
        display_name="Test User",
        is_admin=is_admin,
    )


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = _override_get_db(db_session)
    app.dependency_overrides[get_current_user] = lambda: _current_user(
        TEST_USER_ID, is_admin=False
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_client(db_session):
    app.dependency_overrides[get_db] = _override_get_db(db_session)
    app.dependency_overrides[get_current_user] = lambda: _current_user(
        ADMIN_USER_ID, is_admin=True
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def as_admin(client):
    """`client`で作った1つのTestClientのまま、一時的に管理者として振る舞わせる。

    `client`と`admin_client`を同じテスト内で両方使うと、どちらも同じ
    `app.dependency_overrides`（appに1つしかないグローバルな辞書）を書き換え合うため、
    後から呼ばれた方の設定で上書きされてしまう。この関数はそれを避けるための
    with構文（コンテキストマネージャ）で、ブロックを抜けると自動的に元のユーザーに戻す。
    """

    @contextmanager
    def _as_admin():
        app.dependency_overrides[get_current_user] = lambda: _current_user(
            ADMIN_USER_ID, is_admin=True
        )
        try:
            yield client
        finally:
            app.dependency_overrides[get_current_user] = lambda: _current_user(
                TEST_USER_ID, is_admin=False
            )

    return _as_admin
