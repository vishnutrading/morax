"""Store contractor city captured by the contractor CRUD workflow.

Revision ID: 0007_contractor_city
Revises: 0006_other_industry_name
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_contractor_city"
down_revision = "0006_other_industry_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contractors", sa.Column("city", sa.String(100)))


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for this SQLite migration")
