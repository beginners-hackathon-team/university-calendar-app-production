"""make profiles.display_name nullable

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE profiles ALTER COLUMN display_name DROP NOT NULL')
    op.execute('ALTER TABLE profiles ALTER COLUMN display_name SET DEFAULT NULL')


def downgrade() -> None:
    op.execute("UPDATE profiles SET display_name = '' WHERE display_name IS NULL")
    op.execute('ALTER TABLE profiles ALTER COLUMN display_name SET NOT NULL')
