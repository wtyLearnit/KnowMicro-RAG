"""add schedule tables (courses, tasks, schedule_events)

Revision ID: f7a8b9c0d1e2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'f7a8b9c0d1e2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Courses ──
    op.create_table(
        'courses',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('day_of_week', sa.Integer, nullable=False),
        sa.Column('start_time', sa.String(5), nullable=False),
        sa.Column('end_time', sa.String(5), nullable=False),
        sa.Column('location', sa.String(200), server_default=''),
        sa.Column('teacher', sa.String(100), server_default=''),
        sa.Column('color', sa.String(20), server_default='#4A90D9'),
        sa.Column('weeks', sa.String(200), server_default='1-16'),
        sa.Column('semester_start', sa.String(10), server_default=''),
        sa.Column('is_active', sa.Boolean, server_default='1'),
        sa.Column('created_at', sa.DateTime, nullable=True),
    )
    op.create_index('idx_course_active', 'courses', ['is_active'])

    # ── Tasks ──
    op.create_table(
        'tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, server_default=''),
        sa.Column('estimated_minutes', sa.Integer, server_default='60'),
        sa.Column('priority', sa.String(10), server_default='medium'),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('tags', sa.JSON, nullable=True),
        sa.Column('due_date', sa.String(10), nullable=True),
        sa.Column('scheduled_event_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=True),
    )
    op.create_index('idx_task_status', 'tasks', ['status'])

    # ── Schedule Events ──
    op.create_table(
        'schedule_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, server_default=''),
        sa.Column('start_time', sa.DateTime, nullable=False),
        sa.Column('end_time', sa.DateTime, nullable=False),
        sa.Column('event_type', sa.String(20), server_default='custom'),
        sa.Column('color', sa.String(20), server_default='#4A90D9'),
        sa.Column('course_id', sa.String(36), nullable=True),
        sa.Column('task_id', sa.String(36), nullable=True),
        sa.Column('all_day', sa.Boolean, server_default='0'),
        sa.Column('is_completed', sa.Boolean, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=True),
    )
    op.create_index('idx_event_time', 'schedule_events', ['start_time', 'end_time'])
    op.create_index('idx_event_type', 'schedule_events', ['event_type'])


def downgrade() -> None:
    op.drop_index('idx_event_type', table_name='schedule_events')
    op.drop_index('idx_event_time', table_name='schedule_events')
    op.drop_table('schedule_events')

    op.drop_index('idx_task_status', table_name='tasks')
    op.drop_table('tasks')

    op.drop_index('idx_course_active', table_name='courses')
    op.drop_table('courses')
