"""Balance routes"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from dependencies import require_auth
from models import Job
from pricing import get_bnb_price
import railgun

router = APIRouter(prefix="/balance", tags=["balance"])


@router.get("")
async def get_balance(address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Get user balance: deposits - spent"""
    # Get deposits from railgun (txs FROM this address to us)
    txs = await railgun.get_transactions(address)
    deposits_wei = sum(int(r["amount"]) for tx in txs for r in tx.get("received", []))
    deposits_bnb = deposits_wei / 1e18

    # Get spent from local jobs table (only billed jobs)
    spent_bnb = db.query(func.coalesce(func.sum(Job.cost_bnb), 0)).filter(Job.user_address == address, Job.billed == True).scalar()

    balance_bnb = deposits_bnb - float(spent_bnb)
    bnb_price = await get_bnb_price()

    return {
        "address": address,
        "deposits_bnb": deposits_bnb,
        "spent_bnb": float(spent_bnb),
        "balance_bnb": balance_bnb,
        "balance_usd": balance_bnb * bnb_price,
        "bnb_price": bnb_price,
    }
