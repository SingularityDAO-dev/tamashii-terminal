"""Jobs routes - launch GPU jobs"""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from c3 import C3
from database import get_db
from dependencies import require_auth
from models import Job
from pricing import calc_cost, get_bnb_price
from env_config import get_c3_api_key, BILLING_ENABLED
from notify import notify_background, Category, Severity
import railgun

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    gpu_type: str
    image: str
    duration_seconds: int
    region: str | None = None
    command: str | None = None
    env: dict | None = None
    ports: dict | None = None  # {"lb": 8000} for HTTPS load balancer
    auth: bool = False  # Enable Bearer token auth on load balancer


@router.post("")
async def create_job(req: JobCreate, address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Launch a GPU job, deduct from balance"""
    # Calculate cost
    cost = await calc_cost(req.gpu_type, req.duration_seconds)

    # Check balance only if billing is enabled
    if BILLING_ENABLED:
        txs = await railgun.get_transactions(address)
        deposits_wei = sum(int(r["amount"]) for tx in txs for r in tx.get("received", []))
        deposits_bnb = deposits_wei / 1e18
        spent_bnb = db.query(func.coalesce(func.sum(Job.cost_bnb), 0)).filter(Job.user_address == address, Job.billed == True).scalar()
        balance_bnb = deposits_bnb - float(spent_bnb)

        if balance_bnb < cost["cost_bnb"]:
            raise HTTPException(status_code=402, detail=f"Insufficient balance: {balance_bnb:.6f} BNB < {cost['cost_bnb']:.6f} BNB")

    # Launch C3 job
    c3 = C3(api_key=get_c3_api_key())
    try:
        c3_job = c3.jobs.create(
            image=req.image,
            gpu_type=req.gpu_type,
            runtime=req.duration_seconds,
            region=req.region,
            command=req.command,
            env=req.env,
            ports=req.ports,
            auth=req.auth,
            interruptible=True,
        )
    except Exception as e:
        logger.error(f"C3 job launch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to launch job: {e}")

    # Record job
    job = Job(
        id=str(uuid.uuid4()),
        user_address=address,
        c3_job_id=c3_job.job_id,
        gpu_type=req.gpu_type,
        image=req.image,
        duration_seconds=req.duration_seconds,
        cost_usd=cost["cost_usd"],
        cost_bnb=cost["cost_bnb"],
        bnb_price_usd=cost["bnb_price"],
        created_at=datetime.utcnow(),
        billed=BILLING_ENABLED,
    )
    db.add(job)
    db.commit()

    notify_background(Category.JOBS, Severity.INFO, f"Job launched: {req.gpu_type} for {req.duration_seconds}s",
                      job_id=job.id, c3_job_id=c3_job.job_id, cost_bnb=cost["cost_bnb"], address=address[:20])

    return {
        "id": job.id,
        "c3_job_id": c3_job.job_id,
        "gpu_type": req.gpu_type,
        "duration_seconds": req.duration_seconds,
        "cost_usd": cost["cost_usd"],
        "cost_bnb": cost["cost_bnb"],
        "hostname": c3_job.hostname,
    }


@router.get("")
async def list_jobs(address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """List user's jobs"""
    jobs = db.query(Job).filter(Job.user_address == address).order_by(Job.created_at.desc()).limit(50).all()
    return [{"id": j.id, "c3_job_id": j.c3_job_id, "gpu_type": j.gpu_type, "cost_bnb": j.cost_bnb, "created_at": j.created_at} for j in jobs]


@router.get("/running")
async def get_running_job(address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Get the first running job for this user with hostname from C3"""
    # Get user's recent jobs
    jobs = db.query(Job).filter(Job.user_address == address).order_by(Job.created_at.desc()).limit(10).all()
    if not jobs:
        return {"job": None}

    c3 = C3(api_key=get_c3_api_key())

    # Check each job's status on C3
    for job in jobs:
        try:
            c3_job = c3.jobs.get(job.c3_job_id)
            if c3_job.state == "running" and c3_job.hostname:
                return {
                    "job": {
                        "id": job.id,
                        "c3_job_id": job.c3_job_id,
                        "hostname": c3_job.hostname,
                        "gpu_type": job.gpu_type,
                        "state": c3_job.state,
                    }
                }
        except Exception:
            continue

    return {"job": None}


@router.get("/logs/{job_id}")
async def get_job_logs(job_id: str, address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Get job logs from C3"""
    job = db.query(Job).filter(Job.id == job_id, Job.user_address == address).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    c3 = C3(api_key=get_c3_api_key())
    try:
        logs = c3.jobs.logs(job.c3_job_id)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {e}")


@router.get("/{job_id}")
async def get_job(job_id: str, address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Get job details"""
    job = db.query(Job).filter(Job.id == job_id, Job.user_address == address).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"id": job.id, "c3_job_id": job.c3_job_id, "gpu_type": job.gpu_type, "image": job.image,
            "duration_seconds": job.duration_seconds, "cost_usd": job.cost_usd, "cost_bnb": job.cost_bnb, "created_at": job.created_at}


@router.get("/metrics/{job_id}")
async def get_job_metrics(job_id: str, address: str = Depends(require_auth), db: Session = Depends(get_db)):
    """Get job metrics from C3"""
    job = db.query(Job).filter(Job.id == job_id, Job.user_address == address).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    c3 = C3(api_key=get_c3_api_key())
    try:
        metrics = c3.jobs.metrics(job.c3_job_id)
        return {
            "gpus": [{"index": g.index, "name": g.name, "utilization": g.utilization,
                      "memory_used": g.memory_used, "memory_total": g.memory_total,
                      "temperature": g.temperature, "power_draw": g.power_draw} for g in metrics.gpus],
            "system": {"cpu_percent": metrics.system.cpu_percent, "memory_used": metrics.system.memory_used,
                       "memory_limit": metrics.system.memory_limit} if metrics.system else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {e}")
