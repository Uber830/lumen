# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1: resolve dependencies with uv and build the project.
# ---------------------------------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /build

# Resolve dependencies first to maximize layer caching. The lockfile is
# generated on the first build; subsequent builds install --frozen.
COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    if [ -f uv.lock ]; then \
        uv sync --frozen --no-install-project --no-dev; \
    else \
        uv sync --no-install-project --no-dev; \
    fi

# Copy the project sources and install the application itself.
COPY app ./app
# Alembic ships with the image so the schema can be migrated from a
# running container when the Supabase CLI is not available.
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# ---------------------------------------------------------------------------
# Stage 2: runtime image. Only the virtual env and the application code.
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app

# Run as a non-root user; required by the deployment platform.
RUN groupadd --gid 1000 lumen \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash lumen

WORKDIR /app
COPY --from=builder --chown=lumen:lumen /build /app

USER lumen

EXPOSE 8000

# Production entrypoint. /health and /ready are probe-friendly.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
