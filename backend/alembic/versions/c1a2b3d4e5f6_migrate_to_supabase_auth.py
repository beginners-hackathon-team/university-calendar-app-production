"""migrate to supabase auth: create profiles, update enrollments fk

Revision ID: c1a2b3d4e5f6
Revises: e4f8a2c1b3d5
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = ('33f8609a59ef', 'b7c3d9e1f2a4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'profiles',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('user_id'),
    )

    # 既存のenrollmentsデータを破棄してFKを付け替え
    op.execute('DELETE FROM enrollments')
    op.drop_constraint('enrollments_user_id_fkey', 'enrollments', type_='foreignkey')
    op.create_foreign_key(
        'enrollments_user_id_fkey',
        'enrollments', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('enrollments_user_id_fkey', 'enrollments', type_='foreignkey')
    op.create_foreign_key(
        'enrollments_user_id_fkey',
        'enrollments', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE',
    )
    op.drop_table('profiles')
