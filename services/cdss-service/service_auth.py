from typing import Any, Dict, Set

import jwt


def extract_owner_claim_sets(payload: Dict[str, Any]) -> Dict[str, Set[str]]:
    roles: Set[str] = set()
    scopes: Set[str] = set()
    permissions: Set[str] = set()

    role_value = payload.get("role")
    if isinstance(role_value, str) and role_value.strip():
        roles.add(role_value.strip().lower())
    for key, target in (("roles", roles), ("scopes", scopes), ("permissions", permissions)):
        val = payload.get(key)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, str) and item.strip():
                    target.add(item.strip().lower())
    scope_str = payload.get("scope")
    if isinstance(scope_str, str) and scope_str.strip():
        for item in scope_str.split():
            if item.strip():
                scopes.add(item.strip().lower())
    perm_str = payload.get("permission")
    if isinstance(perm_str, str) and perm_str.strip():
        permissions.add(perm_str.strip().lower())

    return {"roles": roles, "scopes": scopes, "permissions": permissions}


def is_owner_scope_allowed(claims: Dict[str, Set[str]], required_scope: str) -> bool:
    required = required_scope.strip().lower()
    if not required:
        return True

    roles = claims.get("roles", set())
    scopes = claims.get("scopes", set())
    permissions = claims.get("permissions", set())
    granted = set(scopes) | set(permissions)

    if "super_admin" in roles or "owner" in roles:
        return True
    if "*" in granted or "cdss.admin.*" in granted:
        return True
    if required in granted:
        return True
    if required.endswith(".read") and required.replace(".read", ".*") in granted:
        return True
    if required.endswith(".write") and required.replace(".write", ".*") in granted:
        return True
    if required.startswith("cdss.admin.jobs.") and "cdss.admin.jobs.*" in granted:
        return True
    if required.startswith("cdss.admin.settings.") and "cdss.admin.settings.*" in granted:
        return True
    if required.startswith("cdss.admin.audit.") and "cdss.admin.audit.*" in granted:
        return True
    if required.startswith("cdss.admin.metrics.") and "cdss.admin.metrics.*" in granted:
        return True
    return False


def decode_service_jwt(token: str, secret: str, audience: str, issuer: str) -> Dict[str, Any]:
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience=audience,
        issuer=issuer,
    )


def extract_service_claim_scopes(payload: Dict[str, Any]) -> Set[str]:
    scopes: Set[str] = set()
    raw_scope = payload.get("scope")
    if isinstance(raw_scope, str) and raw_scope.strip():
        for item in raw_scope.split():
            if item.strip():
                scopes.add(item.strip().lower())
    for key in ("scopes", "permissions"):
        vals = payload.get(key)
        if isinstance(vals, list):
            for item in vals:
                if isinstance(item, str) and item.strip():
                    scopes.add(item.strip().lower())
    return scopes


def is_service_scope_allowed(scopes: Set[str], required_scope: str) -> bool:
    required = str(required_scope or "").strip().lower()
    if not required:
        return True
    granted = set(scopes or set())
    if "*" in granted:
        return True
    if required in granted:
        return True
    if required.startswith("cdss.") and "cdss.*" in granted:
        return True
    parts = required.split(".")
    if len(parts) >= 3:
        wildcard = ".".join(parts[:2]) + ".*"
        if wildcard in granted:
            return True
    return False
