"""add board_status to tasks

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'n4o5p6q7r8s9'
down_revision: Union[str, Sequence[str], None] = 'm3n4o5p6q7r8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tasks',
        sa.Column('board_status', sa.String(), nullable=False, server_default='assignment'),
    )
    # 既存の完了済み課題を 'done' に設定する
    op.execute("UPDATE tasks SET board_status = 'done' WHERE type = 'assignment' AND is_done = true")


def downgrade() -> None:
    op.drop_column('tasks', 'board_status')
