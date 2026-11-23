"""The shapes of the school administrator's API."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class AdminUserOut(BaseModel):
    """The administrator's own account."""

    id: uuid.UUID
    email: str
    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class AdminSchoolOut(BaseModel):
    """The school the administrator runs.

    The plan is read, never changed: the admin sees which plan the
    school is on, but the subscription belongs to the platform team.
    """

    id: uuid.UUID
    name: str
    display_name: str | None = None
    short_code: str
    status: str
    logo_url: str | None = None
    primary_color: str | None = None
    plan_code: str | None = None
    plan_name: str | None = None


class CurrentPeriodOut(BaseModel):
    """The academic period the school is in."""

    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    # How the teaching is given: presencial, virtual or hibrida.
    delivery_modality: str | None = None
    closed_at: datetime | None = None


class SchoolAdminMe(BaseModel):
    """Everything the panel needs to know about the caller.

    `permissions` is the contract with the frontend: it decides what
    the interface shows. The frontend never decides on its own what a
    rank may do, and an action that is not allowed is disabled **with
    its reason**, not hidden.
    """

    user: AdminUserOut
    # principal or secundario. None when the caller is not an
    # administrator.
    admin_role: str | None = None
    school: AdminSchoolOut
    permissions: list[str] = Field(default_factory=list)
    current_period: CurrentPeriodOut | None = None


class MaterialAreaCount(BaseModel):
    """How much enabled material there is in one area."""

    area: str
    count: int


class MaterialOverview(BaseModel):
    """The material of the school.

    `catalog_total` is the size of the whole editorial catalog. The
    school is told how much of it it has, because the catalog is
    published on the public site.
    """

    available: int
    catalog_total: int
    by_area: list[MaterialAreaCount] = Field(default_factory=list)
    last_enabled_at: datetime | None = None


class TeachersOverview(BaseModel):
    """The community of teachers.

    `with_access` counts the teachers with at least one assignment:
    the assignment is what opens the material of a course.
    """

    total: int
    with_access: int
    pending: int


class StudentsOverview(BaseModel):
    """The students of the school."""

    total: int
    with_access: int
    courses: int


class TasksOverview(BaseModel):
    """The work waiting for the school."""

    pending: int
    stale: int


class PeriodOverview(BaseModel):
    """The period the school is in."""

    id: str
    name: str
    start_date: str
    end_date: str


class ActivityEntry(BaseModel):
    """One event of the recent activity of the school."""

    # The icon the interface draws: upload, layers, users or link.
    icon: str
    # The accent of the icon: success, info, teal or muted.
    tone: str
    title: str
    detail: str
    at: datetime


class MaterialCourseOut(BaseModel):
    """One course of the school a material applies to."""

    id: str
    name: str


class MaterialListItem(BaseModel):
    """One piece of the enabled material."""

    id: str
    # The short code shown in the table: C-1041.
    ref: str
    title: str
    description: str | None = None
    area: str
    kind: str
    file_size_bytes: int | None = None
    # When the platform enabled it for this school.
    available_since: datetime
    courses: list[MaterialCourseOut] = Field(default_factory=list)


class MaterialPage(BaseModel):
    """A page of the material of the school.

    The page comes from the server: the catalog of the platform is
    never pulled into the browser to be filtered there.
    """

    items: list[MaterialListItem] = Field(default_factory=list)
    total: int = 0
    # How much material the school has with no filters applied.
    available_total: int = 0
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=6, ge=1)
    pages: int = Field(default=0, ge=0)
    # The areas the school can filter by.
    areas: list[str] = Field(default_factory=list)


class MaterialAccess(BaseModel):
    """The access of the school to a material.

    The panel shows it as a confirmation. The switches that enable the
    material belong to the platform team, not to the school.
    """

    confirmed: bool
    enabled_at: datetime
    note: str


class MaterialDetailOut(MaterialListItem):
    """One material, with its access confirmed."""

    access: MaterialAccess


