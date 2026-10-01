import json
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import ComplianceAssignment, ComplianceEvidence, ComplianceInstance, ComplianceRule, ComplianceRuleVersion, Contractor, ContractorSite, IndustryType, State, Unit, User


def value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def model_dict(model: Any, fields: list[str]) -> dict[str, Any]:
    return {field: value(getattr(model, field)) for field in fields}


def entity_dict(db: Session, entity: Any, kind: str) -> dict[str, Any]:
    fields = [field.name for field in entity.__table__.columns]
    result = model_dict(entity, fields)
    result["entity_type"] = kind
    if kind == "UNIT":
        result["total_employees"] = entity.total_employees
    if kind in {"CONTRACTOR", "CONTRACTOR_SITE"}:
        result["total_workers"] = entity.total_workers
    if getattr(entity, "state_id", None):
        state = db.get(State, entity.state_id)
        result["state_name"] = state.name if state else None
    if getattr(entity, "industry_type_id", None):
        industry = db.get(IndustryType, entity.industry_type_id)
        result["industry_master_name"] = industry.name if industry else None
        result["industry_name"] = getattr(entity, "other_industry_name", None) or (industry.name if industry else None)
    return result


def subject_name(db: Session, instance: ComplianceInstance) -> str:
    model = {"UNIT": Unit, "CONTRACTOR": Contractor, "CONTRACTOR_SITE": ContractorSite}[instance.subject_type]
    subject = db.get(model, instance.subject_id)
    return subject.name if subject else "Deleted subject"


def instance_dict(db: Session, instance: ComplianceInstance, detail: bool = False) -> dict[str, Any]:
    version = db.get(ComplianceRuleVersion, instance.rule_version_id)
    rule = db.get(ComplianceRule, version.rule_id) if version else None
    result = model_dict(instance, [field.name for field in instance.__table__.columns])
    result.update({
        "rule_id": rule.id if rule else None,
        "rule_name": version.name if version else None,
        "compliance_id": rule.compliance_id if rule else None,
        "compliance_name": version.name if version else None,
        "act": version.act if version else None,
        "rule_reference": version.rule_reference if version else None,
        "compliance_type": version.compliance_type if version else None,
        "document_type": version.document_type if version and version.document_type else "PROCEDURAL",
        "form_number": version.form_number if version else None,
        "frequency": version.frequency if version else None,
        "risk_level": version.risk_level if version else None,
        "required_document": version.required_document if version else None,
        "subject_name": subject_name(db, instance),
        "is_overdue": instance.status not in {"APPROVED"} and instance.due_date < date.today(),
        "days_overdue": max(0, (date.today() - instance.due_date).days) if instance.status != "APPROVED" else 0,
    })
    if instance.status in {"PENDING", "IN_PROGRESS", "CORRECTION_REQUIRED"}:
        result["display_status"] = "OVERDUE" if result["is_overdue"] else "DUE"
    elif instance.status in {"SUBMITTED", "UNDER_REVIEW"}:
        result["display_status"] = "PENDING_FOR_APPROVAL"
    elif instance.status == "APPROVED":
        result["display_status"] = "COMPLETED_LATE" if instance.completion_late else "COMPLETED"
    elif instance.status == "NOT_APPLICABLE":
        result["display_status"] = "NOT_APPLICABLE"
    else:
        result["display_status"] = "REJECTED_BY_CHECKER"
    if detail:
        assignments = db.query(ComplianceAssignment).filter_by(instance_id=instance.id, active=True).all()
        evidence = db.query(ComplianceEvidence).filter_by(instance_id=instance.id).all()
        result["assignments"] = [model_dict(item, [field.name for field in item.__table__.columns]) for item in assignments]
        result["evidence"] = [model_dict(item, [field.name for field in item.__table__.columns]) for item in evidence]
        result["rule_snapshot"] = json.loads(instance.rule_snapshot_json)
        result["applicability"] = json.loads(instance.applicability_snapshot_json)
    return result
