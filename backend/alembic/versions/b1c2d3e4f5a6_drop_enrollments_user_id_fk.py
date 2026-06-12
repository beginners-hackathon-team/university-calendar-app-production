"""drop enrollments user_id foreign key to profiles

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('enrollments_user_id_fkey', 'enrollments', type_='foreignkey')


def downgrade() -> None:
    op.create_foreign_key(
        'enrollments_user_id_fkey',
        'enrollments', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )
