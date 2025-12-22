import requests
try:
    res = requests.get("http://localhost:8000/reports/monthly-pdf?month=12&year=2024")
    print(f"Status: {res.status_code}")
    print(f"Content Length: {len(res.content)}")
    print(f"Content Start: {res.content[:20]}")
    if res.status_code != 200:
        print(f"Error: {res.text}")
except Exception as e:
    print(f"Exception: {e}")
