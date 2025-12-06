#!/usr/bin/env python3
"""Test script for Tamashii API endpoints"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("BACKEND_API_KEY")
BASE_URL = os.getenv("BASE_URL", "https://tamashii.compute3.ai")

if not API_KEY:
    raise RuntimeError("BACKEND_API_KEY not set in .env")


def main():
    print(f"Testing {BASE_URL}\n")

    # 1. Get transactions from railgun to find an address
    print("1. Fetching transactions from railgun...")
    r = requests.get(
        f"{BASE_URL}/railgun/transactions",
        headers={"X-BACKEND-API-KEY": API_KEY}
    )
    r.raise_for_status()
    txs = r.json().get("transactions", [])

    if not txs:
        print("   No transactions found")
        return

    # Get sender address from first transaction's received field
    received = txs[0].get("received", [])
    if not received:
        print("   No received data in transaction")
        return
    address = received[0].get("from")
    print(f"   Found address: {address[:40]}...")

    # 2. Get admin JWT for this address
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

    # 3. Test balance endpoint
    print("\n3. Testing /api/balance...")
    r = requests.get(f"{BASE_URL}/api/balance", headers=auth_headers)
    r.raise_for_status()
    balance = r.json()
    print(f"   Balance: {balance.get('balance_bnb', 0):.6f} BNB (${balance.get('balance_usd', 0):.2f})")

    # 4. Test jobs list endpoint
    print("\n4. Testing /api/jobs...")
    r = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers)
    r.raise_for_status()
    jobs = r.json()
    print(f"   Jobs: {len(jobs)} found")

    print("\nAll tests passed!")


if __name__ == "__main__":
    main()
