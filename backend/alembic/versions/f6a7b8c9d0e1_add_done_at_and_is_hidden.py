"""add done_at and is_hidden

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-13

"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('assignments', sa.Column('done_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assignments', sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('todos', sa.Column('done_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('assignments', 'done_at')
    op.drop_column('assignments', 'is_hidden')
    op.drop_column('todos', 'done_at')
