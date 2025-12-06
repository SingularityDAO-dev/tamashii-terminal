import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import Base, engine
from env_config import validate_env
from routes import auth_router, balance_router, jobs_router

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class HealthCheckFilter(logging.Filter):
    def filter(self, record):
        return "/health" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Tamashii Billing Service...")
    try:
        validate_env()
        logger.info("Environment validation passed")
    except RuntimeError as e:
        logger.error(f"Environment validation failed: {e}")
        raise
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")
    yield
    logger.info("Shutting down...")


PREFIX = os.getenv("PREFIX", "")

app = FastAPI(
    title="Tamashii Billing",
    description="GPU billing with Railgun payments",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=f"{PREFIX}/docs" if PREFIX else "/docs",
    redoc_url=f"{PREFIX}/redoc" if PREFIX else "/redoc",
    openapi_url=f"{PREFIX}/openapi.json" if PREFIX else "/openapi.json",
)

app.include_router(auth_router, prefix=PREFIX)
app.include_router(balance_router, prefix=PREFIX)
app.include_router(jobs_router, prefix=PREFIX)


@app.get(f"{PREFIX}/health" if PREFIX else "/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
