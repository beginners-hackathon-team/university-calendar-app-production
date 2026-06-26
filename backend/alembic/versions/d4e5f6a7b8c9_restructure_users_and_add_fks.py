"""restructure users table and add fk constraints

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users テーブルをレガシーとしてリネーム
    op.execute('ALTER TABLE users RENAME TO legacy_users')

    # ローカル環境（素のPostgreSQL）向け: auth スキーマと auth.users を作成
    # 本番 Supabase では既に存在するため IF NOT EXISTS でスキップされる
    # op.execute('CREATE SCHEMA IF NOT EXISTS auth')
    # op.execute('''
    #     CREATE TABLE IF NOT EXISTS auth.users (
    #         id UUID PRIMARY KEY
    #     )
    # ''')

    # profiles.user_id を VARCHAR → UUID に変換
    # UUID に変換できない値が存在する場合はここで失敗して停止する
    op.execute('ALTER TABLE profiles ALTER COLUMN user_id TYPE UUID USING user_id::uuid')

    # profiles の既存 user_id を auth.users に補完してから FK を張る
    # op.execute('''
    #     INSERT INTO auth.users (id)
    #     SELECT user_id FROM profiles
    #     WHERE user_id NOT IN (SELECT id FROM auth.users)
    # ''')

    # profiles.user_id → auth.users(id) FK
    op.execute('''
        ALTER TABLE profiles
        ADD CONSTRAINT profiles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
    ''')

    # enrollments: 孤立レコード削除 → UUID変換 → FK追加
    op.execute('DELETE FROM enrollments WHERE user_id NOT IN (SELECT user_id::text FROM profiles)')
    op.execute('ALTER TABLE enrollments ALTER COLUMN user_id TYPE UUID USING user_id::uuid')
    op.create_foreign_key(
        'enrollments_user_id_fkey',
        'enrollments', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )

    # assignments: 孤立レコード削除 → UUID変換 → FK追加
    op.execute('DELETE FROM assignments WHERE user_id NOT IN (SELECT user_id::text FROM profiles)')
    op.execute('ALTER TABLE assignments ALTER COLUMN user_id TYPE UUID USING user_id::uuid')
    op.create_foreign_key(
        'assignments_user_id_fkey',
        'assignments', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )

    # todos: 孤立レコード削除 → UUID変換 → FK追加
    op.execute('DELETE FROM todos WHERE user_id NOT IN (SELECT user_id::text FROM profiles)')
    op.execute('ALTER TABLE todos ALTER COLUMN user_id TYPE UUID USING user_id::uuid')
    op.create_foreign_key(
        'todos_user_id_fkey',
        'todos', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )

    # personal_events: 孤立レコード削除 → UUID変換 → FK追加
    op.execute('DELETE FROM personal_events WHERE user_id NOT IN (SELECT user_id::text FROM profiles)')
    op.execute('ALTER TABLE personal_events ALTER COLUMN user_id TYPE UUID USING user_id::uuid')
    op.create_foreign_key(
        'personal_events_user_id_fkey',
        'personal_events', 'profiles',
        ['user_id'], ['user_id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('personal_events_user_id_fkey', 'personal_events', type_='foreignkey')
    op.execute('ALTER TABLE personal_events ALTER COLUMN user_id TYPE VARCHAR USING user_id::text')

    op.drop_constraint('todos_user_id_fkey', 'todos', type_='foreignkey')
    op.execute('ALTER TABLE todos ALTER COLUMN user_id TYPE VARCHAR USING user_id::text')

    op.drop_constraint('assignments_user_id_fkey', 'assignments', type_='foreignkey')
    op.execute('ALTER TABLE assignments ALTER COLUMN user_id TYPE VARCHAR USING user_id::text')

    op.drop_constraint('enrollments_user_id_fkey', 'enrollments', type_='foreignkey')
    op.execute('ALTER TABLE enrollments ALTER COLUMN user_id TYPE VARCHAR USING user_id::text')

    op.execute('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey')
    op.execute('ALTER TABLE profiles ALTER COLUMN user_id TYPE VARCHAR USING user_id::text')

    op.execute('ALTER TABLE legacy_users RENAME TO users')
