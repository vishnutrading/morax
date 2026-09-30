from datetime import UTC, datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import AuthSession, ContractorSite, Unit, User, UserRoleScope

bearer = HTTPBearer(auto_error=False)
PLATFORM_ADMIN_ROLE = "MORAX_ADMIN"
ADMIN_ROLES = {"ORGANIZATION_ADMIN"}
MANAGER_ROLES = {"ORGANIZATION_ADMIN", "UNIT_ADMIN", "CONTRACTOR_ADMIN"}
MAKER_ROLES = {"ORGANIZATION_ADMIN", "UNIT_ADMIN", "CONTRACTOR_ADMIN", "UNIT_MAKER", "CONTRACTOR_MAKER"}
CHECKER_ROLES = {"ORGANIZATION_ADMIN", "UNIT_ADMIN", "CONTRACTOR_ADMIN", "UNIT_CHECKER", "CONTRACTOR_CHECKER"}


def unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise unauthorized()
    try:
        claims = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise unauthorized(str(exc)) from exc
    session = db.get(AuthSession, claims.get("sid"))
    user = db.get(User, claims.get("sub"))
    expired = bool(session and session.expires_at.replace(tzinfo=None) < datetime.now(UTC).replace(tzinfo=None))
    if not session or session.revoked_at or expired or not user or not user.active:
        raise unauthorized("Session is no longer active")
    active_org = session.active_organization_id or user.organization_id
    if not active_org:
        raise unauthorized("No organization context is available")
    if user.platform_role != PLATFORM_ADMIN_ROLE and user.organization_id != active_org:
        raise unauthorized("Organization context is not authorized")
    setattr(user, "_morax_active_organization_id", active_org)
    setattr(user, "_morax_session_id", session.id)
    setattr(user, "_morax_impersonated_by_id", session.impersonated_by_id)
    setattr(user, "_morax_impersonated_by_session_id", session.impersonated_by_session_id)
    return user


def scopes_for(db: Session, user_id: str) -> list[UserRoleScope]:
    return list(db.scalars(select(UserRoleScope).where(UserRoleScope.user_id == user_id)))


def roles_for(db: Session, user_id: str) -> set[str]:
    return {scope.role for scope in scopes_for(db, user_id)}


def is_org_admin(db: Session, user: User, organization_id: str) -> bool:
    if user.platform_role == PLATFORM_ADMIN_ROLE:
        return True
    return any(scope.role in ADMIN_ROLES and scope.scope_type == "ORGANIZATION" and scope.scope_id == organization_id for scope in scopes_for(db, user.id))


def can_access_subject(db: Session, user: User, organization_id: str, subject_type: str, subject_id: str) -> bool:
    if is_org_admin(db, user, organization_id):
        return True
    scopes = scopes_for(db, user.id)
    # An organization-scoped role is intentionally broader than an entity
    # assignment, but must still name the active organization. This supports
    # read-only organization viewers without exposing another tenant.
    if any(
        scope.scope_type == "ORGANIZATION" and scope.scope_id == organization_id
        for scope in scopes
    ):
        return True
    if any(scope.scope_type == subject_type and scope.scope_id == subject_id for scope in scopes):
        return True
    if subject_type == "CONTRACTOR_SITE":
        site = db.get(ContractorSite, subject_id)
        if site:
            return any(
                (scope.scope_type == "CONTRACTOR" and scope.scope_id == site.contractor_id)
                or (scope.scope_type == "UNIT" and scope.scope_id == site.unit_id)
                for scope in scopes
            )
    return False


def require_org_admin(db: Session, user: User, organization_id: str) -> None:
    if not is_org_admin(db, user, organization_id):
        raise HTTPException(status_code=403, detail="Organization administrator permission is required")


def require_org_admin_for_entity_management(db: Session, user: User, organization_id: str) -> None:
    require_org_admin(db, user, organization_id)


def can_read_audit(db: Session, user: User, organization_id: str) -> bool:
    """Audit visibility is limited to tenant administrators and org-scoped auditors."""
    if is_org_admin(db, user, organization_id):
        return True
    return any(
        scope.role == "AUDITOR" and scope.scope_type == "ORGANIZATION" and scope.scope_id == organization_id
        for scope in scopes_for(db, user.id)
    )


def accessible_subject_ids(db: Session, user: User, organization_id: str, subject_type: str) -> set[str] | None:
    if is_org_admin(db, user, organization_id):
        return None
    scopes = scopes_for(db, user.id)
    if any(
        scope.scope_type == "ORGANIZATION" and scope.scope_id == organization_id
        for scope in scopes
    ):
        return None
    ids = {scope.scope_id for scope in scopes if scope.scope_type == subject_type}
    if subject_type == "CONTRACTOR_SITE":
        contractor_ids = {scope.scope_id for scope in scopes if scope.scope_type == "CONTRACTOR"}
        unit_ids = {scope.scope_id for scope in scopes if scope.scope_type == "UNIT"}
        if contractor_ids or unit_ids:
            statement = select(ContractorSite.id).where(ContractorSite.organization_id == organization_id)
            if contractor_ids and unit_ids:
                statement = statement.where((ContractorSite.contractor_id.in_(contractor_ids)) | (ContractorSite.unit_id.in_(unit_ids)))
            elif contractor_ids:
                statement = statement.where(ContractorSite.contractor_id.in_(contractor_ids))
            else:
                statement = statement.where(ContractorSite.unit_id.in_(unit_ids))
            ids.update(db.scalars(statement))
    return ids


def user_summary(db: Session, user: User) -> dict:
    scopes = scopes_for(db, user.id)
    impersonator_id = getattr(user, "_morax_impersonated_by_id", None)
    impersonator = db.get(User, impersonator_id) if impersonator_id else None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "organization_id": getattr(user, "_morax_active_organization_id", user.organization_id),
        "home_organization_id": user.organization_id,
        "platform_role": user.platform_role,
        "must_change_password": user.must_change_password,
        "roles": sorted({scope.role for scope in scopes}),
        "scopes": [{"role": scope.role, "scope_type": scope.scope_type, "scope_id": scope.scope_id} for scope in scopes],
        "impersonation": {
            "active": bool(impersonator_id),
            "impersonator_id": impersonator_id,
            "impersonator_name": impersonator.name if impersonator else None,
        },
    }
