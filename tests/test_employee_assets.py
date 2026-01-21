"""
Test Employee Assets API - Bulk Import Asset Visibility
Tests the GET /api/assets/employee-assignments endpoint that returns
employee assets from bulk import (stored in employee_assets collection)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmployeeAssetsAPI:
    """Tests for Employee Assets (Bulk Import) API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_employee_assignments_endpoint_exists(self):
        """Test GET /api/assets/employee-assignments returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("SUCCESS: GET /api/assets/employee-assignments returns 200")
    
    def test_employee_assignments_response_structure(self):
        """Test response has correct structure with total and records"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments",
            headers=self.headers
        )
        data = response.json()
        
        assert "total" in data, "Response missing 'total' field"
        assert "records" in data, "Response missing 'records' field"
        assert isinstance(data["total"], int), "'total' should be an integer"
        assert isinstance(data["records"], list), "'records' should be a list"
        print(f"SUCCESS: Response structure correct - total: {data['total']}, records: {len(data['records'])}")
    
    def test_employee_asset_record_fields(self):
        """Test each record has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments",
            headers=self.headers
        )
        data = response.json()
        
        if data["total"] > 0:
            record = data["records"][0]
            required_fields = [
                "emp_code", "employee_name", "sdpl_number", "tag",
                "mobile_charger", "laptop", "system", "printer", "sim_mobile_no"
            ]
            for field in required_fields:
                assert field in record, f"Record missing required field: {field}"
            print(f"SUCCESS: Record has all required fields: {required_fields}")
        else:
            pytest.skip("No employee asset records to test")
    
    def test_bulk_imported_data_visible(self):
        """Test that bulk-imported data (EMP00001 - Test User) is visible"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments",
            headers=self.headers
        )
        data = response.json()
        
        # Find EMP00001 record
        emp00001 = next((r for r in data["records"] if r["emp_code"] == "EMP00001"), None)
        assert emp00001 is not None, "EMP00001 not found in employee assets"
        
        # Verify data
        assert emp00001["employee_name"] == "Test User", f"Expected 'Test User', got '{emp00001['employee_name']}'"
        assert emp00001["system"] == True, "System should be True"
        assert emp00001["printer"] == True, "Printer should be True"
        print(f"SUCCESS: EMP00001 - Test User found with System=Yes, Printer=Yes")
    
    def test_search_by_emp_code(self):
        """Test search functionality by emp_code"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments?search=EMP00001",
            headers=self.headers
        )
        data = response.json()
        
        assert data["total"] >= 1, "Search by emp_code should return at least 1 result"
        assert any(r["emp_code"] == "EMP00001" for r in data["records"]), "EMP00001 should be in results"
        print("SUCCESS: Search by emp_code works")
    
    def test_search_by_employee_name(self):
        """Test search functionality by employee_name"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments?search=Test",
            headers=self.headers
        )
        data = response.json()
        
        assert data["total"] >= 1, "Search by employee_name should return at least 1 result"
        print("SUCCESS: Search by employee_name works")
    
    def test_search_no_results(self):
        """Test search with no matching results"""
        response = requests.get(
            f"{BASE_URL}/api/assets/employee-assignments?search=NONEXISTENT123",
            headers=self.headers
        )
        data = response.json()
        
        assert data["total"] == 0, "Search for non-existent should return 0 results"
        assert len(data["records"]) == 0, "Records should be empty"
        print("SUCCESS: Search with no results returns empty")
    
    def test_unauthorized_access(self):
        """Test endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/assets/employee-assignments")
        assert response.status_code == 401, f"Expected 401 for unauthenticated, got {response.status_code}"
        print("SUCCESS: Endpoint requires authentication")
    
    def test_asset_inventory_endpoint(self):
        """Test GET /api/assets (Asset Inventory) still works"""
        response = requests.get(
            f"{BASE_URL}/api/assets",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert isinstance(response.json(), list), "Response should be a list"
        print("SUCCESS: Asset Inventory endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
