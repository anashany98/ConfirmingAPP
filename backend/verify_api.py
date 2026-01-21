import requests
import os

API_URL = "http://localhost:8000/import/upload"

def test_upload(file_path):
    print(f"\n--- Testing upload: {file_path} ---")
    if not os.path.exists(file_path):
        print("File not found.")
        return

    with open(file_path, 'rb') as f:
        files = {'file': (os.path.basename(file_path), f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        try:
            response = requests.post(API_URL, files=files)
            if response.status_code == 200:
                data = response.json()
                print(f"Success! Status Code: {response.status_code}")
                # Analyze content
                valid_count = sum(1 for inv in data if inv.get('status') == 'VALID')
                error_count = sum(1 for inv in data if inv.get('status') != 'VALID')
                print(f"Rows processed: {len(data)}")
                print(f"VALID rows: {valid_count}")
                print(f"INVALID/WARNING rows: {error_count}")
                
                # Print first error if any
                if error_count > 0:
                    for inv in data:
                        if inv.get('status') != 'VALID':
                            print(f"Sample Error ({inv.get('status')}): {inv.get('validation_message')} - Row Data: {inv.get('cif')}, {inv.get('importe')}")
                            break
            else:
                print(f"Failed. Status Code: {response.status_code}")
                print(response.text)
        except Exception as e:
            print(f"Exception during request: {e}")

if __name__ == "__main__":
    test_upload("test_data/valid_invoices.xlsx")
    test_upload("test_data/invalid_invoices.xlsx")
