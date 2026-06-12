"""add lms_course_id and lms_system_type to courses

Revision ID: b7c3d9e1f2a4
Revises: e4f8a2c1b3d5
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c3d9e1f2a4'
down_revision: Union[str, Sequence[str], None] = 'e4f8a2c1b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('courses', sa.Column('lms_course_id', sa.String(), nullable=True))
    op.add_column('courses', sa.Column('lms_system_type', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('courses', 'lms_system_type')
    op.drop_column('courses', 'lms_course_id')
