#!/usr/bin/env python3
"""Get admin JWT token for testing"""
import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("BACKEND_API_KEY")
BASE_URL = os.getenv("BASE_URL", "https://tamashii.compute3.ai")

if not API_KEY:
    print("BACKEND_API_KEY not set in .env")
    sys.exit(1)

# Get address from args or use default
address = sys.argv[1] if len(sys.argv) > 1 else "0zk1qy0chsgj3uj4e0u8ce4kymkgdslmpgph70rg"

r = requests.post(
    f"{BASE_URL}/api/auth/admin",
    headers={"X-BACKEND-API-KEY": API_KEY},
    json={"address": address}
)
r.raise_for_status()
data = r.json()
print(f"Token: {data['token']}")
print(f"Address: {data['address']}")
