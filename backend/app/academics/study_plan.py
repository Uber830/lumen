"""The study plan of the school.

The admin of a school does not build the curriculum course by course:
they pick the grades of the plan and the platform creates the courses
with their subjects already offered.

This module holds the plans the platform offers. They are the default
curriculum of the platform (grades six to ten); the endpoint that reads
them tells the frontend which ones already exist, so nothing is
duplicated when the admin imports a plan twice.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StudyPlan:
    """One grade of the study plan.

    ``subjects`` is a tuple of (subject name, area) pairs: the subject
    is created the first time a plan that needs it is imported, and it
    is reused afterwards.
    """

    course_name: str
    grade_label: str
    subjects: tuple[tuple[str, str], ...]


# The subjects the plans are built from. Keeping them in one place makes
# the plan readable and keeps the areas consistent between plans.
_MATH = ("Matemáticas", "Matemáticas")
_LANGUAGE = ("Lengua Castellana", "Lenguaje")
_SCIENCE = ("Ciencias", "Ciencias")
_SOCIAL = ("Sociales", "Sociales")
_ENGLISH = ("Inglés", "Inglés")
_PHYSICS = ("Física", "Física")


STUDY_PLANS: tuple[StudyPlan, ...] = (
    StudyPlan(
        course_name="6° A",
        grade_label="Sexto",
        subjects=(_MATH, _LANGUAGE, _SCIENCE),
    ),
    StudyPlan(
        course_name="7° A",
        grade_label="Séptimo",
        subjects=(_MATH, _LANGUAGE, _SCIENCE, _SOCIAL),
    ),
    StudyPlan(
        course_name="8° B",
        grade_label="Octavo",
        subjects=(_MATH, _LANGUAGE, _SCIENCE, _SOCIAL, _ENGLISH),
    ),
    StudyPlan(
        course_name="9° A",
        grade_label="Noveno",
        subjects=(_MATH, _LANGUAGE, _SCIENCE, _SOCIAL),
    ),
    StudyPlan(
        course_name="10° A",
        grade_label="Décimo",
        subjects=(_MATH, _LANGUAGE, _SCIENCE, _SOCIAL, _PHYSICS),
    ),
)


def find_plan(course_name: str) -> StudyPlan | None:
    """The plan of a course name, or None when the name is not in the plan."""
    wanted = course_name.strip()
    for plan in STUDY_PLANS:
        if plan.course_name == wanted:
            return plan
    return None


__all__ = ["STUDY_PLANS", "StudyPlan", "find_plan"]
