"""drop profiles_user_id_fkey to auth.users

Render PostgreSQL には Supabase が管理する auth.users が存在しないため、
profiles.user_id -> auth.users(id) の FK 制約を削除する。
user_id の整合性は JWT 検証（アプリケーション層）で担保する。

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-06-14 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('profiles_user_id_fkey', 'profiles', type_='foreignkey')


def downgrade() -> None:
    # Render 環境では auth.users が存在しないため downgrade は実質不可
    op.execute("""
        ALTER TABLE profiles
        ADD CONSTRAINT profiles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
    """)
