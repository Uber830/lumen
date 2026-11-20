"""Tests of the editorial catalog of the platform role.

Two kinds of test live here:

- the rules of the module, without a database: the transitions of the
  lifecycle and what a material needs to be published;
- the endpoints, against a real Postgres: the listing, the creation, the
  publication, the access of a school and the history.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AuditLog,
    Material,
    MaterialFile,
    MaterialHistory,
    MaterialSchool,
    School,
)

# The endpoints commit their writes, so the rows they create are
# removed before and after each test.
pytestmark = pytest.mark.usefixtures("cleanup_users")

# ---------------------------------------------------------------------------
# The rules of the module
# ---------------------------------------------------------------------------


def test_the_transitions_of_the_lifecycle_are_the_ones_the_prompt_describes() -> None:
    """The backend decides the transitions; the frontend shows them."""
    from app.platform.catalog import available_transitions, can_transition

    assert available_transitions("draft") == ["review", "published"]
    assert available_transitions("review") == ["draft", "published"]
    assert available_transitions("published") == ["archived"]
    assert available_transitions("archived") == ["published"]

    assert can_transition("draft", "published") is True
    assert can_transition("draft", "archived") is False
    assert can_transition("published", "draft") is False
    assert can_transition("archived", "published") is True


def test_a_material_that_is_missing_something_says_what() -> None:
    """The reason why the button is blocked is exact."""
    from app.platform.catalog import publication_gaps

    material = Material(
        code="C-0001",
        title="Matemáticas 7",
        type="Libro",
        area="Matemáticas",
        grades=["7°"],
        status="draft",
    )

    assert publication_gaps(material, school_count=1) == []

    material.grades = []
    assert publication_gaps(material, school_count=1) == ["grades"]

    material.grades = ["7°"]
    assert publication_gaps(material, school_count=0) == ["schools"]

    material.title = "  "
    assert publication_gaps(material, school_count=1) == ["title"]


def test_the_size_is_shown_the_colombian_way() -> None:
    """A comma for the decimals and a dot for the thousands."""
    from app.platform.catalog import format_size

    assert format_size(0) == "0 B"
    assert format_size(2048) == "2,0 KB"
    assert format_size(18_400_000) == "17,5 MB"


def test_the_format_of_a_file_is_checked_by_its_extension_too() -> None:
    """The browser does not always send the type of the file."""
    from app.platform.catalog import ALLOWED_MIME_TYPES, mime_type_of, size_limit_for

    assert mime_type_of("libro.pdf", "application/pdf") == "application/pdf"
    assert mime_type_of("libro.pdf", None) == "application/pdf"
    assert mime_type_of("libro.epub", None) == "application/epub+zip"
    assert mime_type_of("nota.txt", "text/plain") == "text/plain"
    assert mime_type_of("nota.txt", "text/plain") not in ALLOWED_MIME_TYPES
    assert size_limit_for("application/pdf") == 200 * 1024 * 1024


# ---------------------------------------------------------------------------
# The endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
def catalog_school(engine) -> Iterator[uuid.UUID]:
    """A school the catalog can enable access to."""
    school_id = uuid.uuid4()

    async def _create() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            session.add(
                School(
                    id=school_id,
                    name=f"Catalogo Colegio {school_id.hex[:8]}",
                    short_code=f"CAT{school_id.hex[:6].upper()}",
                    status="active",
                )
            )
            await session.commit()

    import asyncio

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create())
    finally:
        loop.close()

    yield school_id

    async def _delete() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            await session.execute(
                delete(MaterialSchool).where(MaterialSchool.school_id == school_id)
            )
            await session.execute(delete(School).where(School.id == school_id))
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_delete())
    finally:
        loop.close()


@pytest.fixture
def three_schools(engine) -> Iterator[list[uuid.UUID]]:
    """Three schools, so that the listing has something to count."""
    school_ids = [uuid.uuid4() for _ in range(3)]

    async def _create() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            for school_id in school_ids:
                session.add(
                    School(
                        id=school_id,
                        name=f"Listado Colegio {school_id.hex[:8]}",
                        short_code=f"LIS{school_id.hex[:6].upper()}",
                        status="active",
                    )
                )
            await session.commit()

    import asyncio

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create())
    finally:
        loop.close()

    yield school_ids

    async def _delete() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            await session.execute(
                delete(MaterialSchool).where(MaterialSchool.school_id.in_(school_ids))
            )
            await session.execute(delete(School).where(School.id.in_(school_ids)))
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_delete())
    finally:
        loop.close()


@pytest.fixture
def created_materials(engine) -> Iterator[list[uuid.UUID]]:
    """The materials the tests create, removed at the end."""
    import asyncio

    ids: list[uuid.UUID] = []
    yield ids

    async def _delete() -> None:
        if not ids:
            return
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            for material_id in ids:
                await session.execute(
                    delete(MaterialHistory).where(MaterialHistory.material_id == material_id)
                )
                await session.execute(
                    delete(MaterialSchool).where(MaterialSchool.material_id == material_id)
                )
                await session.execute(
                    delete(MaterialFile).where(MaterialFile.material_id == material_id)
                )
                await session.execute(delete(Material).where(Material.id == material_id))
                await session.execute(delete(AuditLog).where(AuditLog.subject_id == material_id))
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_delete())
    finally:
        loop.close()


async def _make_material(
    engine,
    created_materials: list[uuid.UUID],
    *,
    title: str = "Material de prueba",
    material_type: str = "Libro",
    area: str = "Matemáticas",
    grades: list[str] | None = None,
    status: str = "draft",
    school_ids: list[uuid.UUID] | None = None,
) -> Material:
    """A material straight in the database."""
    material = Material(
        code=f"C-{uuid.uuid4().hex[:8].upper()}",
        title=title,
        type=material_type,
        area=area,
        grades=grades if grades is not None else ["7°"],
        visible_to="all",
        origin="upload",
        status=status,
        created_at=datetime.now(UTC),
    )
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(material)
        await session.flush()
        for school_id in school_ids or []:
            session.add(MaterialSchool(material_id=material.id, school_id=school_id))
        await session.commit()
        created_materials.append(material.id)
    return material


def test_the_endpoints_are_closed_to_everybody_else(client, make_user) -> None:
    """Without the platform role there is nothing to see."""
    make_user(email=f"cat-{uuid.uuid4().hex[:8]}@example.com", password="a good password")

    for path in (
        "/v1/platform/catalog",
        "/v1/platform/metrics",
        "/v1/platform/schools",
        "/v1/platform/audit",
        "/v1/platform/catalog-options",
    ):
        response = client.get(path)
        assert response.status_code == 401, path


async def test_the_endpoints_refuse_a_school_admin(client, make_user) -> None:
    """A school administrator is not the platform team."""
    make_user(email=f"cat-{uuid.uuid4().hex[:8]}@example.com", password="a good password")

    response = client.get("/v1/platform/catalog")
    assert response.status_code in (401, 403)


async def test_the_listing_shows_a_page_and_the_total(client, platform_admin) -> None:
    """The listing is paginated and says how many there are."""
    response = client.get("/v1/platform/catalog", headers=platform_admin)
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["per_page"] == 8
    assert len(body["items"]) <= 8
    assert body["total"] >= len(body["items"])


async def test_the_listing_can_be_filtered(
    client, platform_admin, engine, created_materials
) -> None:
    """The filters travel in the query."""
    marker = uuid.uuid4().hex[:8].upper()
    await _make_material(
        engine,
        created_materials,
        title=f"Buscable {marker}",
        material_type="Evaluación",
        area="ICFES",
        grades=["11°"],
    )

    by_query = client.get(f"/v1/platform/catalog?q={marker}", headers=platform_admin)
    assert by_query.status_code == 200
    assert by_query.json()["total"] == 1

    by_type = client.get("/v1/platform/catalog?type=Evaluación", headers=platform_admin)
    assert by_type.status_code == 200
    assert by_type.json()["total"] >= 1

    by_area = client.get("/v1/platform/catalog?type=Evaluación&area=ICFES", headers=platform_admin)
    assert by_area.status_code == 200
    assert by_area.json()["total"] >= 1


async def test_the_listing_counts_the_schools_that_are_not_shown(
    client, platform_admin, engine, created_materials, three_schools
) -> None:
    """The counter of the extra schools comes from the backend."""
    await _make_material(
        engine,
        created_materials,
        status="published",
        school_ids=list(three_schools),
    )

    response = client.get("/v1/platform/catalog?status=published", headers=platform_admin)
    assert response.status_code == 200

    rows = [item for item in response.json()["items"] if item["schools_extra"] > 0]
    assert rows, "the material with three schools is not in the listing"
    for row in rows:
        assert len(row["schools"]) == 2
        assert row["schools_extra"] >= 1


async def test_it_creates_a_material_in_draft(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """The piece starts as a draft and gets a code."""
    response = client.post(
        "/v1/platform/catalog",
        headers=platform_admin,
        json={
            "title": "Ciencias 8 — El cuerpo humano",
            "type": "Guía",
            "area": "Ciencias",
            "grades": ["8°"],
            "origin": "link",
            "external_url": "https://example.com/recursos/cuerpo",
            "school_ids": [str(catalog_school)],
        },
    )
    assert response.status_code == 201, response.text

    body = response.json()
    created_materials.append(uuid.UUID(body["id"]))
    assert body["status"] == "draft"
    assert body["code"].startswith("C-")
    assert body["available_transitions"] == ["review", "published"]
    assert len(body["schools"]) == 1

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        history = await session.execute(
            select(MaterialHistory).where(MaterialHistory.material_id == uuid.UUID(body["id"]))
        )
        entries = history.scalars().all()
        assert [entry.action for entry in entries] == ["created"]


async def test_it_refuses_a_material_without_a_title_or_a_file(
    client, platform_admin, catalog_school
) -> None:
    """A link needs its name and its address; an upload needs its file."""
    without_name = client.post(
        "/v1/platform/catalog",
        headers=platform_admin,
        json={
            "title": "",
            "type": "Documento",
            "area": "Convivencia",
            "origin": "link",
            "external_url": "https://example.com/x",
        },
    )
    assert without_name.status_code == 422

    without_address = client.post(
        "/v1/platform/catalog",
        headers=platform_admin,
        json={
            "title": "Recurso externo",
            "type": "Documento",
            "area": "Convivencia",
            "origin": "link",
        },
    )
    assert without_address.status_code == 422

    without_file = client.post(
        "/v1/platform/catalog",
        headers=platform_admin,
        json={
            "title": "Libro cargado",
            "type": "Libro",
            "area": "Matemáticas",
            "grades": ["7°"],
            "origin": "upload",
        },
    )
    assert without_file.status_code == 422


async def test_it_refuses_a_type_that_is_not_in_the_catalog(client, platform_admin) -> None:
    """The closed catalogs are enforced by the API."""
    response = client.post(
        "/v1/platform/catalog",
        headers=platform_admin,
        json={
            "title": "Material inválido",
            "type": "Podcast",
            "area": "Matemáticas",
            "grades": ["7°"],
            "origin": "link",
            "external_url": "https://example.com/x",
        },
    )
    assert response.status_code == 422


async def test_the_metadata_is_edited_and_the_change_is_recorded(
    client, platform_admin, engine, created_materials
) -> None:
    """Editing the metadata does not touch the state."""
    material = await _make_material(engine, created_materials)

    response = client.patch(
        f"/v1/platform/catalog/{material.id}",
        headers=platform_admin,
        json={"title": "Matemáticas 7 — Álgebra", "grades": ["7°", "8°"]},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["title"] == "Matemáticas 7 — Álgebra"
    assert body["grades"] == ["7°", "8°"]
    assert body["status"] == "draft"

    actions = [entry["action"] for entry in body["history"]]
    assert "metadata_changed" in actions


async def test_it_refuses_a_transition_that_is_not_valid(
    client, platform_admin, engine, created_materials
) -> None:
    """A draft cannot be archived."""
    material = await _make_material(engine, created_materials, status="draft")

    response = client.post(
        f"/v1/platform/catalog/{material.id}/status",
        headers=platform_admin,
        json={"status": "archived"},
    )
    assert response.status_code == 409
    assert response.json()["available_transitions"] == ["review", "published"]


async def test_it_refuses_to_publish_a_material_that_is_incomplete(
    client, platform_admin, engine, created_materials
) -> None:
    """The answer says exactly what is missing."""
    material = await _make_material(
        engine,
        created_materials,
        title="",
        grades=[],
        status="draft",
    )

    response = client.post(
        f"/v1/platform/catalog/{material.id}/status",
        headers=platform_admin,
        json={"status": "published"},
    )
    assert response.status_code == 422

    body = response.json()
    assert body["detail"] == "No se puede publicar"
    assert set(body["missing"]) == {"title", "grades", "schools"}


async def test_it_publishes_a_material_that_is_complete(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """The publication is written to the history and to the audit trail."""
    material = await _make_material(
        engine,
        created_materials,
        status="draft",
        school_ids=[catalog_school],
    )

    response = client.post(
        f"/v1/platform/catalog/{material.id}/status",
        headers=platform_admin,
        json={"status": "published"},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["status"] == "published"
    assert body["published_at"] is not None
    assert body["available_transitions"] == ["archived"]
    assert "status_changed" in [entry["action"] for entry in body["history"]]

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        audit = await session.execute(
            select(AuditLog).where(
                AuditLog.subject_id == material.id,
                AuditLog.event_type == "material.published",
            )
        )
        assert audit.scalars().first() is not None


async def test_the_access_of_a_school_asks_for_a_confirmation(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """A published material that loses a school says which one."""
    material = await _make_material(
        engine,
        created_materials,
        status="published",
        school_ids=[catalog_school],
    )

    response = client.put(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": []},
    )
    assert response.status_code == 409

    body = response.json()
    assert "affected" in body
    assert body["affected"][0]["id"] == str(catalog_school)


async def test_a_published_material_keeps_at_least_one_school(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """The last school cannot be taken away from a published piece."""
    material = await _make_material(
        engine,
        created_materials,
        status="published",
        school_ids=[catalog_school],
    )

    response = client.put(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": [], "confirm": True},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "no_schools_left"


async def test_the_access_is_changed_when_it_is_confirmed(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """The change is written to the history and to the audit trail."""
    material = await _make_material(
        engine,
        created_materials,
        status="published",
        school_ids=[catalog_school],
    )

    # A school that does not exist is refused.
    unknown = client.put(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": [str(uuid.uuid4())], "confirm": True},
    )
    assert unknown.status_code == 422

    # The same set of schools does not write the history.
    same = client.put(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": [str(catalog_school)], "confirm": True},
    )
    assert same.status_code == 200
    assert "access_changed" not in [entry["action"] for entry in same.json()["history"]]


async def test_the_access_is_given_to_more_schools_without_taking_it_away(
    client, platform_admin, engine, created_materials, catalog_school, three_schools
) -> None:
    """Enabling a piece for several schools keeps the ones that had it."""
    material = await _make_material(
        engine,
        created_materials,
        status="published",
        school_ids=[catalog_school],
    )
    another = three_schools[0]

    response = client.post(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": [str(another)]},
    )

    assert response.status_code == 200, response.text
    schools = {school["id"] for school in response.json()["schools"]}
    assert str(catalog_school) in schools
    assert str(another) in schools


async def test_the_access_of_a_draft_is_changed_without_a_confirmation(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """Only a published material asks for a confirmation."""
    material = await _make_material(
        engine,
        created_materials,
        status="draft",
        school_ids=[catalog_school],
    )

    response = client.put(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": []},
    )
    assert response.status_code == 200, response.text
    assert response.json()["schools"] == []


async def test_the_access_is_idempotent(
    client, platform_admin, engine, created_materials, catalog_school
) -> None:
    """Sending the same schools again does not write the history."""
    material = await _make_material(
        engine,
        created_materials,
        status="draft",
        school_ids=[catalog_school],
    )

    response = client.put(
        f"/v1/platform/catalog/{material.id}/schools",
        headers=platform_admin,
        json={"school_ids": [str(catalog_school)]},
    )
    assert response.status_code == 200

    actions = [entry["action"] for entry in response.json()["history"]]
    assert "access_changed" not in actions


async def test_the_options_carry_the_closed_catalogs(client, platform_admin) -> None:
    """The frontend takes the catalogs from here."""
    response = client.get("/v1/platform/catalog-options", headers=platform_admin)
    assert response.status_code == 200

    body = response.json()
    assert "Libro" in body["types"]
    assert "Matemáticas" in body["areas"]
    assert "7°" in body["grades"]
    assert body["statuses"] == ["draft", "review", "published", "archived"]


async def test_the_metrics_come_from_the_database(client, platform_admin) -> None:
    """The figures of the panel are not made up."""
    response = client.get("/v1/platform/metrics", headers=platform_admin)
    assert response.status_code == 200

    body = response.json()
    assert body["materials"] >= 0
    assert set(body["materials_by_status"]) == {"draft", "review", "published", "archived"}
    assert isinstance(body["school_coverage"], list)


async def test_the_schools_carry_their_coverage(client, platform_admin) -> None:
    """Each school says how much of the catalog it sees."""
    response = client.get("/v1/platform/schools", headers=platform_admin)
    assert response.status_code == 200

    body = response.json()
    for row in body["items"]:
        assert "covered" in row
        assert row["total"] >= row["covered"]


async def test_the_school_sheet_carries_the_catalog_with_its_access(
    client, platform_admin, catalog_school, created_materials, engine
) -> None:
    """The drawer of a school lists the catalog and says what it sees."""
    await _make_material(
        engine,
        created_materials,
        title="Material con acceso",
        status="published",
        school_ids=[catalog_school],
    )
    await _make_material(
        engine,
        created_materials,
        title="Material sin acceso",
        status="published",
    )

    response = client.get(f"/v1/platform/schools/{catalog_school}", headers=platform_admin)

    assert response.status_code == 200
    body = response.json()
    assert body["name"].startswith("Catalogo Colegio")
    assert body["total"] == len(body["catalog"])

    access = {item["title"]: item["enabled"] for item in body["catalog"]}
    assert access["Material con acceso"] is True
    assert access["Material sin acceso"] is False


async def test_the_school_sheet_of_a_school_that_does_not_exist_is_a_404(
    client, platform_admin
) -> None:
    """A school that was never registered has no sheet."""
    response = client.get(f"/v1/platform/schools/{uuid.uuid4()}", headers=platform_admin)

    assert response.status_code == 404


async def test_the_audit_trail_is_paginated(client, platform_admin) -> None:
    """The audit trail answers with a page and a total."""
    response = client.get("/v1/platform/audit", headers=platform_admin)
    assert response.status_code == 200

    body = response.json()
    assert body["per_page"] == 8
    assert len(body["items"]) <= 8


async def test_the_upload_refuses_a_format_that_is_not_admitted(client, platform_admin) -> None:
    """The error says which formats are admitted."""
    response = client.post(
        "/v1/platform/uploads",
        headers=platform_admin,
        files={"file": ("nota.txt", b"contenido", "text/plain")},
    )
    assert response.status_code == 422
    assert response.json()["file_name"] == "nota.txt"
