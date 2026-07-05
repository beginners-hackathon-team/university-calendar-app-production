from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.profile import Profile

bearer_scheme = HTTPBearer()

_jwks_client = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


@dataclass
class CurrentUser:
    user_id: str
    email: str
    display_name: str
    is_admin: bool


def verify_supabase_jwt(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict:
    """SupabaseのJWTをJWKSで検証し、ペイロードを返す。"""
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            options={"verify_aud": False},
        )
        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    payload: Annotated[dict, Depends(verify_supabase_jwt)],
) -> CurrentUser:
    """JWTペイロードからユーザー情報を組み立てる（DBアクセスなし）。"""
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    email = payload.get("email", "")
    display_name = user_metadata.get("full_name") or email.split("@")[0]
    return CurrentUser(
        user_id=payload["sub"],
        email=email,
        display_name=display_name,
        is_admin=bool(app_metadata.get("is_admin", False)),
    )


def get_admin_user(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user


def ensure_profile(user_id: str, db: Session) -> Profile:
    """プロファイルが存在しなければ作成する。todos / enrollments 等の FK 違反を防ぐ。

    新規ユーザーの初回アクセス時、複数のAPIリクエストがほぼ同時に到達すると
    どちらも「まだ存在しない」と判定してINSERTしようとし、後勝ちの一方が
    profiles_pkeyの重複キー違反で失敗しうる。ON CONFLICT DO NOTHINGで
    その競合を無害化し、結果を取り直す。
    """
    profile = db.get(Profile, user_id)
    if profile:
        return profile

    stmt = (
        pg_insert(Profile)
        .values(user_id=user_id, display_name=None, is_admin=False)
        .on_conflict_do_nothing(index_elements=["user_id"])
    )
    db.execute(stmt)
    db.flush()

    return db.get(Profile, user_id)
