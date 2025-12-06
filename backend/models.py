import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer, Boolean
from pydantic import BaseModel
from database import Base


class Job(Base):
    """GPU job billing record"""
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_address = Column(String, nullable=False, index=True)  # railgun address
    c3_job_id = Column(String, nullable=False)
    gpu_type = Column(String, nullable=False)
    image = Column(String, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    cost_usd = Column(Float, nullable=False)
    cost_bnb = Column(Float, nullable=False)
    bnb_price_usd = Column(Float, nullable=False)  # price at launch time
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    billed = Column(Boolean, nullable=False, default=True)  # False when BILLING_ENABLED=false


# Pydantic schemas

class JobCreate(BaseModel):
    gpu_type: str
    image: str
    duration_seconds: int
    region: str | None = None


class JobResponse(BaseModel):
    id: str
    c3_job_id: str
    gpu_type: str
    image: str
    duration_seconds: int
    cost_usd: float
    cost_bnb: float
    created_at: datetime

    class Config:
        from_attributes = True


class BalanceResponse(BaseModel):
    address: str
    deposits_bnb: float
    spent_bnb: float
    balance_bnb: float
    balance_usd: float
    bnb_price_usd: float
