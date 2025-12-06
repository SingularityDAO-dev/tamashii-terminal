"""add billed column to jobs

Revision ID: a69f0cbc9bee
Revises: c834f2e28e37
Create Date: 2025-12-06 10:49:48.519171

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a69f0cbc9bee'
down_revision: Union[str, Sequence[str], None] = 'c834f2e28e37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('jobs', sa.Column('billed', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('jobs', 'billed')
