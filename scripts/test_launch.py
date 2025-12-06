#!/usr/bin/env python3
"""Test script for launching a GPU job"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("BACKEND_API_KEY")
BASE_URL = os.getenv("BASE_URL", "https://tamashii.compute3.ai")

if not API_KEY:
    raise RuntimeError("BACKEND_API_KEY not set in .env")


def main():
    print(f"Testing job launch on {BASE_URL}\n")

    # 1. Get transactions to find an address with balance
    print("1. Fetching transactions from railgun...")
    r = requests.get(
        f"{BASE_URL}/railgun/transactions",
        headers={"X-BACKEND-API-KEY": API_KEY}
    )
    r.raise_for_status()
    txs = r.json().get("transactions", [])

    if not txs:
        print("   No transactions found - need deposits first")
        return

    received = txs[0].get("received", [])
    if not received:
        print("   No received data in transaction")
        return
    address = received[0].get("from")
    print(f"   Found address: {address[:40]}...")

    # 2. Get admin JWT
    print("\n2. Getting admin JWT...")
    r = requests.post(
        f"{BASE_URL}/api/auth/admin",
        headers={"X-BACKEND-API-KEY": API_KEY},
        json={"address": address}
    )
    r.raise_for_status()
    token = r.json()["token"]
    print(f"   Token: {token[:50]}...")

    auth_headers = {"Authorization": f"Bearer {token}"}

    # 3. Check balance
    print("\n3. Checking balance...")
    r = requests.get(f"{BASE_URL}/api/balance", headers=auth_headers)
    r.raise_for_status()
    balance = r.json()
    print(f"   Balance: {balance['balance_bnb']:.6f} BNB (${balance['balance_usd']:.2f})")

    # 4. Launch job
    print("\n4. Launching job...")
    import random
    import string
    api_key = 'tamashii_instance_' + ''.join(random.choices(string.ascii_letters + string.digits, k=24))
    job_config = {
        "gpu_type": "l4",
        "image": "ghcr.io/compute3ai/images/c3-vllm",
        "duration_seconds": 600,
        "region": "kr",
        "env": {
            "MODEL_NAME": "NousResearch/Hermes-3-Llama-3.2-3B",
            "SERVED_MODEL_NAME": "hermes3:3b",
            "MAX_MODEL_LEN": "8192",
            "GPU_MEMORY_UTILIZATION": "0.90",
            "API_KEY": api_key,
        },
        "ports": {"lb": 8000},
    }
    print(f"   Config: {job_config}")

    r = requests.post(f"{BASE_URL}/api/jobs", headers=auth_headers, json=job_config)
    if r.status_code == 402:
        print(f"   Insufficient balance: {r.json()['detail']}")
        return
    r.raise_for_status()
    job = r.json()
    print(f"   Job launched!")
    print(f"   ID: {job['id']}")
    print(f"   C3 Job ID: {job['c3_job_id']}")
    print(f"   Cost: {job['cost_bnb']:.6f} BNB (${job['cost_usd']:.2f})")
    print(f"   Hostname: {job.get('hostname', 'N/A')}")
    print(f"   API Key: {api_key}")

    # 5. Check balance after
    print("\n5. Checking balance after launch...")
    r = requests.get(f"{BASE_URL}/api/balance", headers=auth_headers)
    r.raise_for_status()
    balance = r.json()
    print(f"   Balance: {balance['balance_bnb']:.6f} BNB (${balance['balance_usd']:.2f})")

    print("\nDone!")


if __name__ == "__main__":
    main()
