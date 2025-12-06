"""Auth routes - SIWR verification + JWT issuance"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import railgun
from dependencies import create_jwt, require_admin

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyRequest(BaseModel):
    message: str
    signature: str
    address: str


class VerifyResponse(BaseModel):
    token: str
    address: str


@router.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest):
    """Verify SIWR signature and issue JWT"""
    valid = await railgun.verify(req.message, req.signature, req.address)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid signature")
    token = create_jwt(req.address)
    return {"token": token, "address": req.address}


class AdminLoginRequest(BaseModel):
    address: str


@router.post("/admin", response_model=VerifyResponse, dependencies=[Depends(require_admin)])
async def admin_login(req: AdminLoginRequest):
    """Admin login - issue JWT for any address (requires X-BACKEND-API-KEY)"""
    token = create_jwt(req.address)
    return {"token": token, "address": req.address}
