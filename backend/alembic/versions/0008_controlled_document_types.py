"""Normalize legacy Compliance Master document types to controlled values.

Revision ID: 0008_controlled_document_types
Revises: 0007_contractor_city
"""

from alembic import op


revision = "0008_controlled_document_types"
down_revision = "0007_contractor_city"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No column shape changes are required: document_type already exists.  This
    # one-way data migration makes legacy free-text values usable by the new
    # controlled Compliance Master select and by grouped compliance filtering.
    op.execute(
        """
        UPDATE compliance_rule_versions
        SET document_type = CASE
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%REMITTANCE%' THEN 'REMITTANCE'
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%REGISTER%' THEN 'REGISTER'
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%RETURN%' THEN 'RETURN'
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%INTIMATION%' OR UPPER(COALESCE(document_type, '')) LIKE '%FILING%' THEN 'INTIMATION_FILING'
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%DISPLAY%' THEN 'DISPLAY'
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%NOTICE%' THEN 'NOTICE'
            WHEN UPPER(COALESCE(document_type, '')) LIKE '%RECORD%' OR UPPER(COALESCE(document_type, '')) LIKE '%EVIDENCE%' THEN 'RECORDS'
            ELSE 'PROCEDURAL'
        END
        """
    )


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for this SQLite data migration")
