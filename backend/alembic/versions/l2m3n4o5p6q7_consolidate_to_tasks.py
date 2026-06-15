"""consolidate todos and assignments into tasks table

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'l2m3n4o5p6q7'
down_revision: Union[str, Sequence[str], None] = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tasks',
        sa.Column('id', sa.String(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('source_provider', sa.String(), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('course_name', sa.String(), nullable=True),
        sa.Column('lms_course_id', sa.String(), nullable=True),
        sa.Column('task_contents_id', sa.String(), nullable=True),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('kind', sa.String(), nullable=True),
        sa.Column('availability_start', sa.String(), nullable=True),
        sa.Column('availability_end', sa.String(), nullable=True),
        sa.Column('submitted_at', sa.String(), nullable=True),
        sa.Column('result', sa.String(), nullable=True),
        sa.Column('score', sa.String(), nullable=True),
        sa.Column('is_due_estimated', sa.Boolean(), nullable=False, server_default='false'),
    )

    # todos → tasks
    op.execute("""
        INSERT INTO tasks (
            id, user_id, title,
            type, source_type, source_provider,
            is_done, done_at, is_hidden,
            created_at, updated_at,
            task_contents_id, result, is_due_estimated
        )
        SELECT
            id,
            user_id,
            title,
            'todo'   AS type,
            'manual' AS source_type,
            'user'   AS source_provider,
            is_done,
            done_at,
            false    AS is_hidden,
            created_at,
            created_at AS updated_at,
            ''       AS task_contents_id,
            ''       AS result,
            false    AS is_due_estimated
        FROM todos
    """)

    # assignments → tasks
    op.execute("""
        INSERT INTO tasks (
            id, user_id, title,
            type, source_type, source_provider,
            is_done, done_at, is_hidden,
            created_at, updated_at,
            course_name, lms_course_id, task_contents_id, source_url,
            kind, availability_start, availability_end,
            submitted_at, result, score, is_due_estimated
        )
        SELECT
            id,
            user_id,
            task_name              AS title,
            'assignment'           AS type,
            'lms'                  AS source_type,
            'kanazawa_lms'         AS source_provider,
            is_done,
            done_at,
            is_hidden,
            created_at,
            created_at             AS updated_at,
            course_name,
            lms_course_id,
            COALESCE(task_contents_id, '') AS task_contents_id,
            source_url,
            kind,
            availability_start,
            availability_end,
            submitted_at,
            COALESCE(result, '')   AS result,
            score,
            is_due_estimated
        FROM assignments
    """)


def downgrade() -> None:
    op.drop_table('tasks')
