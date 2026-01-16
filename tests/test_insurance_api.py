"""
Insurance API Tests - Employee Insurance and Business Insurance
Tests for the Insurance page with two tabs: Employee Insurance and Business Insurance
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hr-insurance-suite.preview.emergentagent.com')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "super_admin"


class TestEmployeeInsurance:
    """Employee Insurance API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_all_insurance_records(self, auth_headers):
        """Test GET /api/insurance - List all employee insurance records"""
        response = requests.get(f"{BASE_URL}/api/insurance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} employee insurance records")
    
    def test_create_esic_covered_employee(self, auth_headers):
        """Test POST /api/insurance - Create ESIC-covered employee (only emp_code required)"""
        payload = {
            "emp_code": "EMP00001",
            "esic": True,
            "notes": "Test ESIC covered employee"
        }
        response = requests.post(f"{BASE_URL}/api/insurance", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "insurance" in data
        insurance = data["insurance"]
        assert insurance["esic"] == True
        assert insurance["emp_code"] == "EMP00001"
        # ESIC covered employees should have null insurance details
        assert insurance["insurance_date"] is None
        assert insurance["amount"] is None
        assert insurance["insurance_company"] is None
        print("SUCCESS: ESIC-covered employee created with only emp_code")
    
    def test_create_non_esic_employee(self, auth_headers):
        """Test POST /api/insurance - Create non-ESIC employee (all fields required)"""
        payload = {
            "emp_code": "EMP00001",
            "esic": False,
            "insurance_date": "2025-01-15",
            "amount": 75000,
            "insurance_company": "HDFC Ergo",
            "policy_number": "POL-TEST-001",
            "coverage_type": "health",
            "accidental_insurance": True,
            "notes": "Test non-ESIC employee"
        }
        response = requests.post(f"{BASE_URL}/api/insurance", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "insurance" in data
        insurance = data["insurance"]
        assert insurance["esic"] == False
        assert insurance["amount"] == 75000
        assert insurance["insurance_company"] == "HDFC Ergo"
        assert insurance["policy_number"] == "POL-TEST-001"
        print("SUCCESS: Non-ESIC employee created with all insurance details")
    
    def test_get_insurance_by_status(self, auth_headers):
        """Test GET /api/insurance?status=active - Filter by status"""
        response = requests.get(f"{BASE_URL}/api/insurance?status=active", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned records should have active status
        for record in data:
            assert record.get("status") == "active"
        print(f"Found {len(data)} active insurance records")
    
    def test_download_employee_insurance_template(self, auth_headers):
        """Test GET /api/import/templates/insurance - Download template"""
        response = requests.get(f"{BASE_URL}/api/import/templates/insurance", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print("SUCCESS: Employee insurance template downloaded")


class TestBusinessInsurance:
    """Business Insurance API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_all_business_insurance(self, auth_headers):
        """Test GET /api/business-insurance - List all business insurance records"""
        response = requests.get(f"{BASE_URL}/api/business-insurance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} business insurance records")
        
        # Verify record structure matches user's format
        if len(data) > 0:
            record = data[0]
            assert "name_of_insurance" in record
            assert "vehicle_no" in record
            assert "insurance_company" in record
            assert "date_of_issuance" in record
            assert "due_date" in record
    
    def test_create_business_insurance(self, auth_headers):
        """Test POST /api/business-insurance - Create new business insurance"""
        payload = {
            "name_of_insurance": "Test Machinery Insurance",
            "vehicle_no": "",
            "insurance_company": "New India Assurance",
            "date_of_issuance": "2025-01-01",
            "due_date": "2026-01-01",
            "notes": "Test business insurance record"
        }
        response = requests.post(f"{BASE_URL}/api/business-insurance", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "business_insurance" in data
        biz_ins = data["business_insurance"]
        assert biz_ins["name_of_insurance"] == "Test Machinery Insurance"
        assert biz_ins["insurance_company"] == "New India Assurance"
        print("SUCCESS: Business insurance record created")
    
    def test_create_vehicle_insurance(self, auth_headers):
        """Test POST /api/business-insurance - Create vehicle insurance with vehicle_no"""
        payload = {
            "name_of_insurance": "Test Vehicle Insurance",
            "vehicle_no": "MH02XY9999",
            "insurance_company": "Bajaj Allianz",
            "date_of_issuance": "2025-02-01",
            "due_date": "2026-02-01",
            "notes": "Test vehicle insurance"
        }
        response = requests.post(f"{BASE_URL}/api/business-insurance", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "business_insurance" in data
        biz_ins = data["business_insurance"]
        assert biz_ins["vehicle_no"] == "MH02XY9999"
        print("SUCCESS: Vehicle insurance record created with vehicle number")
    
    def test_download_business_insurance_template(self, auth_headers):
        """Test GET /api/import/templates/business-insurance - Download template"""
        response = requests.get(f"{BASE_URL}/api/import/templates/business-insurance", headers=auth_headers)
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print("SUCCESS: Business insurance template downloaded")


class TestInsuranceValidation:
    """Validation tests for insurance APIs"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_employee_insurance_requires_emp_code(self, auth_headers):
        """Test that employee insurance requires emp_code"""
        payload = {
            "esic": True
            # Missing emp_code
        }
        response = requests.post(f"{BASE_URL}/api/insurance", json=payload, headers=auth_headers)
        # Should fail validation
        assert response.status_code in [400, 422]
        print("SUCCESS: Validation correctly requires emp_code")
    
    def test_business_insurance_requires_name_and_company(self, auth_headers):
        """Test that business insurance requires name_of_insurance and insurance_company"""
        payload = {
            "vehicle_no": "MH01AB1234"
            # Missing required fields
        }
        response = requests.post(f"{BASE_URL}/api/business-insurance", json=payload, headers=auth_headers)
        # Should fail validation
        assert response.status_code in [400, 422]
        print("SUCCESS: Validation correctly requires name_of_insurance and insurance_company")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
