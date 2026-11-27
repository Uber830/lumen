"""ICFES scoring module.

Pure functions: no I/O, no calls to the database. These are exercised against
fixtures by tests/test_icfes_scoring.py.

The scoring rules follow the convention used by the original
src/components/icfes/exam.tsx before Phase 6:

- Each question is worth `points` (defaults to 1.0).
- A student is correct when chosen_index == correct_index.
- global_score = sum(correct points)
- max_score = sum(all points) -- respects per-question weights.
- percent = 100 * global_score / max_score  (0 if no questions).
- The global score is also exposed on a 0-500 scale as
  `puntaje_global = round(percent * 5)`, matching the original UI.
- Per-area breakdown: same totals grouped by question.area.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class IcfesQuestionInput:
    id: str
    area: str
    points: float = 1.0


@dataclass(frozen=True, slots=True)
class IcfesAreaScore:
    area: str
    correct: int
    total: int
    percent: float


@dataclass(frozen=True, slots=True)
class IcfesAttemptScore:
    global_score: float
    max_score: float
    percent: float
    puntaje_global: int  # 0-500 scale
    by_area: dict[str, IcfesAreaScore]
    correct_count: int
    question_count: int


def score_attempt(
    questions: list[IcfesQuestionInput],
    chosen_answers: Mapping[str, int | None],
    correct_answers: Mapping[str, int],
) -> IcfesAttemptScore:
    """Compute the score of an ICFES attempt.

    chosen_answers maps question_id to the option index the student
    chose (or None if they skipped). correct_answers maps question_id
    to the correct option index. A question counts as correct only if
    chosen_answers[question_id] == correct_answers[question_id].

    Both mappings are read-only, so `Mapping` is used rather than
    `dict`: a caller holding a `dict[str, int]` can pass it directly.
    """
    if not questions:
        return IcfesAttemptScore(
            global_score=0.0,
            max_score=0.0,
            percent=0.0,
            puntaje_global=0,
            by_area={},
            correct_count=0,
            question_count=0,
        )

    by_area: dict[str, IcfesAreaScore] = {}
    global_score = 0.0
    max_score = 0.0
    correct_count = 0

    for q in questions:
        max_score += q.points
        area_total = by_area.get(q.area)
        if area_total is None:
            area_total = IcfesAreaScore(
                area=q.area,
                correct=0,
                total=0,
                percent=0.0,
            )
            by_area[q.area] = area_total

        # mutate the totals (dataclass is frozen so we rebuild)
        chosen = chosen_answers.get(q.id)
        is_correct = (
            chosen is not None
            and correct_answers.get(q.id) is not None
            and chosen == correct_answers.get(q.id)
        )
        if is_correct:
            global_score += q.points
            correct_count += 1
            area_correct = area_total.correct + 1
        else:
            area_correct = area_total.correct
        by_area[q.area] = IcfesAreaScore(
            area=q.area,
            correct=area_correct,
            total=area_total.total + 1,
            percent=(
                100.0 * area_correct / (area_total.total + 1) if area_total.total + 1 > 0 else 0.0
            ),
        )

    percent = (100.0 * global_score / max_score) if max_score > 0 else 0.0
    puntaje_global = round(percent * 5)

    # recompute the per-area percent once totals are final
    final_by_area: dict[str, IcfesAreaScore] = {}
    for area, agg in by_area.items():
        pct = (100.0 * agg.correct / agg.total) if agg.total > 0 else 0.0
        final_by_area[area] = IcfesAreaScore(
            area=area, correct=agg.correct, total=agg.total, percent=pct
        )

    return IcfesAttemptScore(
        global_score=global_score,
        max_score=max_score,
        percent=percent,
        puntaje_global=puntaje_global,
        by_area=final_by_area,
        correct_count=correct_count,
        question_count=len(questions),
    )
