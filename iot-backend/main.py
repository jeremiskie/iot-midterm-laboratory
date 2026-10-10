import logging
from functools import lru_cache
from math import isfinite
from secrets import compare_digest

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    device_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


class Telemetry(BaseModel):
    device_id: str = Field(alias="deviceId", min_length=1)
    temperature: float
    humidity: float
    motion: bool

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @field_validator("temperature", "humidity")
    @classmethod
    def require_finite_measurements(cls, value: float) -> float:
        if not isfinite(value):
            raise ValueError("measurement must be finite")
        return value


@lru_cache(maxsize=1)
def _create_supabase_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_supabase_client() -> Client:
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured",
        )
    return _create_supabase_client(settings.supabase_url, settings.supabase_key)


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    if not settings.device_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Device API key is not configured",
        )
    if x_api_key is None or not compare_digest(x_api_key, settings.device_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


app = FastAPI(title="IoT Environmental Monitoring API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/telemetry",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
def create_telemetry(
    telemetry: Telemetry,
    client: Client = Depends(get_supabase_client),
) -> dict:
    record = telemetry.model_dump()
    try:
        result = client.schema("public").table("telemetry").insert(record).execute()
    except Exception as exc:
        logger.exception("Failed to insert telemetry")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to store telemetry",
        ) from exc

    if result.data:
        return result.data[0]
    return record


@app.get("/api/telemetry")
def get_recent_telemetry(client: Client = Depends(get_supabase_client)) -> list[dict]:
    try:
        result = (
            client.schema("public")
            .table("telemetry")
            .select("*")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to retrieve telemetry")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve telemetry",
        ) from exc
    return result.data or []
