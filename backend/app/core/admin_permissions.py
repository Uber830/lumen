"""The permissions of the school administrator.

There are two ranks inside a school:

- **principal**: runs the school. It closes the academic periods,
  invites the rest of the team and changes the identity of the school.
- **secundario**: helps with the community and the academic structure.

The difference has to be visible in the interface, not only in the
backend. The frontend does not decide what a rank may do: the API
returns the list of permissions of the caller in `GET /v1/school/me`
and the frontend hides or disables what is not on the list.

A denied action is not invisible: it is disabled **with the reason**,
so the person administering the school knows why the button does not
work instead of thinking the product is broken.

This module is the single owner of that catalogue. The backend checks
the permission before doing the work; the frontend renders the list it
receives.
"""

from __future__ import annotations

from enum import StrEnum

from app.core.errors import ForbiddenError
from app.db.enums import SchoolAdminRole


class SchoolPermission(StrEnum):
    """What a school administrator may do.

    The strings are the contract with the frontend: they travel in
    `permissions: string[]` and the interface decides what to show
    from them.
    """

    # The panel of the school.
    DASHBOARD_READ = "dashboard.read"
    REPORTS_READ = "reports.read"

    # The material the platform team enabled for the school. Read
    # only: the school consumes, it does not upload. There is no
    # download permission: the material lives inside the platform and
    # nobody takes the file out of it.
    MATERIAL_READ = "material.read"

    # The community.
    TEACHERS_READ = "teachers.read"
    TEACHERS_WRITE = "teachers.write"
    STUDENTS_READ = "students.read"
    STUDENTS_WRITE = "students.write"

    # The academic structure.
    COURSES_READ = "courses.read"
    COURSES_WRITE = "courses.write"
    ASSIGNMENTS_READ = "assignments.read"
    ASSIGNMENTS_WRITE = "assignments.write"

    # The cycle of the school. Closing a period is the principal's.
    PERIODS_READ = "periods.read"
    PERIODS_CLOSE = "periods.close"

    # The results of the simulations.
    ICFES_READ = "icfes.read"
    # The school activates in its courses what the platform enabled.
    ICFES_ACTIVATE = "icfes.activate"

    # The channel with the support team.
    SUPPORT_WRITE = "support.write"

    # The visible identity of the school: name, shield and colour.
    CUSTOMIZATION_READ = "customization.read"
    CUSTOMIZATION_WRITE = "customization.write"

    # The team of administrators. Only the principal invites.
    ADMINS_READ = "admins.read"
    ADMINS_MANAGE = "admins.manage"


# What every administrator of the school may do.
_COMMON_PERMISSIONS: tuple[SchoolPermission, ...] = (
    SchoolPermission.DASHBOARD_READ,
    SchoolPermission.MATERIAL_READ,
    SchoolPermission.TEACHERS_READ,
    SchoolPermission.TEACHERS_WRITE,
    SchoolPermission.STUDENTS_READ,
    SchoolPermission.STUDENTS_WRITE,
    SchoolPermission.COURSES_READ,
    SchoolPermission.COURSES_WRITE,
    SchoolPermission.ASSIGNMENTS_READ,
    SchoolPermission.ASSIGNMENTS_WRITE,
    SchoolPermission.PERIODS_READ,
    SchoolPermission.ICFES_READ,
    SchoolPermission.ICFES_ACTIVATE,
    SchoolPermission.SUPPORT_WRITE,
    SchoolPermission.CUSTOMIZATION_READ,
    SchoolPermission.ADMINS_READ,
)

# What only the principal may do.
_PRINCIPAL_ONLY_PERMISSIONS: tuple[SchoolPermission, ...] = (
    SchoolPermission.PERIODS_CLOSE,
    SchoolPermission.CUSTOMIZATION_WRITE,
    SchoolPermission.ADMINS_MANAGE,
    SchoolPermission.REPORTS_READ,
)

ROLE_PERMISSIONS: dict[SchoolAdminRole, tuple[SchoolPermission, ...]] = {
    SchoolAdminRole.PRINCIPAL: _COMMON_PERMISSIONS + _PRINCIPAL_ONLY_PERMISSIONS,
    SchoolAdminRole.SECUNDARIO: _COMMON_PERMISSIONS,
}

# Why an action is not available, in the words the person reads on the
# disabled control.
PERMISSION_LABELS: dict[SchoolPermission, str] = {
    SchoolPermission.DASHBOARD_READ: "Ver el panel del colegio",
    SchoolPermission.REPORTS_READ: "Ver los reportes de uso y exportarlos",
    SchoolPermission.MATERIAL_READ: "Consultar el material habilitado",
    SchoolPermission.TEACHERS_READ: "Ver los docentes",
    SchoolPermission.TEACHERS_WRITE: "Crear y editar docentes",
    SchoolPermission.STUDENTS_READ: "Ver los estudiantes",
    SchoolPermission.STUDENTS_WRITE: "Matricular y editar estudiantes",
    SchoolPermission.COURSES_READ: "Ver los cursos y las materias",
    SchoolPermission.COURSES_WRITE: "Crear y editar cursos y materias",
    SchoolPermission.ASSIGNMENTS_READ: "Ver las asignaciones",
    SchoolPermission.ASSIGNMENTS_WRITE: "Crear y editar asignaciones",
    SchoolPermission.PERIODS_READ: "Ver los períodos académicos",
    SchoolPermission.PERIODS_CLOSE: "Cerrar un período académico",
    SchoolPermission.ICFES_READ: "Ver los simulacros y sus resultados",
    SchoolPermission.ICFES_ACTIVATE: "Activar simulacros en los cursos del colegio",
    SchoolPermission.SUPPORT_WRITE: "Abrir solicitudes al equipo de Lumen",
    SchoolPermission.CUSTOMIZATION_READ: "Ver la identidad del colegio",
    SchoolPermission.CUSTOMIZATION_WRITE: "Cambiar la identidad del colegio",
    SchoolPermission.ADMINS_READ: "Ver el equipo de administradores",
    SchoolPermission.ADMINS_MANAGE: "Invitar y quitar administradores",
}


def permissions_for(role: SchoolAdminRole | None) -> list[str]:
    """The permissions of a rank, as the strings the frontend receives.

    A membership without a rank is treated as the principal one. The
    migration gives a rank to every administrator and a constraint
    forbids a membership of an administrator to have none, so this
    only covers the window in which a school would be left without
    somebody able to close a period.
    """
    if role is None:
        return [permission.value for permission in ROLE_PERMISSIONS[SchoolAdminRole.PRINCIPAL]]
    return [permission.value for permission in ROLE_PERMISSIONS[role]]


def has_permission(role: SchoolAdminRole | None, permission: SchoolPermission) -> bool:
    """Whether a rank may do something."""
    return permission.value in permissions_for(role)


def require_permission(
    role: SchoolAdminRole | None,
    permission: SchoolPermission,
) -> None:
    """Raise when a rank may not do something.

    The message says what the action is, so the frontend can show the
    reason on the disabled control instead of a generic refusal.
    """
    if not has_permission(role, permission):
        raise ForbiddenError(
            "Esta acción la hace el administrador principal del colegio.",
            code="permission_denied",
            extra={"permission": permission.value},
        )


__all__ = [
    "PERMISSION_LABELS",
    "ROLE_PERMISSIONS",
    "SchoolPermission",
    "has_permission",
    "permissions_for",
    "require_permission",
]
