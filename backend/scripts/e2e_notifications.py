"""End-to-end check of the notifications module against the local dev DB.

It drives the real HTTP API: register, bootstrap a school, invite a
teacher and a student, build the academic structure, and then walk the
five triggers, reading the bell of each user after every step.

Run it with the backend listening on :8010 and DATABASE_URL pointing at
the local dev database.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid

import httpx

BASE = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:8010")
PASSWORD = "ClaveDePrueba123"

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = "OK " if condition else "FAIL"
    print(f"  [{status}] {label}" + (f" — {detail}" if detail and not condition else ""))
    if not condition:
        failures.append(label)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def main() -> int:
    suffix = uuid.uuid4().hex[:8]
    admin_email = f"admin-notif-{suffix}@example.com"
    teacher_email = f"docente-notif-{suffix}@example.com"
    student_email = f"estudiante-notif-{suffix}@example.com"

    async with httpx.AsyncClient(base_url=BASE, timeout=30) as client:
        # --- the admin -----------------------------------------------------
        registered = await client.post(
            "/v1/auth/register",
            json={
                "email": admin_email,
                "password": PASSWORD,
                "full_name": "Admin de prueba",
            },
        )
        check("register the admin", registered.status_code == 201, registered.text)
        if registered.status_code != 201:
            return 1
        admin_token = registered.json()["tokens"]["access_token"]

        bootstrapped = await client.post(
            "/v1/schools/bootstrap",
            headers=auth(admin_token),
            json={
                "school_name": f"Colegio Notif {suffix}",
                "short_code": f"NF{suffix[:6].upper()}",
                "plan_code": "estandar",
            },
        )
        check("bootstrap the school", bootstrapped.status_code == 201, bootstrapped.text)
        if bootstrapped.status_code != 201:
            return 1

        # --- the teacher and the student -----------------------------------
        teacher_id = student_id = None
        for email, role in ((teacher_email, "teacher"), (student_email, "student")):
            invited = await client.post(
                "/v1/users/invitations",
                headers=auth(admin_token),
                json={"email": email, "full_name": email.split("@")[0], "role": role},
            )
            check(f"invite the {role}", invited.status_code == 201, invited.text)
            if invited.status_code == 201:
                if role == "teacher":
                    teacher_id = invited.json()["user_id"]
                else:
                    student_id = invited.json()["user_id"]

        if not teacher_id or not student_id:
            return 1

        await set_passwordes({teacher_id: teacher_email, student_id: student_email})

        async def login(email: str) -> str:
            response = await client.post(
                "/v1/auth/login", json={"email": email, "password": PASSWORD}
            )
            check(f"log in as {email}", response.status_code == 200, response.text)
            return response.json()["tokens"]["access_token"]

        teacher_token = await login(teacher_email)
        student_token = await login(student_email)

        # --- the academic structure ----------------------------------------
        course = await client.post(
            "/v1/academics/courses",
            headers=auth(admin_token),
            json={"name": "10mo A", "grade_label": "10"},
        )
        subject = await client.post(
            "/v1/academics/subjects",
            headers=auth(admin_token),
            json={"name": "Matematicas", "area": "Matematicas"},
        )
        check(
            "create the course and the subject",
            course.status_code == 201 and subject.status_code == 201,
        )
        if course.status_code != 201 or subject.status_code != 201:
            return 1

        course_id = course.json()["id"]
        subject_id = subject.json()["id"]

        course_subject = await client.post(
            "/v1/academics/course-subjects",
            headers=auth(admin_token),
            json={"course_id": course_id, "subject_id": subject_id},
        )
        check("offer the subject", course_subject.status_code == 201, course_subject.text)
        course_subject_id = course_subject.json()["id"]

        assignment = await client.post(
            "/v1/academics/teacher-assignments",
            headers=auth(admin_token),
            json={"course_subject_id": course_subject_id, "teacher_id": teacher_id},
        )
        check("assign the teacher", assignment.status_code == 201, assignment.text)

        enrollment = await client.post(
            "/v1/academics/student-enrollments",
            headers=auth(admin_token),
            json={"course_id": course_id, "student_id": student_id},
        )
        check("enroll the student", enrollment.status_code == 201, enrollment.text)

        # --- the trigger 1: a task posted ----------------------------------
        task = await client.post(
            "/v1/tasks",
            headers=auth(teacher_token),
            json={
                "title": "TP Ecuaciones",
                "description": "Resolver las ecuaciones del capitulo 3.",
                "course_subject_id": course_subject_id,
                "max_score": 100,
            },
        )
        check("the teacher posts a task", task.status_code == 201, task.text)
        task_id = task.json()["id"]

        rows = await notifications(client, student_token)
        check(
            "the student is told about the task",
            len(rows) == 1 and rows[0]["kind"] == "task_assigned",
            str(rows),
        )
        check(
            "the task notification has a title", bool(rows and "TP Ecuaciones" in rows[0]["title"])
        )
        check(
            "the task notification links to the tasks",
            bool(rows) and rows[0]["link"] == "/estudiante/tareas",
        )
        check(
            "the task notification carries the ids of the task",
            bool(rows) and rows[0]["payload"].get("task_id") == task_id,
            str(rows[0]["payload"]) if rows else "",
        )
        check(
            "the task notification carries the due date",
            bool(rows) and "due_at" in rows[0]["payload"],
        )

        # --- the trigger 2: a submission ------------------------------------
        submission = await client.post(
            "/v1/tasks/submissions",
            headers=auth(student_token),
            params={"task_id": task_id},
            json={"body": "Mi respuesta", "status": "submitted"},
        )
        check("the student submits the task", submission.status_code == 201, submission.text)
        submission_id = submission.json()["id"]

        teacher_rows = await notifications(client, teacher_token)
        check(
            "the teacher is told about the submission",
            len(teacher_rows) == 1 and teacher_rows[0]["kind"] == "task_submitted",
            str(teacher_rows),
        )

        # --- the trigger 3: a grading ---------------------------------------
        graded = await client.patch(
            f"/v1/tasks/submissions/{submission_id}",
            headers=auth(teacher_token),
            json={"grade": 85, "feedback": "Bien hecho", "status": "graded"},
        )
        check("the teacher grades the submission", graded.status_code == 200, graded.text)

        student_rows = await notifications(client, student_token)
        kinds = [row["kind"] for row in student_rows]
        check("the student is told about the grade", "task_graded" in kinds, str(kinds))

        # --- the trigger 4: new content --------------------------------------
        content = await client.post(
            "/v1/content/items",
            headers=auth(teacher_token),
            json={
                "title": "Clase 1: Ecuaciones",
                "kind": "text",
                "course_subject_id": course_subject_id,
                "body": "Contenido de la primera clase.",
            },
        )
        check("the teacher posts content", content.status_code == 201, content.text)

        student_rows = await notifications(client, student_token)
        kinds = [row["kind"] for row in student_rows]
        check("the student is told about the content", "content_published" in kinds, str(kinds))

        # --- the trigger 5: a chat message -----------------------------------
        conversation = await client.post(
            "/v1/chat/conversations",
            headers=auth(teacher_token),
            json={
                "title": "Grupo del grado",
                "kind": "group",
                "member_ids": [student_id],
            },
        )
        check(
            "the teacher opens a conversation", conversation.status_code == 201, conversation.text
        )
        conversation_id = conversation.json()["id"]

        sent = await client.post(
            f"/v1/chat/conversations/{conversation_id}/messages",
            headers=auth(teacher_token),
            json={"body": "Hola, revisen la tarea de ecuaciones"},
        )
        check("the teacher sends a message", sent.status_code == 201, sent.text)

        student_rows = await notifications(client, student_token)
        kinds = [row["kind"] for row in student_rows]
        check("the student is told about the message", "chat_message" in kinds, str(kinds))
        check(
            "the sender is not told about their own message",
            len(await notifications(client, teacher_token)) == 1,
        )

        # --- the preferences ------------------------------------------------
        preferences = await client.get("/v1/notifications/preferences", headers=auth(student_token))
        check("the preferences are readable", preferences.status_code == 200, preferences.text)
        entries = preferences.json()["preferences"]
        check(
            "every kind has a preference",
            {entry["kind"] for entry in entries}
            == {
                "task_assigned",
                "task_submitted",
                "task_graded",
                "content_published",
                "chat_message",
            },
            str(entries),
        )
        check(
            "the defaults are on in the app and off by email",
            all(entry["in_app"] for entry in entries)
            and not any(entry["email"] for entry in entries),
            str(entries),
        )

        changed = await client.patch(
            "/v1/notifications/preferences",
            headers=auth(student_token),
            json={"preferences": [{"kind": "task_graded", "in_app": False}]},
        )
        check("a preference is changed", changed.status_code == 200, changed.text)
        graded_entry = next(
            entry for entry in changed.json()["preferences"] if entry["kind"] == "task_graded"
        )
        check("the change is kept", graded_entry["in_app"] is False, str(graded_entry))
        check(
            "the change leaves the other channel alone",
            graded_entry["email"] is False,
            str(graded_entry),
        )

        # The student is graded, and the notification does not arrive:
        # the student turned that kind off. The comparison is against
        # the notifications the student already had, because the first
        # grading in this run did produce one.
        before_grading = [row["kind"] for row in await notifications(client, student_token)]

        posted = await client.post(
            "/v1/tasks",
            headers=auth(teacher_token),
            json={
                "title": "TP que no se avisa",
                "course_subject_id": str(course_subject_id),
            },
        )
        second_task_id = posted.json()["id"]

        submitted = await client.post(
            "/v1/tasks/submissions",
            headers=auth(student_token),
            params={"task_id": second_task_id},
            json={"body": "Otra respuesta", "status": "submitted"},
        )
        second_submission_id = submitted.json()["id"]

        await client.patch(
            f"/v1/tasks/submissions/{second_submission_id}",
            headers=auth(teacher_token),
            json={"grade": 90, "status": "graded"},
        )

        after_grading = [row["kind"] for row in await notifications(client, student_token)]
        check(
            "a kind turned off does not reach the user",
            after_grading.count("task_graded") == before_grading.count("task_graded"),
            f"before={before_grading} after={after_grading}",
        )

        # The teacher is unaffected: the preference is personal.
        teacher_kinds = [row["kind"] for row in await notifications(client, teacher_token)]
        check(
            "the preference does not silence anybody else",
            "task_submitted" in teacher_kinds,
            str(teacher_kinds),
        )

        # Turning it back on brings the notification back. It takes a
        # new grading: a submission that was already graded does not
        # notify twice.
        await client.patch(
            "/v1/notifications/preferences",
            headers=auth(student_token),
            json={"preferences": [{"kind": "task_graded", "in_app": True}]},
        )

        third = await client.post(
            "/v1/tasks",
            headers=auth(teacher_token),
            json={
                "title": "TP que si se avisa",
                "course_subject_id": str(course_subject_id),
            },
        )
        third_submission = await client.post(
            "/v1/tasks/submissions",
            headers=auth(student_token),
            params={"task_id": third.json()["id"]},
            json={"body": "Tercera respuesta", "status": "submitted"},
        )
        await client.patch(
            f"/v1/tasks/submissions/{third_submission.json()['id']}",
            headers=auth(teacher_token),
            json={"grade": 70, "status": "graded"},
        )

        after_grading = [row["kind"] for row in await notifications(client, student_token)]
        check(
            "a kind turned back on reaches the user again",
            after_grading.count("task_graded") == before_grading.count("task_graded") + 1,
            f"before={before_grading} after={after_grading}",
        )

        # --- the bell -------------------------------------------------------
        # The list is read again: the preferences section added more
        # notifications than the last read of it.
        student_rows = await notifications(client, student_token)

        counted = await client.get("/v1/notifications/unread-count", headers=auth(student_token))
        check(
            "the bell counts the unread ones",
            counted.json()["unread"] == len(student_rows),
            counted.text,
        )

        first_id = student_rows[0]["id"]
        marked = await client.post(
            f"/v1/notifications/{first_id}/read", headers=auth(student_token)
        )
        check(
            "marking one as read",
            marked.status_code == 200 and marked.json()["read_at"] is not None,
            marked.text,
        )

        counted = await client.get("/v1/notifications/unread-count", headers=auth(student_token))
        check("the count drops", counted.json()["unread"] == len(student_rows) - 1, counted.text)

        marked_all = await client.post("/v1/notifications/read-all", headers=auth(student_token))
        check(
            "marking everything as read",
            marked_all.json()["updated"] == len(student_rows) - 1,
            marked_all.text,
        )

        counted = await client.get("/v1/notifications/unread-count", headers=auth(student_token))
        check("nothing is left to read", counted.json()["unread"] == 0, counted.text)

        # --- the isolation ---------------------------------------------------
        other = await client.get("/v1/notifications", headers=auth(teacher_token))
        check(
            "the teacher only sees their own",
            all(row["kind"] != "task_graded" for row in other.json()),
            str(other.json()),
        )

    print()
    if failures:
        print(f"{len(failures)} check(s) failed: {failures}")
        return 1
    print("Every check passed.")
    return 0


async def notifications(client: httpx.AsyncClient, token: str) -> list[dict]:
    response = await client.get("/v1/notifications", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


async def set_passwordes(accounts: dict[str, str]) -> None:
    """Give the invited users a password, so they can log in.

    The invited accounts have no password yet: they would normally set
    one through the password-reset flow.
    """
    from sqlalchemy import update

    from app.core.security import hash_password
    from app.db.models import User
    from app.db.session import get_sessionmaker

    session_factory = get_sessionmaker()
    async with session_factory() as session:
        for user_id, _email in accounts.items():
            await session.execute(
                update(User)
                .where(User.id == uuid.UUID(user_id))
                .values(password_hash=hash_password(PASSWORD))
            )
        await session.commit()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
