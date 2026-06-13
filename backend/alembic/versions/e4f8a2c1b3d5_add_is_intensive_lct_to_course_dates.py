"""add is_intensive_lct to course_dates

Revision ID: e4f8a2c1b3d5
Revises: 3701649af250
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e4f8a2c1b3d5'
down_revision: Union[str, Sequence[str], None] = 'f9f96ba96aac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'course_dates',
        sa.Column('is_intensive_lct', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.alter_column('course_dates', 'day_of_week', nullable=True)


def downgrade() -> None:
    op.alter_column('course_dates', 'day_of_week', nullable=False)
    op.drop_column('course_dates', 'is_intensive_lct')
