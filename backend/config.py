import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LLM_API_KEY = os.getenv("LLM_API_KEY")
    LLM_BASE_URL = os.getenv("LLM_BASE_URL")
    LLM_MODEL = os.getenv("LLM_MODEL")
    LLM_TIMEOUT_SECONDS = 10  # NFR02
    LLM_PLAN_TIMEOUT_SECONDS = 45  # a full calendar week is a long reply (CHANGES.md #25)
    TOKEN_MAX_AGE_SECONDS = 8 * 3600  # login lasts 8 hours
    MAX_CONTENT_LENGTH = 64 * 1024  # largest request body accepted (64 KB)
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
