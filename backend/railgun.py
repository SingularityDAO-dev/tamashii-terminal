"""
Railgun backend passthrough client
"""
import httpx
from env_config import RAILGUN_URL

async def verify(message: str, signature: str, address: str) -> bool:
    """POST /verify passthrough"""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{RAILGUN_URL}/verify", json={"message": message, "signature": signature, "address": address})
        return r.json().get("valid", False)

async def get_transactions(sender: str = None) -> list:
    """GET /transactions passthrough"""
    async with httpx.AsyncClient(timeout=10) as c:
        url = f"{RAILGUN_URL}/transactions/{sender}" if sender else f"{RAILGUN_URL}/transactions"
        return (await c.get(url)).json().get("transactions", [])

async def get_address() -> dict:
    """GET /address passthrough"""
    async with httpx.AsyncClient(timeout=10) as c:
        return (await c.get(f"{RAILGUN_URL}/address")).json()
