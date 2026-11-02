"""add indexes for per-user lookups and cascade deletes

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-11-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'q7r8s9t0u1v2'
down_revision: Union[str, Sequence[str], None] = 'p6q7r8s9t0u1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_enrollments_user_id_course_id', 'enrollments', ['user_id', 'course_id'])
    op.create_index('ix_enrollments_course_id', 'enrollments', ['course_id'])
    op.create_index('ix_course_dates_course_id', 'course_dates', ['course_id'])
    op.create_index('ix_tasks_user_id_type', 'tasks', ['user_id', 'type'])
    op.create_index('ix_personal_events_user_id', 'personal_events', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_personal_events_user_id', table_name='personal_events')
    op.drop_index('ix_tasks_user_id_type', table_name='tasks')
    op.drop_index('ix_course_dates_course_id', table_name='course_dates')
    op.drop_index('ix_enrollments_course_id', table_name='enrollments')
    op.drop_index('ix_enrollments_user_id_course_id', table_name='enrollments')
