import requests
import sys

BASE_URL = "http://localhost:8000"

def test_dashboard_stats():
    print("Testing /batches/stats...", end=" ")
    try:
        res = requests.get(f"{BASE_URL}/batches/stats")
        res.raise_for_status()
        data = res.json()
        
        if "cash_flow_projection" not in data:
            print("FAILED: 'cash_flow_projection' not found in response.")
            return False
        
        projection = data["cash_flow_projection"]
        if not isinstance(projection, list) or len(projection) != 4:
            print(f"FAILED: 'cash_flow_projection' structure invalid. Got: {projection}")
            return False
            
        print("OK")
        print(f"  > Cash Flow: {len(projection)} weeks projected.")
        return True
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

def test_search():
    print("Testing /search...", end=" ")
    try:
        # Search for "a" or something generic
        res = requests.get(f"{BASE_URL}/search/?q=Remesa")
        res.raise_for_status()
        results = res.json()
        
        if not isinstance(results, list):
             print("FAILED: Response is not a list.")
             return False
             
        print(f"OK ({len(results)} results found)")
        if len(results) > 0:
            print(f"  > First result: {results[0]['type']} - {results[0]['title']}")
        return True
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

def test_provider_insights():
    print("Testing /providers/{cif}/stats...", end=" ")
    # First get a valid CIF from search or list
    try:
        # GET one provider
        list_res = requests.get(f"{BASE_URL}/providers/?limit=1")
        providers = list_res.json()
        if not providers:
            print("SKIPPED (No providers to test)")
            return True
            
        cif = providers[0]['cif']
        print(f"(CIF: {cif}) ...", end=" ")
        
        res = requests.get(f"{BASE_URL}/providers/{cif}/stats")
        res.raise_for_status()
        data = res.json()
        
        if "insights" not in data:
             print("FAILED: 'insights' field missing.")
             return False
        
        print(f"OK (Insights: {len(data['insights'])})")
        for i in data['insights']:
            print(f"  > [{i['type']}] {i['message']}")
            
        return True
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

def test_monthly_report():
    print("Testing /reports/monthly-pdf...", end=" ")
    try:
        # Request for Dec 2024 (or current month)
        res = requests.get(f"{BASE_URL}/reports/monthly-pdf?month=12&year=2024")
        res.raise_for_status()
        
        content = res.content
        if not content.startswith(b"%PDF"):
             print("FAILED: Content is not PDF.")
             return False
             
        print(f"OK (PDF Size: {len(content)} bytes)")
        return True
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    print("--- STARTING VERIFICATION ---")
    s1 = test_dashboard_stats()
    s2 = test_search()
    s3 = test_provider_insights()
    s4 = test_monthly_report()
    
    if s1 and s2 and s3 and s4:
        print("\n✅ ALL BACKEND TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
