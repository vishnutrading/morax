import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Organization(Timestamped, Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(250))
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    identifiers: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    state_id: Mapped[str | None] = mapped_column(ForeignKey("states.id"))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    compliance_start_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="DRAFT", nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(100))
    pan: Mapped[str | None] = mapped_column(String(20))
    gstin: Mapped[str | None] = mapped_column(String(30))
    city: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(20))
    primary_contact_name: Mapped[str | None] = mapped_column(String(150))
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    updated_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))


class State(Base):
    __tablename__ = "states"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class IndustryType(Base):
    __tablename__ = "industry_types"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Unit(Timestamped, Base):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_unit_org_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(30), default="UNIT", nullable=False)
    unit_type: Mapped[str | None] = mapped_column(String(50))
    industry_type_id: Mapped[str] = mapped_column(ForeignKey("industry_types.id"), nullable=False)
    # Retains a descriptive industry name when the configured "Other industry"
    # master category is selected. Compliance applicability still uses the
    # controlled industry_type_id, so it remains driven by Compliance Master.
    other_industry_name: Mapped[str | None] = mapped_column(String(150))
    state_id: Mapped[str] = mapped_column(ForeignKey("states.id"), nullable=False)
    city: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    registration_identifiers: Mapped[str | None] = mapped_column(Text)
    gstin: Mapped[str | None] = mapped_column(String(30))
    pan: Mapped[str | None] = mapped_column(String(20))
    lin: Mapped[str | None] = mapped_column(String(30))
    employer_name: Mapped[str | None] = mapped_column(String(250))
    applicable_regulations: Mapped[str | None] = mapped_column(Text)
    male_employees: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    female_employees: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compliance_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    @property
    def total_employees(self) -> int:
        return self.male_employees + self.female_employees


