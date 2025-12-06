"""
Pricing - BNB price and C3 GPU costs
"""
import httpx
import logging
from time import time
from c3 import C3
from env_config import get_c3_api_key

logger = logging.getLogger(__name__)

BNB_BUFFER = 1.2  # 20% buffer for fluctuations
_bnb_cache = {"price": None, "ts": 0}


async def get_bnb_price() -> float:
    """Fetch BNB/USD from CoinGecko (cached 60s)"""
    if _bnb_cache["price"] and (time() - _bnb_cache["ts"]) < 60:
        return _bnb_cache["price"]

    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get("https://api.coingecko.com/api/v3/simple/price",
                             params={"ids": "binancecoin", "vs_currencies": "usd"})
        price = r.json()["binancecoin"]["usd"]
        _bnb_cache.update({"price": price, "ts": time()})
        return price


def get_gpu_price(gpu_type: str) -> float:
    """Get GPU $/hour from C3"""
    c3 = C3(api_key=get_c3_api_key())
    for p in c3.instances.pricing().values():
        if p.gpu_type == gpu_type and p.gpu_count == 1:
            for t in p.tiers:
                if t.interruptible:
                    return t.interruptible
    raise ValueError(f"Unknown GPU: {gpu_type}")


async def calc_cost(gpu_type: str, seconds: int) -> dict:
    """Calculate job cost in USD and BNB"""
    usd_per_hour = get_gpu_price(gpu_type)
    cost_usd = usd_per_hour * (seconds / 3600)
    bnb_price = await get_bnb_price()
    cost_bnb = cost_usd / (bnb_price * BNB_BUFFER)
    return {"cost_usd": cost_usd, "cost_bnb": cost_bnb, "bnb_price": bnb_price}
