"""lms sync refactor: rename available fields, add source_url and is_due_estimated

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, Sequence[str], None] = 'j0k1l2m3n4o5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('assignments', 'available_from', new_column_name='availability_start')
    op.alter_column('assignments', 'available_until', new_column_name='availability_end')
    op.add_column('assignments', sa.Column('source_url', sa.String(), nullable=True))
    op.add_column('assignments', sa.Column('is_due_estimated', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('assignments', 'is_due_estimated')
    op.drop_column('assignments', 'source_url')
    op.alter_column('assignments', 'availability_start', new_column_name='available_from')
    op.alter_column('assignments', 'availability_end', new_column_name='available_until')
