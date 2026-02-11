#!/usr/bin/env python3

import requests
import sys

def test_bulk_import_endpoints():
    """Test bulk import specific endpoints"""
    base_url = "https://feedback-360.preview.emergentagent.com/api"
    
    # Login first
    login_response = requests.post(f"{base_url}/auth/login", json={
        "email": "admin@nexushr.com",
        "password": "Admin@123"
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return False
    
    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    print("🔍 Testing Bulk Import Endpoints...")
    
    # Test download employee template
    print("\n1. Testing Download Employee Template...")
    response = requests.get(f"{base_url}/import/templates/employees", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ Employee template download works")
        print(f"   Content-Type: {response.headers.get('content-type')}")
    else:
        print(f"   ❌ Failed: {response.text}")
    
    # Test download attendance template
    print("\n2. Testing Download Attendance Template...")
    response = requests.get(f"{base_url}/import/templates/attendance", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ Attendance template download works")
    else:
        print(f"   ❌ Failed: {response.text}")
    
    # Test download salary template
    print("\n3. Testing Download Salary Template...")
    response = requests.get(f"{base_url}/import/templates/salary", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ Salary template download works")
    else:
        print(f"   ❌ Failed: {response.text}")
    
    # Test export employees
    print("\n4. Testing Export All Employees...")
    response = requests.get(f"{base_url}/import/export/employees", headers=headers)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ Export employees works")
        print(f"   Content-Type: {response.headers.get('content-type')}")
    else:
        print(f"   ❌ Failed: {response.text}")
    
    return True

if __name__ == "__main__":
    test_bulk_import_endpoints()