import json
from datetime import date, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.v1.router import router
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    ComplianceInstance,
    ComplianceRule,
    ComplianceRuleVersion,
    Contractor,
    ContractorSite,
    IndustryType,
    Organization,
    RuleApplicabilityCriteria,
    State,
    Unit,
    User,
    UserRoleScope,
)
from app.services.qa_dataset import seed_qa_demo_workspace


def seed_dashboard_demo_data(db, organization: Organization) -> None:
    """Idempotent non-production data for the MORAX demo workspace only."""
    if organization.code != "MORAX-DEMO":
        return
    states = {
        state.code: state
        for state in db.scalars(select(State).where(State.active.is_(True)))
    }
    industry = db.scalar(select(IndustryType).where(IndustryType.code == "FACTORY"))
    if not industry or not states:
        return

    unit_specs = [
        ("DEMO-CHN", "Chennai Operations", "TN"),
        ("DEMO-BLR", "Bengaluru Operations", "KA"),
        ("DEMO-PUN", "Pune Operations", "MH"),
    ]
    units: list[Unit] = []
    for code, name, state_code in unit_specs:
        unit = db.scalar(
            select(Unit).where(
                Unit.organization_id == organization.id, Unit.code == code
            )
        )
        if not unit:
            unit = Unit(
                organization_id=organization.id,
                name=name,
                code=code,
                unit_type="DEMO_BRANCH",
                industry_type_id=industry.id,
                state_id=states[state_code].id,
                city=name.split()[0],
                male_employees=45,
                female_employees=36,
                compliance_start_date=date(2025, 1, 1),
                status="ACTIVE",
            )
            db.add(unit)
            db.flush()
        units.append(unit)

    contractor_specs = [
        ("DEMO-ALPHA", "Alpha Workforce Services", 0),
        ("DEMO-BRAVO", "Bravo Site Solutions", 0),
        ("DEMO-CREST", "Crest Labour Partners", 1),
        ("DEMO-DELTA", "Delta Facility Services", 1),
        ("DEMO-ECHO", "Echo Industrial Staffing", 2),
    ]
    contractors: list[Contractor] = []
    for code, name, unit_index in contractor_specs:
        contractor = db.scalar(
            select(Contractor).where(
                Contractor.organization_id == organization.id,
                Contractor.code == code,
            )
        )
        if not contractor:
            unit = units[unit_index]
            contractor = Contractor(
                organization_id=organization.id,
                unit_id=unit.id,
                name=name,
                code=code,
                contractor_type="DEMO_CONTRACTOR",
                industry_type_id=industry.id,
                state_id=unit.state_id,
                compliance_start_date=date(2025, 1, 1),
                male_workers=58,
                female_workers=29,
                status="ACTIVE",
            )
            db.add(contractor)
            db.flush()
        contractors.append(contractor)

    sites: list[ContractorSite] = []
    for index, contractor in enumerate(contractors):
        code = f"DEMO-SITE-{index + 1:02d}"
        site = db.scalar(
            select(ContractorSite).where(
                ContractorSite.contractor_id == contractor.id,
                ContractorSite.code == code,
            )
        )
        if not site:
            unit = next(item for item in units if item.id == contractor.unit_id)
            site = ContractorSite(
                organization_id=organization.id,
                contractor_id=contractor.id,
                unit_id=unit.id,
                name=f"{contractor.name} Site",
                code=code,
                unit_type="DEMO_SITE",
                industry_type_id=industry.id,
                state_id=unit.state_id,
                city=unit.city,
                male_workers=31,
                female_workers=19,
                compliance_start_date=date(2025, 1, 1),
                status="ACTIVE",
            )
            db.add(site)
            db.flush()
        sites.append(site)

    rule_specs = [
        ("DEMO-UI-UNIT-MONTHLY", "Demo unit monthly review", "UNIT", "MONTHLY", "HIGH"),
        ("DEMO-UI-UNIT-QUARTER", "Demo unit quarterly review", "UNIT", "QUARTERLY", "MEDIUM"),
        ("DEMO-UI-CONTRACTOR-MONTHLY", "Demo contractor monthly review", "CONTRACTOR", "MONTHLY", "CRITICAL"),
        ("DEMO-UI-CONTRACTOR-ANNUAL", "Demo contractor annual review", "CONTRACTOR", "ANNUAL", "LOW"),
        ("DEMO-UI-SITE-MONTHLY", "Demo site monthly review", "CONTRACTOR_SITE", "MONTHLY", "HIGH"),
        ("DEMO-UI-SITE-ONE-TIME", "Demo site onboarding record", "CONTRACTOR_SITE", "ONE_TIME", "MEDIUM"),
    ]
    versions: dict[str, ComplianceRuleVersion] = {}
    for compliance_id, name, entity_type, frequency, risk_level in rule_specs:
        rule = db.scalar(
            select(ComplianceRule).where(
                ComplianceRule.organization_id == organization.id,
                ComplianceRule.compliance_id == compliance_id,
            )
        )
        if not rule:
            rule = ComplianceRule(
                organization_id=organization.id,
                compliance_id=compliance_id,
            )
            db.add(rule)
            db.flush()
        version = db.scalar(
            select(ComplianceRuleVersion).where(
                ComplianceRuleVersion.rule_id == rule.id,
                ComplianceRuleVersion.version == 1,
            )
        )
        if not version:
            version = ComplianceRuleVersion(
                rule_id=rule.id,
                version=1,
                name=name,
                description="Seeded non-production data for dashboard visual testing.",
                document_type="PROCEDURAL",
                frequency=frequency,
                due_date_rule="MANUAL",
                required_document="Demo supporting evidence",
                risk_level=risk_level,
                effective_from=date(2025, 1, 1),
                active=True,
            )
            db.add(version)
            db.flush()
        if not db.scalar(
            select(RuleApplicabilityCriteria).where(
                RuleApplicabilityCriteria.rule_version_id == version.id
            )
        ):
            db.add(
                RuleApplicabilityCriteria(
                    rule_version_id=version.id,
                    entity_type=entity_type,
                )
            )
        versions[compliance_id] = version

    subject_sets = {
        "UNIT": units,
        "CONTRACTOR": contractors,
        "CONTRACTOR_SITE": sites,
    }
    # Relative dates keep the demo useful regardless of when the MVP is run:
    # overdue, due in a few days, next week, and later in the current cycle.
    offsets = [-18, -7, -2, 2, 5, 9, 13, 21]
    statuses = [
        "PENDING",
        "IN_PROGRESS",
        "APPROVED",
        "SUBMITTED",
        "UNDER_REVIEW",
        "CORRECTION_REQUIRED",
        "REJECTED",
        "APPROVED",
    ]
    sequence = 0
    for compliance_id, name, entity_type, frequency, risk_level in rule_specs:
        version = versions[compliance_id]
        for subject in subject_sets[entity_type]:
            existing = db.scalar(
                select(ComplianceInstance).where(
                    ComplianceInstance.rule_version_id == version.id,
                    ComplianceInstance.subject_type == entity_type,
                    ComplianceInstance.subject_id == subject.id,
                    ComplianceInstance.period_key == "DEMO-2026-09",
                    ComplianceInstance.occurrence_key == "DASHBOARD_DEMO",
                )
            )
            status = statuses[sequence % len(statuses)]
            due_date = date.today() + timedelta(days=offsets[sequence % len(offsets)])
            completed_late = status == "APPROVED" and due_date < date.today()
            if existing:
                # These are explicitly non-production visual-test records. Keep
                # their timeline relative to today so the dashboard always has
                # meaningful upcoming and overdue states to demonstrate.
                existing.status = status
                existing.due_date = due_date
                existing.completed_on = date.today() if status == "APPROVED" else None
                existing.completion_late = completed_late if status == "APPROVED" else None
                sequence += 1
                continue
            db.add(
                ComplianceInstance(
                    organization_id=organization.id,
                    rule_version_id=version.id,
                    subject_type=entity_type,
                    subject_id=subject.id,
                    unit_id=subject.id if entity_type == "UNIT" else None,
                    contractor_id=subject.id if entity_type == "CONTRACTOR" else None,
                    contractor_site_id=subject.id if entity_type == "CONTRACTOR_SITE" else None,
                    period_key="DEMO-2026-09",
                    occurrence_key="DASHBOARD_DEMO",
                    due_date=due_date,
                    status=status,
                    completed_on=date.today() if status == "APPROVED" else None,
                    completion_late=completed_late if status == "APPROVED" else None,
                    rule_snapshot_json=json.dumps(
                        {
                            "compliance_id": compliance_id,
                            "name": name,
                            "version": 1,
                            "frequency": frequency,
                            "required_document": "Demo supporting evidence",
                            "risk_level": risk_level,
                        }
                    ),
                    applicability_snapshot_json=json.dumps(
                        {
                            "seeded_demo": True,
                            "message": "Non-production dashboard visualisation data",
                        }
                    ),
                )
            )
            sequence += 1


