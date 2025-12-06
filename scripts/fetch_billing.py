#!/usr/bin/env python3
"""Fetch billing data - jobs and transactions"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("BACKEND_API_KEY")
BASE_URL = os.getenv("BASE_URL", "https://tamashii.compute3.ai")

if not API_KEY:
    raise RuntimeError("BACKEND_API_KEY not set in .env")


def main():
    print(f"Fetching billing data from {BASE_URL}\n")

    # 1. Get transactions
    print("=== RAILGUN TRANSACTIONS ===")
    r = requests.get(
        f"{BASE_URL}/railgun/transactions",
        headers={"X-BACKEND-API-KEY": API_KEY}
    )
    r.raise_for_status()
    txs = r.json().get("transactions", [])

    if not txs:
        print("No transactions found")
        return

    total_deposits = 0
    for tx in txs:
        print(f"\nTx: {tx.get('txid', 'N/A')[:16]}...")
        for recv in tx.get("received", []):
            amount_wei = int(recv.get("amount", 0))
            amount_bnb = amount_wei / 1e18
            total_deposits += amount_bnb
            addr = recv.get("from", "")[:40]
            print(f"  From: {addr}...")
            print(f"  Amount: {amount_bnb:.6f} BNB")

    print(f"\nTotal deposits: {total_deposits:.6f} BNB")

    # Get address from first tx
    received = txs[0].get("received", [])
    if not received:
        return
    address = received[0].get("from")

    # 2. Get admin JWT
    r = requests.post(
        f"{BASE_URL}/api/auth/admin",
        headers={"X-BACKEND-API-KEY": API_KEY},
        json={"address": address}
    )
    r.raise_for_status()
    token = r.json()["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 3. Get balance
    print("\n=== BALANCE ===")
    r = requests.get(f"{BASE_URL}/api/balance", headers=auth_headers)
    r.raise_for_status()
    balance = r.json()
    print(f"Address: {address[:40]}...")
    print(f"Deposits: {balance.get('deposits_bnb', 0):.6f} BNB")
    print(f"Spent:    {balance.get('spent_bnb', 0):.6f} BNB")
    print(f"Balance:  {balance.get('balance_bnb', 0):.6f} BNB (${balance.get('balance_usd', 0):.2f})")

    # 4. Get jobs
    print("\n=== JOBS ===")
    r = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers)
    r.raise_for_status()
    jobs = r.json()

    if not jobs:
        print("No jobs found")
        return

    total_spent = 0
    for job in jobs:
        cost = job.get("cost_bnb", 0)
        total_spent += cost
        print(f"\nJob: {job.get('id', 'N/A')[:8]}...")
        print(f"  C3 Job: {job.get('c3_job_id', 'N/A')}")
        print(f"  GPU: {job.get('gpu_type', 'N/A')}")
        print(f"  Cost: {cost:.6f} BNB")
        print(f"  Created: {job.get('created_at', 'N/A')}")

    print(f"\nTotal spent on jobs: {total_spent:.6f} BNB")


if __name__ == "__main__":
    main()