class SchoolOverview(BaseModel):
    """The whole dashboard of the school, in one call.

    The dashboard is the view that suffers the most in mobile, so it
    asks for everything at once instead of four round trips.
    """

    material: MaterialOverview
    teachers: TeachersOverview
    students: StudentsOverview
    tasks: TasksOverview
    courses: int
    period: PeriodOverview | None = None
    activity: list[ActivityEntry] = Field(default_factory=list)


__all__ = [
    "ActivityEntry",
    "AdminSchoolOut",
    "AdminUserOut",
    "CurrentPeriodOut",
    "MaterialAccess",
    "MaterialAreaCount",
    "MaterialCourseOut",
    "MaterialDetailOut",
    "MaterialListItem",
    "MaterialOverview",
    "MaterialPage",
    "PeriodOverview",
    "SchoolAdminMe",
    "SchoolOverview",
    "StudentsOverview",
    "TeachersOverview",
    "TasksOverview",
]


class TeacherListItem(BaseModel):
    """One teacher of the school, with its access to the content."""

    membership_id: str
    user_id: str
    full_name: str | None = None
    email: str | None = None
    joined_at: datetime
    revoked_at: datetime | None = None
    account_activated: bool = False
    # The courses the teacher teaches and the subjects of each one.
    courses: list[str] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)
    # The course subjects of the teacher, by id: the edit form works
    # with ids, not with names.
    course_subject_ids: list[str] = Field(default_factory=list)
    # `activado` or `pendiente`: one signal, not two loose badges.
    access: str = "pendiente"
    # Why the access is pending, in the words of the panel.
    access_reason: str | None = None
    # `activo` or `inactivo`: whether the member belongs to the school.
    status: str = "activo"


class StudentListItem(BaseModel):
    """One student of the school, with its course and its average."""

    membership_id: str
    user_id: str
    full_name: str | None = None
    email: str | None = None
    joined_at: datetime
    revoked_at: datetime | None = None
    account_activated: bool = False
    courses: list[str] = Field(default_factory=list)
    # The courses of the student, by id: the edit form works with ids,
    # not with names.
    course_ids: list[str] = Field(default_factory=list)
    # `null` when the student has no grades: it is not a zero.
    average: float | None = None
    access: str = "pendiente"
    access_reason: str | None = None
    status: str = "activo"


class MemberPage(BaseModel):
    """A page of the community of the school.

    The page comes from the server: the list is never pulled into the
    browser to be filtered there.
    """

    items: list[TeacherListItem | StudentListItem] = Field(default_factory=list)
    total: int = 0
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=10, ge=1)
    pages: int = Field(default=0, ge=0)


class MemberEditIn(BaseModel):
    """What the admin can change of a member of the community.

    What is not sent is left alone: the form of the admin sends the
    name, the email and the courses (of a student) or the course
    subjects (of a teacher).
    """

    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    # The courses a student is enrolled in.
    course_ids: list[uuid.UUID] | None = None
    # The course subjects a teacher is assigned to.
    course_subject_ids: list[uuid.UUID] | None = None


class MemberEditOut(BaseModel):
    """The member, after the edit."""

    membership_id: str
    user_id: str
    role: str
    full_name: str | None = None
    email: str | None = None
    course_ids: list[str] = Field(default_factory=list)
    course_subject_ids: list[str] = Field(default_factory=list)


class CourseOut(BaseModel):
    """One course of the school, with the structure it holds."""

    id: str
    name: str
    grade_label: str
    subject_count: int = 0
    teacher_count: int = 0
    student_count: int = 0
    status: str = "activo"


class SubjectOut(BaseModel):
    """One subject of the school, with the courses it is taught in."""

    id: str
    name: str
    area: str | None = None
    course_count: int = 0
    courses: list[str] = Field(default_factory=list)


