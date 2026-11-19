"""Unit tests for the ICFES scoring pure functions.

The fixtures below reproduce the questions and answer keys from
src/lib/icfes-data.ts (the bank that was shipped before Phase 6) so
that the global and per-area scores can be asserted exactly. The
'puntaje_global' value matches the original exam.tsx rounding rule
(round(percent * 5)).
"""

from __future__ import annotations

from app.icfes.scoring import (
    IcfesAttemptScore,
    IcfesQuestionInput,
    score_attempt,
)


def fixture_questions() -> list[IcfesQuestionInput]:
    """The first ten questions from src/lib/icfes-data.ts initialQuestions."""
    return [
        IcfesQuestionInput(id="q1", area="Lectura crítica"),
        IcfesQuestionInput(id="q2", area="Matemáticas"),
        IcfesQuestionInput(id="q3", area="Ciencias naturales"),
        IcfesQuestionInput(id="q4", area="Sociales y ciudadanas"),
        IcfesQuestionInput(id="q5", area="Inglés"),
        IcfesQuestionInput(id="q6", area="Matemáticas"),
        IcfesQuestionInput(id="q7", area="Ciencias naturales"),
        IcfesQuestionInput(id="q8", area="Lectura crítica"),
        IcfesQuestionInput(id="q9", area="Sociales y ciudadanas"),
        IcfesQuestionInput(id="q10", area="Inglés"),
    ]


def fixture_correct() -> dict[str, int]:
    """The correct_index values match icfes-data.ts (see correcta per id)."""
    return {
        "q1": 1,
        "q2": 2,
        "q3": 1,
        "q4": 2,
        "q5": 2,
        "q6": 1,
        "q7": 0,
        "q8": 1,
        "q9": 1,
        "q10": 1,
    }


def test_score_attempt_returns_zero_when_no_questions():
    result = score_attempt([], {}, {})
    assert result == IcfesAttemptScore(
        global_score=0.0,
        max_score=0.0,
        percent=0.0,
        puntaje_global=0,
        by_area={},
        correct_count=0,
        question_count=0,
    )


def test_score_attempt_perfect_run():
    chosen = {q.id: fixture_correct()[q.id] for q in fixture_questions()}
    result = score_attempt(fixture_questions(), chosen, fixture_correct())
    assert result.global_score == 10.0
    assert result.max_score == 10.0
    assert result.percent == 100.0
    assert result.puntaje_global == 500
    assert result.correct_count == 10
    assert result.question_count == 10
    # 5 areas, each with 2 correct, 2 total (well, except for Ciencias
    # naturales which also has 2: q3 and q7).
    expected_areas = {
        "Lectura crítica": (2, 2),
        "Matemáticas": (2, 2),
        "Ciencias naturales": (2, 2),
        "Sociales y ciudadanas": (2, 2),
        "Inglés": (2, 2),
    }
    for area, (correct, total) in expected_areas.items():
        assert area in result.by_area
        assert result.by_area[area].correct == correct
        assert result.by_area[area].total == total
        assert result.by_area[area].percent == 100.0


def test_score_attempt_partial_run():
    # q1 right, q2 wrong, q3 right, rest skipped (None)
    correct = fixture_correct()
    chosen = {
        "q1": correct["q1"],
        "q2": (correct["q2"] + 1) % 4,  # deliberately wrong
        "q3": correct["q3"],
    }
    result = score_attempt(fixture_questions(), chosen, correct)
    assert result.correct_count == 2
    assert result.global_score == 2.0
    assert result.percent == 20.0
    assert result.puntaje_global == round(20 * 5)  # 100
    # Per-area breakdown
    assert result.by_area["Lectura crítica"].correct == 1
    assert result.by_area["Lectura crítica"].total == 2
    assert result.by_area["Matemáticas"].correct == 0
    assert result.by_area["Matemáticas"].total == 2
    assert result.by_area["Ciencias naturales"].correct == 1
    assert result.by_area["Ciencias naturales"].total == 2


def test_score_attempt_handles_skipped_questions():
    chosen: dict[str, int | None] = {}  # student skipped everything
    result = score_attempt(fixture_questions(), chosen, fixture_correct())
    assert result.correct_count == 0
    assert result.global_score == 0.0
    assert result.percent == 0.0
    assert result.puntaje_global == 0
    assert all(s.correct == 0 for s in result.by_area.values())


def test_score_attempt_respects_question_points():
    questions = [
        IcfesQuestionInput(id="hard", area="Matemáticas", points=3.0),
        IcfesQuestionInput(id="easy", area="Matemáticas", points=1.0),
    ]
    correct = {"hard": 0, "easy": 0}
    chosen = {"hard": 0, "easy": 1}  # got the hard, missed the easy
    result = score_attempt(questions, chosen, correct)
    assert result.global_score == 3.0
    assert result.max_score == 4.0
    assert result.percent == 75.0
    assert result.puntaje_global == round(75 * 5)  # 375


def test_score_attempt_percent_zero_when_max_score_zero():
    # Defensive: question with points=0 should not divide by zero.
    questions = [IcfesQuestionInput(id="zero", area="X", points=0)]
    result = score_attempt(questions, {"zero": 0}, {"zero": 0})
    assert result.max_score == 0.0
    assert result.percent == 0.0
    assert result.puntaje_global == 0


def test_score_attempt_is_pure():
    """Same inputs must always produce the same output (no hidden state)."""
    chosen = {"q1": 1, "q2": 2}
    questions = [
        IcfesQuestionInput(id="q1", area="A"),
        IcfesQuestionInput(id="q2", area="A"),
    ]
    correct = {"q1": 1, "q2": 3}
    first = score_attempt(questions, chosen, correct)
    second = score_attempt(questions, chosen, correct)
    assert first == second
