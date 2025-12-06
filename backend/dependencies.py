"""
JWT Authentication using EC keys (ES256 / secp256r1)

Keys in SEC1 format:
- Private: 64 hex chars (256-bit value)
- Public: 130 hex chars (04 + x + y coordinates)
"""
import os
import jwt
import logging
from datetime import datetime, timedelta
from fastapi import Header, HTTPException
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

JWT_PRIVATE_KEY = os.getenv("JWT_PRIVATE_KEY")  # 64 hex chars
JWT_PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY")    # 130 hex chars (04 + x + y)
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))


def load_private_key(hex_key: str):
    """Load EC private key from SEC1 hex format"""
    if len(hex_key) != 64:
        raise ValueError(f"Invalid private key: expected 64 hex chars, got {len(hex_key)}")
    private_value = int(hex_key, 16)
    return ec.derive_private_key(private_value, ec.SECP256R1(), default_backend())


def load_public_key(hex_key: str):
    """Load EC public key from SEC1 uncompressed point format (04 + x + y)"""
    if len(hex_key) != 130 or not hex_key.startswith('04'):
        raise ValueError(f"Invalid public key: expected 130 hex chars starting with 04")
    x = int(hex_key[2:66], 16)
    y = int(hex_key[66:130], 16)
    public_numbers = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256R1())
    return public_numbers.public_key(default_backend())


def create_jwt(address: str) -> str:
    """Create JWT token for authenticated user"""
    private_key = load_private_key(JWT_PRIVATE_KEY)
    payload = {
        "address": address,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, private_key, algorithm="ES256")


def decode_jwt(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        public_key = load_public_key(JWT_PUBLIC_KEY)
        return jwt.decode(token, public_key, algorithms=["ES256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_auth(authorization: str = Header(...)) -> str:
    """Dependency to require JWT auth, returns user's railgun address"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[7:]
    payload = decode_jwt(token)
    return payload["address"]


BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")


async def require_admin(x_backend_api_key: str = Header(..., alias="X-BACKEND-API-KEY")) -> None:
    """Dependency to require admin API key"""
    if not BACKEND_API_KEY:
        raise HTTPException(status_code=500, detail="BACKEND_API_KEY not configured")
    if x_backend_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