class AssignmentOut(BaseModel):
    """One assignment: a teacher, a course and a subject.

    `visible_materials_count` says how many pieces of material that
    teacher sees through this assignment. It is counted in the server:
    the published material of the area of the subject, enabled for the
    school, that applies to the course.
    """

    id: str
    teacher_id: str
    # The course subject the assignment points to: the edit form needs it
    # to change the row without losing the link.
    course_subject_id: str
    teacher_name: str | None = None
    teacher_email: str | None = None
    teacher_avatar_url: str | None = None
    course_id: str
    course_name: str
    subject_id: str
    subject_name: str
    subject_area: str | None = None
    visible_materials_count: int = 0


class PeriodOut(BaseModel):
    """One academic period of the school."""

    id: str
    name: str
    start_date: date
    end_date: date
    # The length of the cycle: trimestre, semester or year.
    modality: str
    # How the cycle is taught: presencial, virtual or hybrid.
    delivery_modality: str | None = None
    # vigente, cerrado or future.
    status: str = "cerrado"
    is_current: bool = False
    closed_at: datetime | None = None


class PeriodClosedOut(BaseModel):
    """The answer of a close: what happened, in the words of the panel."""

    id: str
    name: str
    closed_at: datetime
    # How many pieces of material left the active material of the school.
    archived_materials: int = 0


class PeriodCurrentOut(BaseModel):
    """The answer of marking a period as the current one."""

    id: str
    name: str
    # The periods that were closed to make room for this one.
    closed_previous: list[str] = Field(default_factory=list)


class ContrastOut(BaseModel):
    """The contrast of the primary colour of the school.

    The backend calculates it: the ratio against the background of the
    panel and against the surface of the cards, and the minimum of the
    two. The interface shows it next to the colour.
    """

    background_ratio: float
    surface_ratio: float
    min_ratio: float
    minimum: float = 4.5


class SchoolIdentityOut(BaseModel):
    """The visible identity of the school."""

    display_name: str
    name: str
    logo_url: str | None = None
    primary_color: str | None = None
    contrast: ContrastOut | None = None


class SchoolIdentityUpdate(BaseModel):
    """What the school can change of its identity."""

    display_name: str | None = None
    primary_color: str | None = None


class AdminPermissionOut(BaseModel):
    """One thing the rank of an administrator may do."""

    permission: str
    label: str


class AdminOut(BaseModel):
    """One administrator of the school, with its rank."""

    membership_id: str
    user_id: str
    full_name: str
    email: str | None = None
    joined_at: datetime
    # principal or secundario.
    admin_role: str = "secundario"
    # activo or inactivo.
    status: str = "activo"
    account_activated: bool = False
    # What this rank may do, spelled out instead of implicit.
    permissions: list[AdminPermissionOut] = Field(default_factory=list)


class AdminInviteIn(BaseModel):
    """The invitation of an administrator of the school."""

    email: str
    full_name: str
    # principal or secundario. The school keeps one principal.
    admin_role: str = "secundario"


class AdminRankIn(BaseModel):
    """The new rank of an administrator."""

    admin_role: str


class AdminInviteOut(BaseModel):
    """The answer of an invitation.

    The activation token travels back to the administrator: there is no
    email provider yet, and the link is what the new administrator
    uses to set their password.
    """

    user_id: str
    email: str
    membership_id: str
    admin_role: str
    activation_token: str | None = None


class SimulatorActivationOut(BaseModel):
    """One course where a simulator of the school runs."""

    course_id: str
    course_name: str
    deadline: date
    activated_at: datetime


class SimulatorOut(BaseModel):
    """A simulator of the catalog that the platform enabled for the school."""

    id: str
    code: str
    name: str
    grade: str
    question_count: int = 0
    duration_min: int = 0
    scheduled_at: date | None = None
    # publicado, en_curso or cerrado.
    status: str = "publicado"
    # Null until the exam is corrected.
    average_score: float | None = None
    enabled_at: datetime | None = None
    activated: bool = False
    activations: list[SimulatorActivationOut] = Field(default_factory=list)


