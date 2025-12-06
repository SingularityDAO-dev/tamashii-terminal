"""
Telegram notification system for operational events.

Single portable file - works in any environment:
- Director/Backend: Use notify() (requires httpx)
- Lambda/Threads: Use notify_sync() (requires urllib3)

Drop this file anywhere and import what you need.

Usage:
    from notify import notify, notify_sync, Category, Severity

    # In FastAPI/async
    await notify(Category.BILLING, Severity.INFO, "Job charged $5", job_id="123")

    # In Lambda/sync
    notify_sync(Category.EC2, Severity.INFO, "Instance started", instance_id="i-123")
"""

import logging
import os
from enum import Enum

logger = logging.getLogger(__name__)


class Category(Enum):
    """Event categories - route to different Telegram channels"""
    EC2 = "ec2"
    INSTANCES = "instances"
    BILLING = "billing"
    JOBS = "jobs"
    SCALING = "scaling"
    SYSTEM = "system"
    RENDER = "render"


class Severity(Enum):
    """Event severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


# Configuration from environment
NOTIFY_URL = os.getenv("NOTIFY_URL")  # e.g. https://notify.compute3.ai/notify
NOTIFY_API_KEY = os.getenv("NOTIFY_API_KEY")
NOTIFY_TIMEOUT = float(os.getenv("NOTIFY_TIMEOUT", "2.0"))


async def notify(category: Category, severity: Severity, message: str, **meta):
    """
    Send notification to Telegram (async, non-blocking).

    Use in async contexts (FastAPI handlers, async functions).
    Requires: httpx

    Args:
        category: Event category (routes to specific Telegram channel)
        severity: Event severity (info/warning/error)
        message: Human-readable message
        **meta: Optional structured metadata (job_id, cost, etc.)

    Example:
        await notify(Category.BILLING, Severity.INFO,
                     f"Job {job_id} charged ${cost:.2f}",
                     job_id=job_id, cost=cost, runtime=120)
    """
    # Lazy import - only loads in environments that use this function
    import httpx

    if not NOTIFY_URL or not NOTIFY_API_KEY:
        return  # Silently skip if not configured

    payload = {
        "category": category.value,
        "severity": severity.value,
        "message": message,
        "meta": meta
    }

    # Single flat endpoint
    url = NOTIFY_URL

    try:
        async with httpx.AsyncClient(timeout=NOTIFY_TIMEOUT) as client:
            await client.post(
                url,
                json=payload,
                headers={"X-BACKEND-API-KEY": NOTIFY_API_KEY}
            )
    except Exception as e:
        # Never let notifications break the app
        logger.debug(f"Telegram notification failed ({category.value}/{severity.value}): {e}")


def notify_sync(category: Category, severity: Severity, message: str, **meta):
    """
    Send notification to Telegram (sync, blocking).

    Use in sync contexts (Lambda functions, threads, sync helpers).
    Requires: urllib3 (built into AWS Lambda)

    Args:
        category: Event category (routes to specific Telegram channel)
        severity: Event severity (info/warning/error)
        message: Human-readable message
        **meta: Optional structured metadata

    Example:
        notify_sync(Category.EC2, Severity.INFO,
                    f"Instance {instance_id} launched",
                    instance_id=instance_id, region=region)
    """
    # Lazy import - only loads in environments that use this function
    import urllib3
    import json

    if not NOTIFY_URL or not NOTIFY_API_KEY:
        return  # Silently skip if not configured

    payload = {
        "category": category.value,
        "severity": severity.value,
        "message": message,
        "meta": meta
    }

    # Single flat endpoint
    url = NOTIFY_URL

    try:
        http = urllib3.PoolManager(timeout=urllib3.Timeout(total=NOTIFY_TIMEOUT))

        response = http.request(
            'POST',
            url,
            body=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'X-BACKEND-API-KEY': NOTIFY_API_KEY
            }
        )

        if response.status != 200:
            logger.debug(f"Telegram notification failed ({category.value}/{severity.value}): HTTP {response.status}")

    except Exception as e:
        # Never let notifications break the app
        logger.debug(f"Telegram notification failed ({category.value}/{severity.value}): {e}")


def notify_background(category: Category, severity: Severity, message: str, **meta):
    """
    Send notification as background task.

    Works in both async and sync/thread contexts:
    - Async contexts: Creates a background task without blocking
    - Sync/thread contexts: Falls back to sync notification

    Args:
        Same as notify()

    Example:
        notify_background(Category.SCALING, Severity.INFO,
                         f"Scaling up {asg_name}",
                         asg_name=asg_name)
    """
    # Lazy import - only loads in environments that use this function
    import asyncio

    try:
        asyncio.create_task(notify(category, severity, message, **meta))
    except RuntimeError:
        # No event loop (e.g., in tests or threads) - use sync version
        notify_sync(category, severity, message, **meta)
