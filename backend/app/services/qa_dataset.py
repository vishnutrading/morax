"""Repeatable, clearly-labelled QA data for the MORAX demo workspace.

This data is deliberately fictional.  It exercises the MVP's real tenant,
entity, rule, instance, evidence and workflow relationships without encoding
or implying any real-world legal obligations.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    ApplicabilityEvaluation,
    AuditLog,
    AuthSession,
    ComplianceAssignment,
    ComplianceComment,
    ComplianceEvidence,
    ComplianceImport,
    ComplianceImportError,
    ComplianceImportRow,
    ComplianceInstance,
    ComplianceRule,
    ComplianceRuleVersion,
    ComplianceSubmission,
    ComplianceWorkflowHistory,
    Contractor,
    ContractorSite,
    InAppNotification,
    IndustryType,
    Organization,
    RuleApplicabilityCriteria,
    State,
    Unit,
    User,
    UserRoleScope,
)


DEMO_ORGANIZATION_CODE = "MORAX-DEMO"
TEST_ORGANIZATION_PREFIXES = ("TENANT-", "QA-")
DEMO_PASSWORD = "Demo@123"


def _delete_files_for_evidence(evidence: list[ComplianceEvidence]) -> None:
    for item in evidence:
        path = settings.upload_path / item.stored_filename
        if path.exists():
            path.unlink()


def _clear_organization_data(
    db: Session,
    organization: Organization,
    *,
    keep_user_ids: set[str] | None = None,
) -> None:
    """Clear only operational test data belonging to one known test tenant."""
    keep_user_ids = keep_user_ids or set()
    instance_ids = list(
        db.scalars(
            select(ComplianceInstance.id).where(
                ComplianceInstance.organization_id == organization.id
            )
        )
    )
    if instance_ids:
        evidence = list(
            db.scalars(
                select(ComplianceEvidence).where(
                    ComplianceEvidence.instance_id.in_(instance_ids)
                )
            )
        )
        _delete_files_for_evidence(evidence)
        db.execute(
            delete(ComplianceEvidence).where(
                ComplianceEvidence.instance_id.in_(instance_ids)
            )
        )
        db.execute(
            delete(ComplianceComment).where(
                ComplianceComment.instance_id.in_(instance_ids)
            )
        )
        db.execute(
            delete(ComplianceSubmission).where(
                ComplianceSubmission.instance_id.in_(instance_ids)
            )
        )
        db.execute(
            delete(ComplianceAssignment).where(
                ComplianceAssignment.instance_id.in_(instance_ids)
            )
        )
        db.execute(
            delete(ComplianceWorkflowHistory).where(
                ComplianceWorkflowHistory.instance_id.in_(instance_ids)
            )
        )
        db.execute(
            delete(ComplianceInstance).where(ComplianceInstance.id.in_(instance_ids))
        )

    import_ids = list(
        db.scalars(
            select(ComplianceImport.id).where(
                ComplianceImport.organization_id == organization.id
            )
        )
    )
    if import_ids:
        import_row_ids = list(
            db.scalars(
                select(ComplianceImportRow.id).where(
                    ComplianceImportRow.import_id.in_(import_ids)
                )
            )
        )
        if import_row_ids:
            db.execute(
                delete(ComplianceImportError).where(
                    ComplianceImportError.import_row_id.in_(import_row_ids)
                )
            )
            db.execute(
                delete(ComplianceImportRow).where(
                    ComplianceImportRow.id.in_(import_row_ids)
                )
            )
        db.execute(delete(ComplianceImport).where(ComplianceImport.id.in_(import_ids)))

    # Applicability evaluations retain a foreign key to a rule version, so they
    # must be cleared before the versioned master records.
    db.execute(
        delete(ApplicabilityEvaluation).where(
            ApplicabilityEvaluation.organization_id == organization.id
        )
    )

    rule_ids = list(
        db.scalars(
            select(ComplianceRule.id).where(
                ComplianceRule.organization_id == organization.id
            )
        )
    )
    if rule_ids:
        version_ids = list(
            db.scalars(
                select(ComplianceRuleVersion.id).where(
                    ComplianceRuleVersion.rule_id.in_(rule_ids)
                )
            )
        )
        if version_ids:
            db.execute(
                delete(RuleApplicabilityCriteria).where(
                    RuleApplicabilityCriteria.rule_version_id.in_(version_ids)
                )
            )
            db.execute(
                delete(ComplianceRuleVersion).where(
                    ComplianceRuleVersion.id.in_(version_ids)
                )
            )
        db.execute(delete(ComplianceRule).where(ComplianceRule.id.in_(rule_ids)))

    db.execute(
        delete(InAppNotification).where(
            InAppNotification.organization_id == organization.id
        )
    )
    db.execute(delete(AuditLog).where(AuditLog.organization_id == organization.id))
    db.execute(
        delete(ContractorSite).where(ContractorSite.organization_id == organization.id)
    )
    db.execute(delete(Contractor).where(Contractor.organization_id == organization.id))
    db.execute(delete(Unit).where(Unit.organization_id == organization.id))

    removable_users = list(
        db.scalars(
            select(User).where(
                User.organization_id == organization.id,
                User.id.not_in(keep_user_ids),
            )
        )
    )
    removable_user_ids = [item.id for item in removable_users]
    if removable_user_ids:
        db.execute(
            delete(AuthSession).where(AuthSession.user_id.in_(removable_user_ids))
        )
        db.execute(
            delete(UserRoleScope).where(UserRoleScope.user_id.in_(removable_user_ids))
        )
        db.execute(delete(User).where(User.id.in_(removable_user_ids)))


def clear_known_test_tenants(db: Session, preserve_demo_admin_id: str | None = None) -> None:
    """Remove explicit prior test tenants, never arbitrary customer tenants."""
    test_organizations = list(
        db.scalars(
            select(Organization).where(
                or_(
                    *[
                        Organization.code.startswith(prefix)
                        for prefix in TEST_ORGANIZATION_PREFIXES
                    ]
                )
            )
        )
    )
    for organization in test_organizations:
        _clear_organization_data(db, organization)
        db.execute(
            delete(AuthSession).where(
                AuthSession.active_organization_id == organization.id
            )
        )
        db.delete(organization)

    demo = db.scalar(
        select(Organization).where(Organization.code == DEMO_ORGANIZATION_CODE)
    )
    if demo:
        keep = {preserve_demo_admin_id} if preserve_demo_admin_id else set()
        _clear_organization_data(db, demo, keep_user_ids=keep)


def _master(db: Session, model: type[State] | type[IndustryType], code: str):
    item = db.scalar(select(model).where(model.code == code))
    if not item:
        raise RuntimeError(f"Required QA seed master data is missing: {code}")
    return item


def _ensure_user(
    db: Session,
    organization: Organization,
    *,
    name: str,
    email: str,
    scopes: list[tuple[str, str, str]],
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            organization_id=organization.id,
            name=name,
            email=email,
            password_hash=hash_password(DEMO_PASSWORD),
            active=True,
            must_change_password=False,
        )
        db.add(user)
        db.flush()
    else:
        user.organization_id = organization.id
        user.name = name
        user.active = True
        user.must_change_password = False
        user.platform_role = None
    db.execute(delete(UserRoleScope).where(UserRoleScope.user_id == user.id))
    db.add_all(
        [
            UserRoleScope(
                user_id=user.id,
                role=role,
                scope_type=scope_type,
                scope_id=scope_id,
            )
            for role, scope_type, scope_id in scopes
        ]
    )
    return user


def _rule(
    db: Session,
    organization: Organization,
    *,
    compliance_id: str,
    name: str,
    entity_type: str,
    industry_id: str,
    frequency: str,
    due_date_rule: str,
    due_date_offset: int | None,
    required_document: str | None,
    risk_level: str,
    active: bool = True,
    due_date_anchor: str | None = None,
) -> ComplianceRuleVersion:
    rule = ComplianceRule(
        organization_id=organization.id,
        compliance_id=compliance_id,
    )
    db.add(rule)
    db.flush()
    version = ComplianceRuleVersion(
        rule_id=rule.id,
        version=1,
        name=name,
        description=(
            "Fictional QA-demo obligation used to validate MORAX workflows; "
            "not a legal or statutory instruction."
        ),
        act="MORAX QA Demonstration Framework",
        rule_reference="QA-1",
        section="Demo",
        compliance_type="RETURN",
        document_type="Supporting record",
        form_number="QA-FORM-01",
        frequency=frequency,
        due_date_rule=due_date_rule,
        due_date_offset=due_date_offset,
        due_date_anchor=due_date_anchor,
        grace_days=0,
        required_document=required_document,
        maker_required=True,
        checker_required=True,
        risk_level=risk_level,
        effective_from=date.today() - timedelta(days=730),
        active=active,
    )
    db.add(version)
    db.flush()
    db.add(
        RuleApplicabilityCriteria(
            rule_version_id=version.id,
            entity_type=entity_type,
            industry_type_id=industry_id,
            applicability_flag=True,
            notes="Fictional QA dataset applicability only.",
        )
    )
    return version


def _new_document(
    db: Session,
    instance: ComplianceInstance,
    uploader: User,
    *,
    category: str,
    filename: str,
    verification_state: str,
    verifier: User | None = None,
) -> None:
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    content = (
        "Fictional MORAX QA evidence. This file is test data only and does not "
        "represent a real statutory filing.\n"
    ).encode("utf-8")
    stored_filename = f"qa-{uuid4().hex}.txt"
    (settings.upload_path / stored_filename).write_bytes(content)
    db.add(
        ComplianceEvidence(
            instance_id=instance.id,
            category=category,
            version=1,
            original_filename=filename,
            stored_filename=stored_filename,
            content_type="text/plain",
            size_bytes=len(content),
            checksum_sha256=hashlib.sha256(content).hexdigest(),
            uploaded_by_id=uploader.id,
            verification_state=verification_state,
            verification_reason=(
                "Fictional QA rejection reason" if verification_state == "REJECTED" else None
            ),
            verified_by_id=verifier.id if verifier else None,
            verified_at=datetime.now(UTC) if verifier else None,
        )
    )


def ensure_qa_upcoming_deadlines(
    db: Session, organization: Organization, actor_id: str | None = None
) -> None:
    """Keep four clearly-labelled upcoming cards available for dashboard demos.

    These are normal ComplianceInstance rows, intentionally linked to the
    seeded Unit/Contractor/Site hierarchy.  They are not frontend mock data.
    """
    if organization.code != DEMO_ORGANIZATION_CODE:
        return
    today = date.today()
    industries = {
        code: _master(db, IndustryType, code)
        for code in ("IT_SERVICES", "MANUFACTURING", "HEALTHCARE", "CONSTRUCTION")
    }
    unit = db.scalar(
        select(Unit).where(
            Unit.organization_id == organization.id, Unit.code == "QA-IT-BLR"
        )
    )
    manufacturing_contractor = db.scalar(
        select(Contractor).where(
            Contractor.organization_id == organization.id,
            Contractor.code == "QA-CT-MF-01",
        )
    )
    construction_site = db.scalar(
        select(ContractorSite)
        .join(Contractor, Contractor.id == ContractorSite.contractor_id)
        .where(
            ContractorSite.organization_id == organization.id,
            Contractor.code == "QA-CT-CN-01",
        )
        .order_by(ContractorSite.code)
    )
    healthcare_site = db.scalar(
        select(ContractorSite)
        .join(Contractor, Contractor.id == ContractorSite.contractor_id)
        .where(
            ContractorSite.organization_id == organization.id,
            Contractor.code == "QA-CT-HC-01",
        )
        .order_by(ContractorSite.code)
    )
    if not all((unit, manufacturing_contractor, construction_site, healthcare_site)):
        return

    scenarios = [
        (
            "QA-UPCOMING-IT-01",
            "QA Upcoming — IT attendance evidence",
            "UNIT",
            unit,
            industries["IT_SERVICES"].id,
            1,
            "MEDIUM",
        ),
        (
            "QA-UPCOMING-MFG-01",
            "QA Upcoming — Manufacturing contractor return",
            "CONTRACTOR",
            manufacturing_contractor,
            industries["MANUFACTURING"].id,
            3,
            "HIGH",
        ),
        (
            "QA-UPCOMING-CON-01",
            "QA Upcoming — Construction site wage record",
            "CONTRACTOR_SITE",
            construction_site,
            industries["CONSTRUCTION"].id,
            7,
            "CRITICAL",
        ),
        (
            "QA-UPCOMING-HC-01",
            "QA Upcoming — Healthcare service review",
            "CONTRACTOR_SITE",
            healthcare_site,
            industries["HEALTHCARE"].id,
            12,
            "HIGH",
        ),
    ]
    for compliance_id, name, subject_type, subject, industry_id, days, risk in scenarios:
        rule = db.scalar(
            select(ComplianceRule).where(
                ComplianceRule.organization_id == organization.id,
                ComplianceRule.compliance_id == compliance_id,
            )
        )
        if not rule:
            version = _rule(
                db,
                organization,
                compliance_id=compliance_id,
                name=name,
                entity_type=subject_type,
                industry_id=industry_id,
                frequency="MONTHLY",
                due_date_rule="MANUAL",
                due_date_offset=None,
                required_document="Fictional QA supporting evidence",
                risk_level=risk,
            )
        else:
            version = db.scalar(
                select(ComplianceRuleVersion)
                .where(ComplianceRuleVersion.rule_id == rule.id)
                .order_by(ComplianceRuleVersion.version.desc())
            )
        occurrence_key = f"QA_UPCOMING_{days:02d}_DAYS"
        existing = db.scalar(
            select(ComplianceInstance).where(
                ComplianceInstance.rule_version_id == version.id,
                ComplianceInstance.subject_type == subject_type,
                ComplianceInstance.subject_id == subject.id,
                ComplianceInstance.occurrence_key == occurrence_key,
            )
        )
        if existing:
            # Keep this visual-test scenario useful when it is seeded again.
            existing.status = "PENDING"
            existing.due_date = today + timedelta(days=days)
            existing.completed_on = None
            existing.completion_late = None
            continue
        instance = ComplianceInstance(
            organization_id=organization.id,
            rule_version_id=version.id,
            subject_type=subject_type,
            subject_id=subject.id,
            unit_id=subject.id if subject_type == "UNIT" else None,
            contractor_id=subject.id if subject_type == "CONTRACTOR" else None,
            contractor_site_id=subject.id if subject_type == "CONTRACTOR_SITE" else None,
            period_key=f"QA-UPCOMING-{today:%Y-%m}",
            occurrence_key=occurrence_key,
            due_date=today + timedelta(days=days),
            status="PENDING",
            rule_snapshot_json=json.dumps(
                {
                    "compliance_id": compliance_id,
                    "name": name,
                    "version": version.version,
                    "frequency": version.frequency,
                    "required_document": version.required_document,
                    "risk_level": risk,
                }
            ),
            applicability_snapshot_json=json.dumps(
                {"seeded_demo": True, "scenario": "explicit upcoming deadline"}
            ),
        )
        db.add(instance)
        db.flush()
        db.add(
            ComplianceWorkflowHistory(
                instance_id=instance.id,
                actor_id=actor_id,
                action="QA_UPCOMING_SEEDED",
                to_status="PENDING",
                comment=f"Fictional QA deadline due in {days} days.",
            )
        )


def seed_qa_demo_workspace(
    db: Session,
    organization: Organization,
    *,
    reset: bool = False,
    preserve_demo_admin_id: str | None = None,
) -> None:
    """Create an idempotent enterprise-style test dataset in MORAX-DEMO."""
    if organization.code != DEMO_ORGANIZATION_CODE:
        return
    if reset:
        clear_known_test_tenants(db, preserve_demo_admin_id=preserve_demo_admin_id)
        db.flush()
    if db.scalar(
        select(Unit).where(
            Unit.organization_id == organization.id,
            Unit.code == "QA-IT-BLR",
        )
    ):
        ensure_qa_upcoming_deadlines(db, organization, preserve_demo_admin_id)
        return

    states = {code: _master(db, State, code) for code in ("TN", "KA", "MH", "DL", "TS", "GJ")}
    industries = {
        code: _master(db, IndustryType, code)
        for code in ("IT_SERVICES", "MANUFACTURING", "HEALTHCARE", "CONSTRUCTION", "AUTOMOBILE")
    }
    today = date.today()

    unit_specs = [
        ("QA-IT-BLR", "Nexora Digital Bengaluru Campus", "IT_SERVICES", "KA", "Bengaluru", 390, 310, "ACTIVE"),
        ("QA-IT-HYD", "Nexora Digital Hyderabad Hub", "IT_SERVICES", "TS", "Hyderabad", 280, 240, "ACTIVE"),
        ("QA-MFG-CHN", "Asteron Precision Manufacturing Plant", "MANUFACTURING", "TN", "Chennai", 540, 270, "ACTIVE"),
        ("QA-MFG-PUN", "Asteron Assembly Pune Facility", "MANUFACTURING", "MH", "Pune", 420, 230, "ACTIVE"),
        ("QA-HC-DEL", "SereneCare Delhi Hospital Services", "HEALTHCARE", "DL", "New Delhi", 230, 390, "ACTIVE"),
        ("QA-CON-PUN", "BuildSphere Pune Project Office", "CONSTRUCTION", "MH", "Pune", 170, 65, "ACTIVE"),
        ("QA-CON-AHD", "BuildSphere Ahmedabad Project Office", "CONSTRUCTION", "GJ", "Ahmedabad", 150, 45, "ACTIVE"),
        ("QA-AUTO-CHN", "Velocity Auto Components Chennai Plant", "AUTOMOBILE", "TN", "Chennai", 610, 190, "ACTIVE"),
        ("QA-OLD-DEL", "Legacy Services Delhi Office", "IT_SERVICES", "DL", "New Delhi", 20, 20, "INACTIVE"),
    ]
    units: dict[str, Unit] = {}
    for code, name, industry_code, state_code, city, male, female, status in unit_specs:
        unit = Unit(
            organization_id=organization.id,
            name=name,
            code=code,
            entity_type="UNIT",
            unit_type="BRANCH" if industry_code == "IT_SERVICES" else "ESTABLISHMENT",
            industry_type_id=industries[industry_code].id,
            state_id=states[state_code].id,
            city=city,
            pincode="560001",
            address=f"Fictional QA address, {city}",
            employer_name="MORAX QA Demonstration Organization",
            male_employees=male,
            female_employees=female,
            compliance_start_date=today - timedelta(days=600),
            status=status,
        )
        db.add(unit)
        db.flush()
        units[code] = unit

    contractor_specs = [
        ("QA-CT-IT-01", "Orbit Office Services", "QA-IT-BLR", "IT_SERVICES", "KA", "ACTIVE"),
        ("QA-CT-IT-02", "Cloudline Facility Partners", "QA-IT-HYD", "IT_SERVICES", "TS", "ACTIVE"),
        ("QA-CT-MF-01", "ForgeLine Industrial Staffing", "QA-MFG-CHN", "MANUFACTURING", "TN", "ACTIVE"),
        ("QA-CT-MF-02", "Precision Shift Solutions", "QA-MFG-CHN", "MANUFACTURING", "TN", "ACTIVE"),
        ("QA-CT-MF-03", "AssemblyWorks Labour Services", "QA-MFG-PUN", "MANUFACTURING", "MH", "ACTIVE"),
        ("QA-CT-HC-01", "CareBridge Clinical Support", "QA-HC-DEL", "HEALTHCARE", "DL", "ACTIVE"),
        ("QA-CT-HC-02", "SterilePath Services", "QA-HC-DEL", "HEALTHCARE", "DL", "ACTIVE"),
        ("QA-CT-CN-01", "StonePeak Civil Works", "QA-CON-PUN", "CONSTRUCTION", "MH", "ACTIVE"),
        ("QA-CT-CN-02", "Apex Scaffold Solutions", "QA-CON-PUN", "CONSTRUCTION", "MH", "ACTIVE"),
        ("QA-CT-CN-03", "Horizon Build Crew", "QA-CON-AHD", "CONSTRUCTION", "GJ", "ACTIVE"),
        ("QA-CT-AU-01", "TorqueLine Workforce", "QA-AUTO-CHN", "AUTOMOBILE", "TN", "ACTIVE"),
        ("QA-CT-AU-02", "DriveTrain Operations", "QA-AUTO-CHN", "AUTOMOBILE", "TN", "ACTIVE"),
        ("QA-CT-OLD", "Retired Demo Contractor", "QA-OLD-DEL", "IT_SERVICES", "DL", "INACTIVE"),
    ]
    contractors: dict[str, Contractor] = {}
    for index, (code, name, unit_code, industry_code, state_code, status) in enumerate(contractor_specs, start=1):
        contractor = Contractor(
            organization_id=organization.id,
            unit_id=units[unit_code].id,
            name=name,
            code=code,
            contractor_type="LABOUR_SUPPLY" if "CN" in code or "MF" in code else "FACILITY_SERVICES",
            industry_type_id=industries[industry_code].id,
            state_id=states[state_code].id,
            contact_email=f"{code.lower()}@qa.morax.example.com",
            contact_phone=f"900000{index:04d}",
            address=f"Fictional QA contractor address for {name}",
            male_workers=35 + index * 7,
            female_workers=18 + index * 4,
            effective_date=today - timedelta(days=500),
            compliance_start_date=today - timedelta(days=480),
            status=status,
        )
        db.add(contractor)
        db.flush()
        contractors[code] = contractor

    sites: list[ContractorSite] = []
    for contractor_index, (contractor_code, contractor) in enumerate(contractors.items(), start=1):
        if contractor.status != "ACTIVE":
            continue
        linked_unit = next(unit for unit in units.values() if unit.id == contractor.unit_id)
        for sequence in (1, 2, 3):
            site = ContractorSite(
                organization_id=organization.id,
                contractor_id=contractor.id,
                unit_id=linked_unit.id,
                name=f"{contractor.name} - Work Site {sequence}",
                code=f"QA-SITE-{contractor_index:02d}-{sequence}",
                unit_type="CONTRACTOR_SITE",
                industry_type_id=contractor.industry_type_id,
                state_id=contractor.state_id or linked_unit.state_id,
                city=linked_unit.city,
                pincode=linked_unit.pincode,
                address=f"Fictional QA work site {sequence}, {linked_unit.city}",
                male_workers=12 + contractor_index * 3 + sequence,
                female_workers=7 + contractor_index * 2 + sequence,
                compliance_start_date=today - timedelta(days=400),
                status="ACTIVE",
            )
            db.add(site)
            db.flush()
            sites.append(site)

    rule_specs = [
        ("QA-IT-UNIT-MON", "IT monthly records review", "UNIT", "IT_SERVICES", "MONTHLY", "FIXED_DAY_OF_MONTH", 7, "QA IT records", "MEDIUM", True),
        ("QA-IT-UNIT-QTR", "IT quarterly return review", "UNIT", "IT_SERVICES", "QUARTERLY", "DAYS_AFTER_PERIOD_END", 15, "QA quarterly return", "HIGH", True),
        ("QA-MFG-UNIT-MON", "Manufacturing monthly register review", "UNIT", "MANUFACTURING", "MONTHLY", "FIXED_DAY_OF_MONTH", 10, "QA register extract", "HIGH", True),
        ("QA-MFG-SITE-MON", "Manufacturing site safety record", "CONTRACTOR_SITE", "MANUFACTURING", "MONTHLY", "FIXED_DAY_OF_MONTH", 12, "QA safety record", "CRITICAL", True),
        ("QA-MFG-CON-HALF", "Manufacturing contractor half-yearly statement", "CONTRACTOR", "MANUFACTURING", "HALF_YEARLY", "DAYS_AFTER_PERIOD_END", 21, "QA half-yearly statement", "HIGH", True),
        ("QA-HC-UNIT-MON", "Healthcare monthly workforce record", "UNIT", "HEALTHCARE", "MONTHLY", "FIXED_DAY_OF_MONTH", 8, "QA healthcare record", "MEDIUM", True),
        ("QA-HC-SITE-QTR", "Healthcare service-site quarterly review", "CONTRACTOR_SITE", "HEALTHCARE", "QUARTERLY", "DAYS_AFTER_PERIOD_END", 20, "QA service-site evidence", "HIGH", True),
        ("QA-CON-UNIT-MON", "Construction monthly attendance review", "UNIT", "CONSTRUCTION", "MONTHLY", "FIXED_DAY_OF_MONTH", 7, "QA attendance record", "HIGH", True),
        ("QA-CON-SITE-MON", "Construction site wage record", "CONTRACTOR_SITE", "CONSTRUCTION", "MONTHLY", "FIXED_DAY_OF_MONTH", 10, "QA wage record", "CRITICAL", True),
        ("QA-CON-CON-ANNUAL", "Construction contractor annual declaration", "CONTRACTOR", "CONSTRUCTION", "ANNUAL", "FIXED_ANNUAL_DATE", None, "QA annual declaration", "MEDIUM", True),
        ("QA-AUTO-UNIT-MON", "Automobile monthly production register", "UNIT", "AUTOMOBILE", "MONTHLY", "FIXED_DAY_OF_MONTH", 9, "QA production register", "HIGH", True),
        ("QA-AUTO-SITE-QTR", "Automobile site quarterly verification", "CONTRACTOR_SITE", "AUTOMOBILE", "QUARTERLY", "DAYS_AFTER_PERIOD_END", 14, "QA verification record", "MEDIUM", True),
        ("QA-AUTO-CON-ANNUAL", "Automobile contractor annual review", "CONTRACTOR", "AUTOMOBILE", "ANNUAL", "FIXED_ANNUAL_DATE", None, "QA annual review", "LOW", True),
        ("QA-IT-ONBOARD", "IT one-time onboarding acknowledgement", "CONTRACTOR_SITE", "IT_SERVICES", "ONE_TIME", "ONE_TIME_CONFIGURED_DATE", None, "QA onboarding acknowledgement", "LOW", True),
        ("QA-INACTIVE-RULE", "Inactive QA rule for filter testing", "UNIT", "IT_SERVICES", "MONTHLY", "FIXED_DAY_OF_MONTH", 6, None, "LOW", False),
    ]
    versions: dict[str, ComplianceRuleVersion] = {}
    for spec in rule_specs:
        compliance_id, name, entity_type, industry_code, frequency, due_rule, due_offset, required_document, risk, active = spec
        versions[compliance_id] = _rule(
            db,
            organization,
            compliance_id=compliance_id,
            name=name,
            entity_type=entity_type,
            industry_id=industries[industry_code].id,
            frequency=frequency,
            due_date_rule=due_rule,
            due_date_offset=due_offset,
            due_date_anchor=("12-31" if due_rule == "FIXED_ANNUAL_DATE" else (today.isoformat() if due_rule == "ONE_TIME_CONFIGURED_DATE" else None)),
            required_document=required_document,
            risk_level=risk,
            active=active,
        )

    # Generate genuine instances through the same applicability service the API uses.
    from app.services.compliance import generate_for_subject

    for subject_type, rows in (
        ("UNIT", list(units.values())),
        ("CONTRACTOR", list(contractors.values())),
        ("CONTRACTOR_SITE", sites),
    ):
        for subject in rows:
            generate_for_subject(db, organization.id, subject_type, subject.id, today)
    db.flush()

    # Add a small historical population for monthly performance validation.
    history_subjects = [units["QA-IT-BLR"], units["QA-MFG-CHN"], units["QA-CON-PUN"]]
    for months_ago in range(1, 5):
        historic_date = (today.replace(day=1) - timedelta(days=months_ago * 28)).replace(day=15)
        for subject in history_subjects:
            generate_for_subject(db, organization.id, "UNIT", subject.id, historic_date)
    db.flush()

    instances = list(
        db.scalars(
            select(ComplianceInstance)
            .where(ComplianceInstance.organization_id == organization.id)
            .order_by(ComplianceInstance.created_at, ComplianceInstance.id)
        )
    )
    status_cycle = [
        ("APPROVED", -12),
        ("APPROVED", -2),
        ("PENDING", -9),
        ("IN_PROGRESS", -4),
        ("CORRECTION_REQUIRED", -1),
        ("PENDING", 0),
        ("IN_PROGRESS", 2),
        ("PENDING", 4),
        ("SUBMITTED", 5),
        ("UNDER_REVIEW", 7),
        ("REJECTED", 9),
        ("PENDING", 13),
        ("NOT_APPLICABLE", 18),
        ("APPROVED", 23),
        ("PENDING", 29),
    ]
    for index, instance in enumerate(instances):
        status, day_offset = status_cycle[index % len(status_cycle)]
        instance.status = status
        instance.due_date = today + timedelta(days=day_offset)
        instance.activity_reference = (
            f"QA-FILING-{index + 1:04d}" if status in {"APPROVED", "SUBMITTED", "UNDER_REVIEW"} else None
        )
        instance.remarks = "Fictional QA scenario data."
        if status == "APPROVED":
            instance.completed_on = instance.due_date if day_offset >= 0 else today
            instance.approved_at = datetime.now(UTC)
            instance.completion_late = day_offset < 0
        elif status == "NOT_APPLICABLE":
            instance.not_applicable_reason = "Fictional QA not-applicable scenario."
        if status in {"SUBMITTED", "UNDER_REVIEW", "APPROVED"}:
            instance.submitted_at = datetime.now(UTC)
            db.add(
                ComplianceSubmission(
                    instance_id=instance.id,
                    revision=1,
                    submitted_by_id=preserve_demo_admin_id or "",
                    activity_snapshot_json=json.dumps({"seeded": True}),
                )
            )
        db.add(
            ComplianceWorkflowHistory(
                instance_id=instance.id,
                actor_id=preserve_demo_admin_id,
                action="QA_SEEDED",
                to_status=status,
                comment="Fictional QA dataset status.",
            )
        )

    org_admin = _ensure_user(
        db,
        organization,
        name="Meera Iyer (QA Organization Admin)",
        email="meera.admin@morax.example.com",
        scopes=[("ORGANIZATION_ADMIN", "ORGANIZATION", organization.id)],
    )
    unit_maker = _ensure_user(
        db,
        organization,
        name="Ravi Shah (QA Unit Maker)",
        email="ravi.maker@morax.example.com",
        scopes=[("UNIT_MAKER", "UNIT", units["QA-IT-BLR"].id)],
    )
    unit_checker = _ensure_user(
        db,
        organization,
        name="Kavya Menon (QA Unit Checker)",
        email="kavya.checker@morax.example.com",
        scopes=[("UNIT_CHECKER", "UNIT", units["QA-IT-BLR"].id)],
    )
    contractor_maker = _ensure_user(
        db,
        organization,
        name="Sameer Khan (QA Contractor Maker)",
        email="sameer.contractor.maker@morax.example.com",
        scopes=[("CONTRACTOR_MAKER", "CONTRACTOR", contractors["QA-CT-MF-01"].id)],
    )
    contractor_checker = _ensure_user(
        db,
        organization,
        name="Anika Rao (QA Contractor Checker)",
        email="anika.contractor.checker@morax.example.com",
        scopes=[("CONTRACTOR_CHECKER", "CONTRACTOR", contractors["QA-CT-MF-01"].id)],
    )
    _ensure_user(
        db,
        organization,
        name="Vikram Das (QA Viewer)",
        email="vikram.viewer@morax.example.com",
        scopes=[("VIEWER", "UNIT", units["QA-HC-DEL"].id)],
    )
    _ensure_user(
        db,
        organization,
        name="Asha Nair (QA Auditor)",
        email="asha.auditor@morax.example.com",
        scopes=[("AUDITOR", "ORGANIZATION", organization.id)],
    )
    db.flush()

    for instance in instances[:20]:
        db.add(
            ComplianceAssignment(
                instance_id=instance.id,
                user_id=(unit_maker.id if instance.subject_type == "UNIT" else contractor_maker.id),
                assignment_type="MAKER",
                assigned_by_id=org_admin.id,
            )
        )
        db.add(
            ComplianceAssignment(
                instance_id=instance.id,
                user_id=(unit_checker.id if instance.subject_type == "UNIT" else contractor_checker.id),
                assignment_type="CHECKER",
                assigned_by_id=org_admin.id,
            )
        )

    evidence_candidates = [
        item for item in instances if item.status in {"APPROVED", "SUBMITTED", "UNDER_REVIEW"}
    ][:6]
    for index, instance in enumerate(evidence_candidates, start=1):
        _new_document(
            db,
            instance,
            org_admin,
            category="QA_SUPPORTING_DOCUMENT",
            filename=f"QA-Evidence-{index:02d}.txt",
            verification_state=("VERIFIED" if index <= 3 else ("REJECTED" if index == 4 else "PENDING")),
            verifier=unit_checker if index <= 3 else (contractor_checker if index == 4 else None),
        )

    db.add(
        AuditLog(
            organization_id=organization.id,
            actor_id=org_admin.id,
            action="QA_DATASET_SEEDED",
            module="QA",
            entity_type="Organization",
            entity_id=organization.id,
            new_value_json=json.dumps(
                {
                    "dataset": "fictional enterprise QA dataset",
                    "units": len(units),
                    "contractors": len(contractors),
                    "sites": len(sites),
                    "instances": len(instances),
                }
            ),
        )
    )
    ensure_qa_upcoming_deadlines(db, organization, preserve_demo_admin_id)


def reset_and_seed_qa_dataset(db: Session, bootstrap_admin_id: str | None = None) -> None:
    organization = db.scalar(
        select(Organization).where(Organization.code == DEMO_ORGANIZATION_CODE)
    )
    if not organization:
        raise RuntimeError("MORAX-DEMO organization must exist before QA seeding")
    seed_qa_demo_workspace(
        db,
        organization,
        reset=True,
        preserve_demo_admin_id=bootstrap_admin_id,
    )
    db.commit()
