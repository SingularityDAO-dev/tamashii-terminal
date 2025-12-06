import os
from dotenv import load_dotenv

load_dotenv()

# Railgun backend
RAILGUN_URL = os.getenv("RAILGUN_URL", "http://localhost:3000")

# Admin API key
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")

# Pricing
BNB_BUFFER = float(os.getenv("BNB_BUFFER", "1.2"))  # 20% buffer for price fluctuations
BILLING_ENABLED = os.getenv("BILLING_ENABLED", "true").lower() == "true"


def get_c3_api_key() -> str:
    return os.getenv("C3_API_KEY")


def validate_env():
    required_vars = [
        # JWT (EC keys in SEC1 format)
        "JWT_PRIVATE_KEY",  # 64 hex chars
        "JWT_PUBLIC_KEY",   # 130 hex chars (04 + x + y)
        # Database
        "DB_HOST",
        "DB_PORT",
        "DB_USER",
        "DB_PASSWORD",
        "DB_NAME",
        # External services
        "C3_API_KEY",
        "RAILGUN_URL",
    ]

    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
