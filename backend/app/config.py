"""Application configuration loaded from environment variables.

The Settings class is a single source of truth for everything the
backend needs at runtime. It is created once via get_settings() and
cached with functools.lru_cache so the FastAPI dependency injector
returns the same instance across the lifetime of the process.

Every secret is a SecretStr. The Settings class does no validation of
the values themselves; pydantic-settings handles type coercion and
trimming. Higher-level helpers (db/session.py, core/tokens.py) check
that the values are usable for their specific purpose.

Phase 0 note: Supabase remains the Postgres host and the Storage /
Realtime provider, but the backend now talks to Postgres directly
(asyncpg) instead of through the PostgREST SDK. The Supabase SDK was
removed from the dependency list in Phase 0.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# The backend has nowhere to store anything without a database. The
# message is user-facing (a developer reading the 503), so it says
# what to set. The error type lives in `app.core.errors`, which
# imports this module, so the import is local to avoid a cycle.
DATABASE_NOT_CONFIGURED_DETAIL = (
    "El servicio no está disponible: falta configurar la base de datos. "
    "Definí DATABASE_URL en backend/.env con la cadena de conexión del "
    "proyecto de Supabase."
)


class Settings(BaseSettings):
    """Runtime configuration for the Lumen backend.

    Values are read from environment variables (or a .env file when
    running locally). The variable names mirror the keys declared in
    .env.example at the repository root.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -----------------------------------------------------------------------
    # Runtime environment
    # -----------------------------------------------------------------------
    environment: Literal["development", "staging", "production"] = "development"
    log_level: Literal["debug", "info", "warning", "error"] = "info"

    # -----------------------------------------------------------------------
    # CORS
    # -----------------------------------------------------------------------
    # Comma-separated list of allowed origins.
    #
    # 5174 is the port of the Lumen dev server (see frontend/vite.config.ts);
    # 5175 is what Vite takes when 5174 is busy. 8080 and 5173 are kept for
    # the tools that default to them.
    #
    # `NoDecode` stops pydantic-settings from trying to JSON-parse the
    # environment variable; the validator below splits the raw string.
    cors_allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:8080",
            "http://localhost:5173",
        ]
    )

    # -----------------------------------------------------------------------
    # Database (Postgres hosted by Supabase)
    # -----------------------------------------------------------------------
    # Direct connection string. Use the Supabase *pooler* host in
    # production (aws-0-<ref>.pooler.supabase.com, port 5432, user
    # postgres.<ref>) because the direct host only accepts a limited
    # number of concurrent connections and is IPv6-only in some
    # projects. The pooler is transaction-mode, which is what an
    # async request/response backend wants.
    database_url: str = ""
    # Optional override; when set it wins over database_url. Useful for
    # pointing tests at a throwaway database without rewriting the URL.
    database_url_override: str | None = None
    database_pool_size: int = Field(default=10, ge=1, le=100)
    database_max_overflow: int = Field(default=10, ge=0, le=100)
    database_pool_timeout: int = Field(default=30, ge=1)
    database_echo: bool = False

    # -----------------------------------------------------------------------
    # Supabase (Storage + Realtime only)
    # -----------------------------------------------------------------------
    # The project URL and keys are still needed for Storage uploads and
    # the Realtime websocket. Auth is not: this backend is the only
    # issuer of tokens, so no Supabase JWT secret is read any more.
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: SecretStr | None = None
    # The project JWT secret, used to mint the short-lived tokens the
    # browser needs for Storage and Realtime. It is NOT used to
    # authenticate: `app/auth/dependencies.py` does not accept a token
    # signed with it. See app/core/supabase_tokens.py.
    supabase_jwt_secret: SecretStr | None = None

    # -----------------------------------------------------------------------
    # Auth (Phase 1)
    # -----------------------------------------------------------------------
    # Secret used to sign the JWTs issued by this backend. MUST be
    # replaced in production; the default is only for local development.
    # The secret that signs the access tokens the backend issues. It
    # has to be the same in every process that verifies them: the API
    # and the frontend's server, when it reads the cookie.
    #
    # The default is for local development only. The startup refuses
    # to run in production with it.
    jwt_secret: SecretStr = SecretStr("dev-only-insecure-jwt-secret-change-me")
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "lumen-api"
    jwt_audience: str = "lumen-frontend"
    access_token_ttl_seconds: int = Field(default=900, ge=60)  # 15 minutes
    refresh_token_ttl_seconds: int = Field(default=2_592_000, ge=300)  # 30 days
    # The domain the session cookies are set on. Leave it empty for a
    # host-only cookie, which is right when the API and the frontend
    # share a host (and in development, where cookies ignore the port
    # so `localhost` covers both). Set it to ".example.com" when the
    # frontend and the API live on different subdomains, so the
    # frontend's server can read the cookie during SSR.
    cookie_domain: str = ""
    # Password hashing. Argon2id parameters; the defaults are tuned for
    # an interactive login on modest hardware.
    argon2_time_cost: int = Field(default=3, ge=1, le=10)
    argon2_memory_cost: int = Field(default=65_536, ge=8_192, le=1_048_576)
    argon2_parallelism: int = Field(default=4, ge=1, le=16)

    # -----------------------------------------------------------------------
    # Sign-in protection
    # -----------------------------------------------------------------------
    # How many failed attempts are allowed in the rate limit window,
    # per email and per address. The window and the threshold are
    # separate so the limit can be tuned without a redeploy.
    login_rate_limit_attempts: int = Field(default=5, ge=1, le=100)
    login_rate_limit_window_seconds: int = Field(default=60, ge=10, le=3600)
    # How many failed attempts lock the account, and for how long.
    login_lock_threshold: int = Field(default=10, ge=1, le=100)
    login_lock_minutes: int = Field(default=15, ge=1, le=1440)

    # -----------------------------------------------------------------------
    # Wompi
    # -----------------------------------------------------------------------
    wompi_environment: Literal["sandbox", "production"] = "sandbox"
    wompi_api_base: str | None = None
    wompi_public_key: str | None = None
    wompi_private_key: SecretStr | None = None
    wompi_integrity_key: SecretStr | None = None
    wompi_webhook_secret: SecretStr | None = None

    # -----------------------------------------------------------------------
    # Derived helpers
    # -----------------------------------------------------------------------
    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string as well as a real list."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def effective_database_url(self) -> str:
        """The Postgres URL the engine should use.

        Raises a 503 instead of letting asyncpg fail later with an
        opaque message when the URL is missing: a server without a
        database is unavailable, not broken, and the message says what
        to configure.

        A bare `postgresql://` URL gets the async driver. The
        connection string people copy from the Supabase dashboard is
        `postgresql://`, and SQLAlchemy would default to psycopg2,
        which is not installed. The application is async, so asyncpg is
        the right driver.
        """
        url = self.database_url_override or self.database_url
        if not url:
            # Imported here: `app.core.errors` imports this module.
            from app.core.errors import ServiceUnavailableError

            raise ServiceUnavailableError(DATABASE_NOT_CONFIGURED_DETAIL)

        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def assert_production_secrets(self) -> None:
        """Fail fast if production is running with development defaults.

        Called from the application lifespan. It is a cheap guard that
        catches the most common deployment mistake: shipping the
        example env file.
        """
        if not self.is_production:
            return
        if self.jwt_secret.get_secret_value().startswith("dev-only-insecure"):
            raise RuntimeError(
                "JWT_SECRET still holds the development default. Set a "
                "strong random value before running in production."
            )
        if not self.database_url and not self.database_url_override:
            raise RuntimeError("DATABASE_URL is required in production.")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached Settings instance.

    lru_cache guarantees that the .env file is read only once per
    process even when get_settings is called from many places.
    """
    return Settings()
