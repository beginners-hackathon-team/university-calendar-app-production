"""drop legacy tables no longer used by the app (assignments, todos, legacy_users)

assignments/todos は tasks テーブルへの統合(l2m3n4o5p6q7)で完全にコピー済みで、
アプリコードからは一切参照されていない。legacy_users は Supabase Auth 移行時
(d4e5f6a7b8c9)に users テーブルをリネームしたものの、以降どこにも書き戻されて
おらず参照もされていない。

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'o5p6q7r8s9t0'
down_revision: Union[str, Sequence[str], None] = 'n4o5p6q7r8s9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('assignments')
    op.drop_table('todos')
    op.drop_table('legacy_users')


def downgrade() -> None:
    # 注意: データは復元されない（テーブル構造のみを再作成する）。
    op.create_table(
        'legacy_users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id', name='users_pkey'),
    )

    op.create_table(
        'todos',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id', name='todos_pkey'),
    )
    op.create_foreign_key(
        'todos_user_id_fkey',
        'todos', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )

    op.create_table(
        'assignments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('task_name', sa.String(), nullable=False),
        sa.Column('task_contents_id', sa.String(), nullable=False),
        sa.Column('course_name', sa.String(), nullable=True),
        sa.Column('submitted_at', sa.String(), nullable=True),
        sa.Column('result', sa.String(), nullable=False),
        sa.Column('score', sa.String(), nullable=True),
        sa.Column('is_done', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('kind', sa.String(), nullable=True),
        sa.Column('availability_start', sa.String(), nullable=True),
        sa.Column('availability_end', sa.String(), nullable=True),
        sa.Column('lms_course_id', sa.String(), nullable=True),
        sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('is_due_estimated', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id', name='assignments_pkey'),
    )
    op.create_foreign_key(
        'assignments_user_id_fkey',
        'assignments', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )
