"""Tests of the public site.

The landing is served from the row `landing` of `site_content`: the API
validates the copy before serving it, so a malformed edit fails at the
API instead of reaching the page half-rendered.

The copy of the site is written by a migration
(`backend/migrations/20261126010000_landing_copy.sql`), but these tests
write their own copy: what is checked here is the contract of the API,
not the words of the landing.
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SiteContent

LANDING_KEY = "landing"


def _copy(**overrides: Any) -> dict[str, Any]:
    """A copy of the landing that fits the contract."""
    document: dict[str, Any] = {
        "stats": [{"label": "Colegios", "value": "24"}],
        "contact_email": "hola@lumen.co",
        "nav": {
            "links": [{"id": "proceso", "label": "Proceso", "href": "#proceso"}],
            "login_label": "Iniciar sesión",
            "contact_label": "Hablar con el equipo",
        },
        "hero": {
            "kicker": "IDX-001 / Solución para colegios",
            "title_lead": "El material de su colegio,",
            "title_tail": "ordenado y listo para usar.",
            "lead": "Lumen resuelve la gestión del material académico.",
            "cta_primary": {
                "id": "proceso",
                "label": "Ver el proceso",
                "href": "#proceso",
                "variant": "solid",
            },
            "cta_secondary": {
                "id": "panel",
                "label": "Abrir el panel",
                "href": "/login",
                "variant": "outline",
            },
        },
        "catalog": {
            "kicker": "IDX-002 / Catálogo",
            "title": "El catálogo de material",
            "lead": "Cada pieza se carga una vez.",
            "columns": [{"id": "ref", "label": "Ref."}],
            "footer_prefix": "Mostrando",
            "footer_suffix": "entradas",
        },
        "process": {
            "kicker": "IDX-003 / Proceso",
            "title": "Cómo el colegio pone en marcha su material",
            "steps": [],
        },
        "roles": {
            "kicker": "IDX-004 / Roles",
            "title": "Quién usa Lumen y hasta dónde",
            "items": [
                {
                    "id": "DOCENTE",
                    "summary": "Enseña con el material al día.",
                    "detail": "Consulta y descarga el material de sus cursos.",
                    "scope": "Material de sus cursos",
                }
            ],
        },
        "faq": {
            "kicker": "IDX-005 / Preguntas",
            "title": "Preguntas frecuentes",
            "items": [],
        },
        "cta": {
            "kicker": "IDX-006 / Contacto",
            "title": "Veamos su colegio con el material ya cargado.",
            "body": "Preparamos una demostración.",
            "buttons": [],
            "spec": [],
        },
        "footer": {
            "brand": "Lumen",
            "location": "LUMEN · BOGOTÁ, COLOMBIA",
            "columns": [],
            "legal": "© 2026 Lumen S.A.S. Todos los derechos reservados.",
        },
    }
    document.update(overrides)
    return document


async def _write_landing(engine, content: dict[str, Any]) -> None:
    """Write the copy of the landing and commit it.

    The HTTP client reads through its own connection, so the row has to
    be committed for the endpoint to see it.
    """
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        previous = await session.get(SiteContent, LANDING_KEY)
        if previous is not None:
            await session.delete(previous)
        session.add(SiteContent(key=LANDING_KEY, content=content))
        await session.commit()


async def _clear_landing(engine) -> None:
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.delete(await session.get(SiteContent, LANDING_KEY))
        await session.commit()


@pytest.fixture
async def landing_copy(engine):
    """Write a copy of the landing and take it away at the end."""
    await _write_landing(engine, _copy())
    yield
    await _clear_landing(engine)


async def test_the_endpoint_serves_the_copy_of_the_landing(client, landing_copy) -> None:
    """The landing is served as it is written in the database."""
    response = client.get("/v1/public/site")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["content"]["hero"]["title_lead"] == "El material de su colegio,"
    assert body["contact_email"] == "hola@lumen.co"
    assert body["content"]["roles"]["items"][0]["id"] == "DOCENTE"


async def test_a_copy_without_the_coverage_block_is_served(client, engine) -> None:
    """The blocks that are not published are simply not in the copy.

    The coverage by school size is not published for now: a copy
    without it is served like any other, and the page simply does not
    draw that block.
    """
    await _write_landing(engine, _copy())
    try:
        response = client.get("/v1/public/site")

        assert response.status_code == 200, response.text
        assert response.json()["content"]["coverage"] is None
    finally:
        await _clear_landing(engine)


async def test_a_copy_that_does_not_fit_the_contract_answers_503(client, engine) -> None:
    """A malformed edit fails at the API, not in the page.

    The platform team has to know that the edit they made did not work.
    """
    broken = _copy()
    del broken["roles"]
    await _write_landing(engine, broken)
    try:
        response = client.get("/v1/public/site")

        assert response.status_code == 503, response.text
    finally:
        await _clear_landing(engine)
