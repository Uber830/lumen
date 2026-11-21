"""The panel of the school: the summary of the overview and the material
the platform enabled.

The panel is read only. The school consumes the material of the editorial
catalog; it never sees the catalog as a whole and never writes here.

What is checked here:

- the overview counts the school of the caller and nobody else;
- the material list has only what the platform enabled for this school;
- the search and the area filter run in the server;
- the list paginates six rows by page;
- the detail of a material that belongs to another school answers 404,
  because a 403 would confirm that the material is real.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Material, MaterialSchool, School

pytestmark = pytest.mark.usefixtures("cleanup_users")

# The materials of these tests carry this prefix in their reference, so
# the cleanup knows which rows are theirs.
REF_PREFIX = "T-"


async def _publish_material(
    session: AsyncSession,
    *,
    title: str,
    area: str = "Matemáticas",
    kind: str = "pdf",
    state: str = "publicado",
    ref: str | None = None,
) -> Material:
    """Add a piece of material to the catalog."""
    material = Material(
        id=uuid.uuid4(),
        ref=ref or f"{REF_PREFIX}{uuid.uuid4().hex[:10].upper()}",
        title=title,
        description="Material de prueba.",
        area=area,
        kind=kind,
        state=state,
        file_size_bytes=1024,
    )
    session.add(material)
    await session.commit()
    return material


async def _enable(session: AsyncSession, material: Material, school_id: uuid.UUID) -> None:
    """Give a school access to a piece of material."""
    session.add(
        MaterialSchool(
            id=uuid.uuid4(),
            material_id=material.id,
            school_id=school_id,
            enabled=True,
            enabled_at=datetime.now(UTC),
        )
    )
    await session.commit()


@pytest.fixture
async def other_school(engine) -> uuid.UUID:
    """A second school, so the tests can look at a material that is
    not the caller's."""
    school_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            School(
                id=school_id,
                name=f"Otro colegio {school_id.hex[:8]}",
                short_code=f"O{school_id.hex[:6].upper()}",
                status="active",
            )
        )
        await session.commit()

    yield school_id

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(delete(MaterialSchool).where(MaterialSchool.school_id == school_id))
        await session.execute(delete(School).where(School.id == school_id))
        await session.commit()


@pytest.fixture
async def catalog(engine):
    """The catalog of these tests, with its rows removed at the end.

    It returns a factory: a piece of material, and whether it is
    enabled for the school of the test.
    """

    async def _make(
        session: AsyncSession,
        title: str,
        school_id: uuid.UUID | None,
        *,
        area: str = "Matemáticas",
        kind: str = "pdf",
        state: str = "publicado",
        ref: str | None = None,
    ) -> Material:
        material = await _publish_material(
            session, title=title, area=area, kind=kind, state=state, ref=ref
        )
        if school_id is not None:
            await _enable(session, material, school_id)
        return material

    yield _make

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        material_ids = (
            (await session.execute(select(Material.id).where(Material.ref.like(f"{REF_PREFIX}%"))))
            .scalars()
            .all()
        )
        await session.execute(
            delete(MaterialSchool).where(MaterialSchool.material_id.in_(material_ids))
        )
        await session.execute(delete(Material).where(Material.id.in_(material_ids)))
        await session.commit()


async def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


# ---------------------------------------------------------------------------
# The overview
# ---------------------------------------------------------------------------


