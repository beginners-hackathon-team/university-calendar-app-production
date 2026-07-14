"""add location and description to personal_events

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'p6q7r8s9t0u1'
down_revision: Union[str, Sequence[str], None] = 'o5p6q7r8s9t0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('personal_events', sa.Column('location', sa.String(), nullable=True))
    op.add_column('personal_events', sa.Column('description', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('personal_events', 'description')
    op.drop_column('personal_events', 'location')
