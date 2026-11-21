"""Tests of the storage of the catalog.

The material of the platform role lives on the disk of the server while
the project has no bucket to put it in. These tests check that the file
is written, that it is served back, and that a key cannot walk out of
the folder that holds it.
"""

from __future__ import annotations

import uuid

import pytest

from app.config import Settings
from app.core.errors import ValidationError
from app.platform.storage import (
    LocalMaterialStorage,
    build_storage_key,
    safe_key,
    set_storage,
    storage_root,
)

# The endpoints commit their writes, so the rows they create are
# removed before and after each test.
pytestmark = pytest.mark.usefixtures("cleanup_users")


@pytest.fixture
def storage(tmp_path):
    """A storage that writes inside a temporary folder."""
    settings = Settings(platform_storage_dir=str(tmp_path))
    return LocalMaterialStorage(settings)


async def test_the_file_is_written_and_read_back(storage, tmp_path) -> None:
    """The round trip of a file keeps the content."""
    await storage.save(key="C-1041/libro.pdf", content=b"contenido", content_type="application/pdf")

    assert await storage.read(key="C-1041/libro.pdf") == b"contenido"
    assert (tmp_path / "C-1041" / "libro.pdf").is_file()


async def test_a_file_that_is_deleted_is_gone(storage, tmp_path) -> None:
    """Removing a file does not leave it behind."""
    await storage.save(key="C-1041/libro.pdf", content=b"contenido", content_type="application/pdf")
    await storage.delete(key="C-1041/libro.pdf")

    assert not (tmp_path / "C-1041" / "libro.pdf").exists()
    # Removing it twice is not an error: the file is simply not there.
    await storage.delete(key="C-1041/libro.pdf")


async def test_a_file_that_is_moved_leaves_its_folder(storage, tmp_path) -> None:
    """A file that joins a material leaves the pending folder."""
    await storage.save(key="pendientes/abc/libro.pdf", content=b"contenido", content_type="a/b")
    await storage.move(key="pendientes/abc/libro.pdf", new_key="C-1041/libro.pdf")

    assert not (tmp_path / "pendientes").exists()
    assert await storage.read(key="C-1041/libro.pdf") == b"contenido"


def test_a_key_that_walks_out_of_the_folder_is_refused() -> None:
    """The key of a file is an input, and it is checked."""
    for key in ("../etc/passwd", "materiales/../../etc/passwd", "", "  "):
        with pytest.raises(ValidationError):
            safe_key(key)

    assert safe_key("C-1041/libro.pdf") == "C-1041/libro.pdf"


def test_the_folder_of_the_files_is_inside_the_project() -> None:
    """A relative path is resolved against the backend, not the shell."""
    settings = Settings(platform_storage_dir="var/materiales")
    root = storage_root(settings)

    assert root.is_absolute()
    assert root.name == "materiales"
    assert root.parent.name == "var"


def test_the_key_of_a_pending_file_and_of_a_material_are_different() -> None:
    """A file that is not attached yet lives in its own folder."""
    pending = build_storage_key(file_name="Álgebra 7.pdf")
    attached = build_storage_key(file_name="Álgebra 7.pdf", material_code="C-1041")

    assert pending.startswith("pendientes/")
    assert attached == "C-1041/Álgebra-7.pdf"


async def test_the_upload_writes_the_file_and_the_download_serves_it(
    client,
    platform_admin,
    tmp_path,
) -> None:
    """The file the platform team uploads comes back through the API."""
    set_storage(LocalMaterialStorage(Settings(platform_storage_dir=str(tmp_path))))
    try:
        # The content is unique: the catalog tells a duplicate from a
        # new file by its digest.
        content = f"%PDF-1.4 contenido {uuid.uuid4()}".encode()
        uploaded = client.post(
            "/v1/platform/uploads",
            headers=platform_admin,
            files={"file": ("algebra.pdf", content, "application/pdf")},
        )
        assert uploaded.status_code == 200
        file_id = uploaded.json()["file_id"]

        downloaded = client.get(f"/v1/platform/files/{file_id}", headers=platform_admin)
        assert downloaded.status_code == 200
        assert downloaded.content == content
        assert downloaded.headers["content-type"] == "application/pdf"
    finally:
        set_storage(None)


async def test_the_download_of_a_file_that_does_not_exist_is_a_404(client, platform_admin) -> None:
    """A file that was never uploaded cannot be downloaded."""
    response = client.get(f"/v1/platform/files/{uuid.uuid4()}", headers=platform_admin)

    assert response.status_code == 404