async def test_the_overview_counts_the_material_of_the_school(
    client, engine, seeded_school, other_school, catalog
):
    """The counters belong to the school of the caller."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Algebra de 7", seeded_school)
        await catalog(session, "Material de otro colegio", other_school)

    response = client.get("/v1/school/overview", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["material"]["available"] == 1
    # The catalog as a whole is counted, but only the enabled material is
    # the school's.
    assert body["material"]["catalog_total"] == 2
    assert body["material"]["by_area"] == [{"area": "Matemáticas", "count": 1}]


async def test_the_overview_does_not_count_the_material_that_is_not_published(
    client, engine, seeded_school, catalog
):
    """A draft is not part of the catalog the school sees."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Borrador", seeded_school, state="borrador")

    response = client.get("/v1/school/overview", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["material"]["available"] == 0
    assert body["material"]["catalog_total"] == 0
    assert body["material"]["by_area"] == []


async def test_the_overview_ignores_a_school_id_in_the_query(
    client, engine, seeded_school, other_school, catalog
):
    """The school comes from the session, never from the request."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Algebra de 7", seeded_school)
        await catalog(session, "Material de otro colegio", other_school)

    response = client.get(
        f"/v1/school/overview?school_id={uuid.uuid4()}",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text
    assert response.json()["material"]["available"] == 1


async def test_the_overview_needs_authentication(client):
    """Without a session there is no panel."""
    response = client.get("/v1/school/overview")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# The material
# ---------------------------------------------------------------------------


async def test_the_list_has_only_what_the_platform_enabled(
    client, engine, seeded_school, other_school, catalog
):
    """The catalog of the platform is not visible to this role."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Algebra de 7", seeded_school)
        await catalog(session, "Ciencias naturales", seeded_school, area="Ciencias")
        await catalog(session, "Material de otro colegio", other_school)
        await catalog(session, "Borrador", seeded_school, state="borrador")

    response = client.get("/v1/school/material", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["total"] == 2
    assert sorted(item["title"] for item in body["items"]) == [
        "Algebra de 7",
        "Ciencias naturales",
    ]
    # The filter offers only the areas with material behind them.
    assert body["areas"] == ["Ciencias", "Matemáticas"]


async def test_the_search_runs_in_the_server(client, engine, seeded_school, catalog):
    """The search matches the title, the area and the reference."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Algebra de 7", seeded_school, ref=f"{REF_PREFIX}ALGEBRA")
        await catalog(session, "Ciencias naturales", seeded_school, area="Ciencias")

    response = client.get("/v1/school/material?q=ciencias", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1

    response = client.get("/v1/school/material?q=ALGEBRA", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1


async def test_the_area_filter_runs_in_the_server(client, engine, seeded_school, catalog):
    """The area filter narrows the list."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Algebra de 7", seeded_school)
        await catalog(session, "Ciencias naturales", seeded_school, area="Ciencias")

    response = client.get("/v1/school/material?area=Ciencias", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["area"] == "Ciencias"


async def test_the_list_paginates_six_rows_by_page(client, engine, seeded_school, catalog):
    """Six rows by page, and the totals say how many there are."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        for index in range(8):
            await catalog(session, f"Material {index}", seeded_school)

    first = client.get("/v1/school/material?page=1", headers=await _auth())
    assert first.status_code == 200, first.text
    assert len(first.json()["items"]) == 6
    assert first.json()["total"] == 8
    assert first.json()["pages"] == 2

    second = client.get("/v1/school/material?page=2", headers=await _auth())
    assert second.status_code == 200, second.text
    assert len(second.json()["items"]) == 2
    assert second.json()["page"] == 2


async def test_the_detail_of_an_enabled_material_is_returned(
    client, engine, seeded_school, catalog
):
    """The material of the school is described in its detail."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        material = await catalog(session, "Algebra de 7", seeded_school)

    response = client.get(f"/v1/school/material/{material.id}", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["title"] == "Algebra de 7"
    assert body["ref"] == material.ref


async def test_the_detail_of_a_material_of_another_school_is_not_found(
    client, engine, seeded_school, other_school, catalog
):
    """A 404, not a 403: the material of another school does not exist."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        material = await catalog(session, "Material de otro colegio", other_school)

    response = client.get(f"/v1/school/material/{material.id}", headers=await _auth())
    assert response.status_code == 404


async def test_the_material_of_the_school_is_not_for_a_teacher(
    client, engine, seeded_school, catalog
):
    """The panel of the school belongs to its administrators."""
    from sqlalchemy import update

    from app.db.enums import SchoolRole
    from app.db.models import SchoolMembership
    from tests.conftest import TEST_USER_ID

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await catalog(session, "Algebra de 7", seeded_school)
        await session.execute(
            update(SchoolMembership)
            .where(
                SchoolMembership.user_id == uuid.UUID(TEST_USER_ID),
                SchoolMembership.school_id == seeded_school,
            )
            .values(role=SchoolRole.TEACHER, admin_role=None)
        )
        await session.commit()

    response = client.get("/v1/school/material", headers=await _auth())
    assert response.status_code == 403