class Contractor(Timestamped, Base):
    __tablename__ = "contractors"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_contractor_org_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    unit_id: Mapped[str | None] = mapped_column(ForeignKey("units.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    contractor_type: Mapped[str | None] = mapped_column(String(100))
    industry_type_id: Mapped[str | None] = mapped_column(ForeignKey("industry_types.id"))
    other_industry_name: Mapped[str | None] = mapped_column(String(150))
    state_id: Mapped[str | None] = mapped_column(ForeignKey("states.id"))
    city: Mapped[str | None] = mapped_column(String(100))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    pincode: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    registration_identifiers: Mapped[str | None] = mapped_column(Text)
    gstin: Mapped[str | None] = mapped_column(String(30))
    pan: Mapped[str | None] = mapped_column(String(20))
    lin: Mapped[str | None] = mapped_column(String(30))
    applicable_regulations: Mapped[str | None] = mapped_column(Text)
    male_workers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    female_workers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date)
    compliance_start_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    @property
    def total_workers(self) -> int:
        return self.male_workers + self.female_workers


class ContractorSite(Timestamped, Base):
    __tablename__ = "contractor_sites"
    __table_args__ = (UniqueConstraint("contractor_id", "code", name="uq_site_contractor_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    contractor_id: Mapped[str] = mapped_column(ForeignKey("contractors.id"), nullable=False, index=True)
    unit_id: Mapped[str | None] = mapped_column(ForeignKey("units.id"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_type: Mapped[str | None] = mapped_column(String(50))
    industry_type_id: Mapped[str] = mapped_column(ForeignKey("industry_types.id"), nullable=False)
    other_industry_name: Mapped[str | None] = mapped_column(String(150))
    state_id: Mapped[str] = mapped_column(ForeignKey("states.id"), nullable=False)
    city: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    registration_identifiers: Mapped[str | None] = mapped_column(Text)
    gstin: Mapped[str | None] = mapped_column(String(30))
    pan: Mapped[str | None] = mapped_column(String(20))
    lin: Mapped[str | None] = mapped_column(String(30))
    applicable_regulations: Mapped[str | None] = mapped_column(Text)
    male_workers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    female_workers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compliance_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    @property
    def total_workers(self) -> int:
        return self.male_workers + self.female_workers


class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    mobile: Mapped[str | None] = mapped_column(String(30))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    platform_role: Mapped[str | None] = mapped_column(String(40), index=True)


class UserRoleScope(Timestamped, Base):
    __tablename__ = "user_role_scopes"
    __table_args__ = (UniqueConstraint("user_id", "role", "scope_type", "scope_id", name="uq_user_role_scope"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(40), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(36), nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active_organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    # An impersonation is a separate, short-lived session.  Keeping the
    # originating session server-side makes "Return to admin" auditable and
    # prevents the browser from needing to retain an administrator token.
    impersonated_by_session_id: Mapped[str | None] = mapped_column(ForeignKey("auth_sessions.id"), index=True)
    impersonated_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ComplianceRule(Timestamped, Base):
    __tablename__ = "compliance_rules"
    __table_args__ = (UniqueConstraint("organization_id", "compliance_id", name="uq_rule_org_compliance_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    compliance_id: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))


class ComplianceRuleVersion(Timestamped, Base):
    __tablename__ = "compliance_rule_versions"
    __table_args__ = (UniqueConstraint("rule_id", "version", name="uq_rule_version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    rule_id: Mapped[str] = mapped_column(ForeignKey("compliance_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    short_name: Mapped[str | None] = mapped_column(String(100))
    act: Mapped[str | None] = mapped_column(String(250))
    rule_reference: Mapped[str | None] = mapped_column(String(250))
    section: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    compliance_type: Mapped[str | None] = mapped_column(String(100))
    document_type: Mapped[str | None] = mapped_column(String(100))
    form_number: Mapped[str | None] = mapped_column(String(100))
    legal_description: Mapped[str | None] = mapped_column(Text)
    consequence_or_penalty: Mapped[str | None] = mapped_column(Text)
    central_or_state: Mapped[str | None] = mapped_column(String(30))
    frequency: Mapped[str] = mapped_column(String(30), nullable=False)
    due_date_rule: Mapped[str] = mapped_column(String(50), default="FIXED_DAY_OF_MONTH", nullable=False)
    due_date_offset: Mapped[int | None] = mapped_column(Integer)
    due_date_anchor: Mapped[str | None] = mapped_column(String(50))
    grace_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    required_form: Mapped[str | None] = mapped_column(String(250))
    required_document: Mapped[str | None] = mapped_column(String(250))
    maker_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    checker_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(30), default="MEDIUM", nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class RuleApplicabilityCriteria(Base):
    __tablename__ = "rule_applicability_criteria"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    rule_version_id: Mapped[str] = mapped_column(ForeignKey("compliance_rule_versions.id", ondelete="CASCADE"), unique=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    state_id: Mapped[str | None] = mapped_column(ForeignKey("states.id"))
    industry_type_id: Mapped[str | None] = mapped_column(ForeignKey("industry_types.id"))
    employee_threshold: Mapped[int | None] = mapped_column(Integer)
    applicability_flag: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class ComplianceImport(Timestamped, Base):
    __tablename__ = "compliance_imports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    uploaded_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="VALIDATED", nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ComplianceImportRow(Base):
    __tablename__ = "compliance_import_rows"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    import_id: Mapped[str] = mapped_column(ForeignKey("compliance_imports.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    valid: Mapped[bool] = mapped_column(Boolean, nullable=False)


class ComplianceImportError(Base):
    __tablename__ = "compliance_import_errors"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    import_row_id: Mapped[str] = mapped_column(ForeignKey("compliance_import_rows.id", ondelete="CASCADE"), nullable=False, index=True)
    field: Mapped[str | None] = mapped_column(String(100))
    message: Mapped[str] = mapped_column(Text, nullable=False)


class ApplicabilityEvaluation(Base):
    __tablename__ = "applicability_evaluations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    subject_type: Mapped[str] = mapped_column(String(30), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    rule_version_id: Mapped[str] = mapped_column(ForeignKey("compliance_rule_versions.id"), nullable=False)
    applicable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    explanation_json: Mapped[str] = mapped_column(Text, nullable=False)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ComplianceInstance(Timestamped, Base):
    __tablename__ = "compliance_instances"
    __table_args__ = (
        UniqueConstraint("rule_version_id", "subject_type", "subject_id", "period_key", "occurrence_key", name="uq_instance_generation"),
        CheckConstraint("(unit_id IS NOT NULL) + (contractor_id IS NOT NULL) + (contractor_site_id IS NOT NULL) = 1", name="ck_one_instance_subject"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    rule_version_id: Mapped[str] = mapped_column(ForeignKey("compliance_rule_versions.id"), nullable=False, index=True)
    subject_type: Mapped[str] = mapped_column(String(30), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    unit_id: Mapped[str | None] = mapped_column(ForeignKey("units.id"))
    contractor_id: Mapped[str | None] = mapped_column(ForeignKey("contractors.id"))
    contractor_site_id: Mapped[str | None] = mapped_column(ForeignKey("contractor_sites.id"))
    period_key: Mapped[str] = mapped_column(String(30), nullable=False)
    occurrence_key: Mapped[str] = mapped_column(String(80), default="STANDARD", nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="PENDING", nullable=False, index=True)
    rule_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False)
    applicability_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False)
    activity_reference: Mapped[str | None] = mapped_column(String(250))
    completed_on: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[float | None] = mapped_column(Float)
    remarks: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    completion_late: Mapped[bool | None] = mapped_column(Boolean)
    not_applicable_reason: Mapped[str | None] = mapped_column(Text)
    row_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class ComplianceAssignment(Timestamped, Base):
    __tablename__ = "compliance_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    instance_id: Mapped[str] = mapped_column(ForeignKey("compliance_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    assignment_type: Mapped[str] = mapped_column(String(20), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ComplianceSubmission(Base):
    __tablename__ = "compliance_submissions"
    __table_args__ = (UniqueConstraint("instance_id", "revision", name="uq_submission_revision"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    instance_id: Mapped[str] = mapped_column(ForeignKey("compliance_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    submitted_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    activity_snapshot_json: Mapped[str] = mapped_column(Text, nullable=False)


class ComplianceEvidence(Timestamped, Base):
    __tablename__ = "compliance_evidence"
    __table_args__ = (UniqueConstraint("instance_id", "category", "version", name="uq_evidence_version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    instance_id: Mapped[str] = mapped_column(ForeignKey("compliance_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    content_type: Mapped[str | None] = mapped_column(String(150))
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))
    uploaded_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)
    verification_state: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)
    verification_reason: Mapped[str | None] = mapped_column(Text)
    verified_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ComplianceComment(Base):
    __tablename__ = "compliance_comments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    instance_id: Mapped[str] = mapped_column(ForeignKey("compliance_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    comment_type: Mapped[str] = mapped_column(String(30), default="GENERAL", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ComplianceWorkflowHistory(Base):
    __tablename__ = "compliance_workflow_history"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    instance_id: Mapped[str] = mapped_column(ForeignKey("compliance_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(40))
    to_status: Mapped[str | None] = mapped_column(String(40))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    module: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    old_value_json: Mapped[str | None] = mapped_column(Text)
    new_value_json: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InAppNotification(Base):
    __tablename__ = "in_app_notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    reference_type: Mapped[str | None] = mapped_column(String(80))
    reference_id: Mapped[str | None] = mapped_column(String(36))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
