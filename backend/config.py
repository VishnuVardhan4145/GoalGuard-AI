import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
MOCK_LLM: bool = os.getenv("MOCK_LLM", "false").lower() in ("true", "1", "yes") or not GEMINI_API_KEY

HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))

# CORS: always allow localhost for dev; extend via ALLOWED_ORIGINS env var (comma-separated)
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS: list[str] = list(dict.fromkeys(_DEFAULT_ORIGINS + _extra))

# Context Switch Tax constants (in minutes per switch)
SWITCH_TAX_MIN_LOW: int = 10
SWITCH_TAX_MIN_HIGH: int = 25

