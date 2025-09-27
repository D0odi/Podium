import os
from functools import lru_cache
from typing import List

from dotenv import load_dotenv
from pydantic import BaseModel


class Settings(BaseModel):
    app_env: str = "development"
    log_level: str = "info"
    cors_origins: List[str] = []
    deepgram_api_key: str | None = None
    openrouter_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    # Load .env if present (noop if already loaded)
    load_dotenv()
    origins = os.getenv("CORS_ORIGINS", "")
    origins_list = [o.strip() for o in origins.split(",") if o.strip()]
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        log_level=os.getenv("LOG_LEVEL", "info"),
        cors_origins=origins_list,
        deepgram_api_key=os.getenv("DEEPGRAM_API_KEY"),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
    )


