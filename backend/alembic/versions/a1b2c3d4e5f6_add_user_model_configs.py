"""add_user_model_configs

Revision ID: a1b2c3d4e5f6
Revises: d52acfb6e0d8
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = 'd52acfb6e0d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_model_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('config_type', sa.String(16), nullable=False),
        sa.Column('provider', sa.String(32), server_default='custom'),
        sa.Column('base_url', sa.String(512), nullable=False),
        sa.Column('api_key', sa.Text, server_default=''),
        sa.Column('model_name', sa.String(128), nullable=False),
        sa.Column('is_active', sa.Integer, server_default='0'),
        sa.Column('extra_params', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    op.create_index('idx_umc_config_type', 'user_model_configs', ['config_type'])
    op.create_index('idx_umc_active', 'user_model_configs', ['config_type', 'is_active'])


def downgrade() -> None:
    op.drop_index('idx_umc_active', table_name='user_model_configs')
    op.drop_index('idx_umc_config_type', table_name='user_model_configs')
    op.drop_table('user_model_configs')
