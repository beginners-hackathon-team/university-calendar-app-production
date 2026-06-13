"""add lms task fields to assignments

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('assignments', sa.Column('kind', sa.String(), nullable=True))
    op.add_column('assignments', sa.Column('available_from', sa.String(), nullable=True))
    op.add_column('assignments', sa.Column('available_until', sa.String(), nullable=True))
    op.add_column('assignments', sa.Column('lms_course_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('assignments', 'lms_course_id')
    op.drop_column('assignments', 'available_until')
    op.drop_column('assignments', 'available_from')
    op.drop_column('assignments', 'kind')