class GradeAverageOut(BaseModel):
    """The average score of a grade, on the scale of the exam."""

    grade: str
    average_score: float
    # The score of the last cut of the grade.
    latest_average: float = 0
    # The score of the cut before it, when there is one.
    previous_average: float | None = None
    # How many points the last cut gained over the previous one.
    delta: float | None = None


class IcfesKpisOut(BaseModel):
    """The indicators of the ICFES view."""

    available: int = 0
    not_activated: int = 0
    activated: int = 0
    activated_courses: int = 0
    averages_by_grade: list[GradeAverageOut] = Field(default_factory=list)
    max_score: int = 500


class IcfesSimulatorsOut(BaseModel):
    """The simulators enabled for the school, with their indicators."""

    items: list[SimulatorOut] = Field(default_factory=list)
    kpis: IcfesKpisOut = Field(default_factory=IcfesKpisOut)


class ActivationIn(BaseModel):
    """What the school asks for when it activates a simulator."""

    # The courses where the simulator runs. One or more.
    course_ids: list[uuid.UUID] = Field(min_length=1)
    deadline: date


class ActivationCreatedOut(BaseModel):
    """The answer of an activation."""

    simulator_id: str
    courses: list[str] = Field(default_factory=list)
    deadline: date


class SimulatorResultCourseOut(BaseModel):
    """The result of a simulator in one of its courses."""

    course_id: str
    course_name: str
    deadline: date
    activated_at: datetime
    students: int = 0
    average_score: float | None = None


class SimulatorResultsOut(BaseModel):
    """A simulator with the result of each course it runs in."""

    id: str
    code: str
    name: str
    grade: str
    question_count: int = 0
    duration_min: int = 0
    scheduled_at: date | None = None
    status: str = "publicado"
    average_score: float | None = None
    max_score: int = 500
    courses: list[SimulatorResultCourseOut] = Field(default_factory=list)


class SupportMessageOut(BaseModel):
    """One message of the thread of a case."""

    id: str
    author_id: str | None = None
    # colegio or plataforma.
    author_role: str = "colegio"
    author_name: str = ""
    body: str
    # The files the author attached to the message.
    attachment_ids: list[str] = Field(default_factory=list)
    created_at: datetime


class SupportCaseSummaryOut(BaseModel):
    """One request of the school, as it appears in the list."""

    id: str
    code: str
    title: str
    category: str = "otro"
    channel: str = "formulario_colegio"
    level: str = "info"
    # abierto, en_espera or resuelto.
    status: str = "abierto"
    opened_at: datetime
    opened_by: str | None = None
    opened_by_name: str = "Colegio"
    # How many messages the thread has.
    messages: int = 0


class SupportCaseOut(BaseModel):
    """One request of the school, with its thread."""

    id: str
    code: str
    title: str
    category: str = "otro"
    channel: str = "formulario_colegio"
    level: str = "info"
    status: str = "abierto"
    opened_at: datetime
    resolved_at: datetime | None = None
    opened_by: str | None = None
    opened_by_name: str = "Colegio"
    messages: list[SupportMessageOut] = Field(default_factory=list)


class SupportCaseIn(BaseModel):
    """What the school writes when it opens a request."""

    title: str
    # problema_tecnico, solicitud_material, duda_acceso or otro.
    category: str = "otro"
    body: str
    # The files the admin attached to the request.
    attachment_ids: list[str] = Field(default_factory=list)


class SupportMessageIn(BaseModel):
    """What the school adds to the thread of a case."""

    body: str
    # The files the admin attached to the message.
    attachment_ids: list[str] = Field(default_factory=list)


class SupportAttachmentOut(BaseModel):
    """A file uploaded to attach to a request."""

    # The path of the file in the store: it is what the thread keeps.
    id: str
    name: str
    size: int = 0
    url: str = ""