def seed_baseline() -> None:
    db = SessionLocal()
    try:
        for name, code in [
            ("Tamil Nadu", "TN"),
            ("Karnataka", "KA"),
            ("Maharashtra", "MH"),
            ("Delhi", "DL"),
            ("Telangana", "TS"),
            ("Gujarat", "GJ"),
        ]:
            if not db.scalar(select(State).where(State.code == code)): db.add(State(name=name, code=code))
        for name, code in [
            ("Air Transport Services", "AIR_TRANSPORT"), ("Any Central Govt. Undertaking", "CENTRAL_GOVT"), ("Any Other Industry", "OTHER"),
            ("Audio-video Production", "AUDIO_VIDEO"), ("Banking / Insurance", "BANKING"), ("Beedi & Cigar", "BEEDI"),
            ("Dock Work", "DOCK_WORK"), ("Factory", "FACTORY"), ("IT Services", "IT_SERVICES"), ("Mines", "MINES"),
            ("Motor Transport Undertaking", "MOTOR_TRANSPORT"), ("Newspapers Establishment", "NEWSPAPER"), ("Plantation", "PLANTATION"),
            ("Telecommunication Services", "TELECOM"), ("Commercial", "COMMERCIAL"),
            ("Manufacturing", "MANUFACTURING"), ("Healthcare Services", "HEALTHCARE"),
            ("Construction", "CONSTRUCTION"), ("Automobile", "AUTOMOBILE"),
        ]:
            if not db.scalar(select(IndustryType).where(IndustryType.code == code)): db.add(IndustryType(name=name, code=code))
        db.flush()
        organization = db.scalar(select(Organization).where(Organization.code == "MORAX-DEMO"))
        if not organization:
            organization = Organization(name="MORAX Demo Company", legal_name="MORAX Demo Company", code="MORAX-DEMO", compliance_start_date=date.today(), status="CONFIGURED")
            db.add(organization); db.flush()
        user = db.scalar(select(User).where(User.email == settings.bootstrap_admin_email.lower()))
        # Seamlessly repair the development account created by pre-release
        # builds that used a reserved `.local` address rejected by EmailStr.
        if not user and settings.bootstrap_admin_email == "admin@morax.example.com":
            user = db.scalar(select(User).where(User.email == "admin@morax.local"))
            if user:
                user.email = settings.bootstrap_admin_email
        if not user:
            user = User(organization_id=organization.id, name="MORAX Administrator", email=settings.bootstrap_admin_email.lower(), password_hash=hash_password(settings.bootstrap_admin_password), must_change_password=True)
            db.add(user); db.flush()
        # The configured bootstrap account is the only initial platform user.
        # Tenant administrators are represented separately as ORGANIZATION_ADMIN.
        user.platform_role = "MORAX_ADMIN"
        if not db.scalar(select(UserRoleScope).where(UserRoleScope.user_id == user.id, UserRoleScope.role == "ORGANIZATION_ADMIN", UserRoleScope.scope_id == organization.id)):
            db.add(UserRoleScope(user_id=user.id, role="ORGANIZATION_ADMIN", scope_type="ORGANIZATION", scope_id=organization.id))
        # Normal startup is idempotent. `python seed.py` performs the explicit
        # reset of known test tenants requested for the retained QA dataset.
        seed_qa_demo_workspace(db, organization, preserve_demo_admin_id=user.id)
        db.commit()
    finally:
        db.close()


app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
def startup() -> None:
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    seed_baseline()


@app.get("/health")
def health():
    return {"status": "ok", "service": "morax-api"}
