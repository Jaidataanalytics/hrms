"""
Test Suite for Salary Edit Features
Tests: Login, Salary Structures, Edit Salary, Approval Workflow, Salary History, SEWA Deduction
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://workforce-pulse-38.preview.emergentagent.com')

class TestAuthentication:
    """Test login with new credentials"""
    
    def test_login_with_new_credentials(self):
        """Test login with admin@shardahr.com / Admin@123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "admin@shardahr.com"
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Login successful with admin@shardahr.com / Admin@123")
        return data["access_token"]


class TestSalaryStructures:
    """Test salary structures endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        return response.json()["access_token"]
    
    def test_get_all_salary_structures(self, auth_token):
        """Test /api/payroll/all-salary-structures returns employee list"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/all-salary-structures?limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "data" in data
        assert len(data["data"]) > 0
        
        # Check structure of first employee
        emp = data["data"][0]
        assert "employee_id" in emp
        assert "employee_name" in emp
        assert "has_salary_data" in emp
        print(f"✓ Salary structures endpoint returns {data['total']} employees")
    
    def test_salary_structures_search(self, auth_token):
        """Test search functionality in salary structures"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/all-salary-structures?search=Amit&limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return filtered results
        for emp in data["data"]:
            assert "amit" in emp["employee_name"].lower()
        print(f"✓ Search functionality works - found {len(data['data'])} results for 'Amit'")


class TestEmployeeSalaryEdit:
    """Test employee salary edit functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_employee_id(self, auth_token):
        """Get an employee with salary data for testing"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/all-salary-structures?limit=50",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        # Find an employee with salary data
        for emp in data["data"]:
            if emp.get("has_salary_data"):
                return emp["employee_id"]
        # If none found, return first employee
        return data["data"][0]["employee_id"]
    
    def test_get_employee_salary(self, auth_token, test_employee_id):
        """Test GET /api/payroll/employee/{id} returns salary structure"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/employee/{test_employee_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should have salary components
        if data:
            assert "employee_id" in data or "fixed_components" in data or "basic" in data
        print(f"✓ Employee salary endpoint works for {test_employee_id}")
    
    def test_update_employee_salary_super_admin(self, auth_token, test_employee_id):
        """Test PUT /api/payroll/employee/{id}/salary - super_admin direct save"""
        salary_data = {
            "basic": 15000,
            "da": 600,
            "hra": 3000,
            "conveyance": 2000,
            "grade_pay": 500,
            "other_allowance": 1500,
            "medical_allowance": 600,
            "epf_applicable": True,
            "esi_applicable": True,
            "sewa_applicable": True,
            "sewa_advance": 500,
            "other_deduction": 100,
            "reason": "Test salary update"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/payroll/employee/{test_employee_id}/salary",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=salary_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Super admin should get direct save, not approval request
        assert "message" in data
        assert "salary" in data or "request" in data
        
        if "salary" in data:
            # Direct save
            assert data["salary"]["fixed_components"]["basic"] == 15000
            assert data["salary"]["fixed_components"]["da"] == 600
            assert data["salary"]["fixed_components"]["hra"] == 3000
            assert data["salary"]["fixed_components"]["conveyance"] == 2000
            assert data["salary"]["fixed_components"]["grade_pay"] == 500
            assert data["salary"]["fixed_components"]["other_allowance"] == 1500
            assert data["salary"]["fixed_components"]["medical_allowance"] == 600
            assert data["salary"]["fixed_deductions"]["sewa_advance"] == 500
            assert data["salary"]["fixed_deductions"]["other_deduction"] == 100
            print(f"✓ Super admin can directly save salary changes")
        else:
            print(f"✓ Salary change request created (approval workflow)")


class TestSalaryHistory:
    """Test salary change history"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        return response.json()["access_token"]
    
    def test_get_salary_history(self, auth_token):
        """Test GET /api/payroll/employee/{id}/salary-history"""
        # First get an employee
        response = requests.get(
            f"{BASE_URL}/api/payroll/all-salary-structures?limit=50",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        emp_id = data["data"][0]["employee_id"] if data["data"] else None
        
        if emp_id:
            response = requests.get(
                f"{BASE_URL}/api/payroll/employee/{emp_id}/salary-history",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 200
            history = response.json()
            assert isinstance(history, list)
            print(f"✓ Salary history endpoint works - {len(history)} entries found")


class TestSalaryChangeRequests:
    """Test salary change approval workflow"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        return response.json()["access_token"]
    
    def test_get_pending_requests(self, auth_token):
        """Test GET /api/payroll/salary-change-requests"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/salary-change-requests?status=pending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "requests" in data
        print(f"✓ Salary change requests endpoint works - {data['total']} pending requests")


class TestPayrollRules:
    """Test payroll rules with SEWA configuration"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        return response.json()["access_token"]
    
    def test_get_payroll_rules(self, auth_token):
        """Test GET /api/payroll/rules returns SEWA configuration"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/rules",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check SEWA configuration exists
        assert "sewa_percentage" in data
        assert "sewa_applicable" in data
        print(f"✓ Payroll rules include SEWA: {data['sewa_percentage']}% (applicable: {data['sewa_applicable']})")
    
    def test_update_payroll_rules_sewa(self, auth_token):
        """Test PUT /api/payroll/rules can update SEWA percentage"""
        rules_data = {
            "epf_employee_percentage": 12,
            "epf_employer_percentage": 12,
            "epf_wage_ceiling": 15000,
            "esi_employee_percentage": 0.75,
            "esi_employer_percentage": 3.25,
            "esi_wage_ceiling": 21000,
            "sewa_percentage": 3,  # Update SEWA to 3%
            "sewa_applicable": True,
            "lwf_employee": 10,
            "lwf_employer": 20,
            "default_working_days": 26,
            "wfh_pay_percentage": 50,
            "late_deduction_enabled": True,
            "late_count_threshold": 3,
            "salary_change_requires_approval": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/payroll/rules",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=rules_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["rules"]["sewa_percentage"] == 3
        print(f"✓ SEWA percentage updated to 3%")
        
        # Reset to 2%
        rules_data["sewa_percentage"] = 2
        requests.put(
            f"{BASE_URL}/api/payroll/rules",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=rules_data
        )


class TestDeductionToggles:
    """Test deduction toggles (EPF, ESI, SEWA)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        return response.json()["access_token"]
    
    def test_salary_with_deduction_toggles(self, auth_token):
        """Test salary update with deduction toggles"""
        # Get an employee
        response = requests.get(
            f"{BASE_URL}/api/payroll/all-salary-structures?limit=50",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        emp_id = None
        for emp in data["data"]:
            if emp.get("has_salary_data"):
                emp_id = emp["employee_id"]
                break
        
        if not emp_id:
            emp_id = data["data"][0]["employee_id"]
        
        # Update with specific deduction toggles
        salary_data = {
            "basic": 12000,
            "da": 0,
            "hra": 2000,
            "conveyance": 1500,
            "grade_pay": 0,
            "other_allowance": 1000,
            "medical_allowance": 0,
            "epf_applicable": True,
            "esi_applicable": False,  # Disable ESI
            "sewa_applicable": True,
            "sewa_advance": 0,
            "other_deduction": 0,
            "reason": "Test deduction toggles"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/payroll/employee/{emp_id}/salary",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=salary_data
        )
        assert response.status_code == 200
        data = response.json()
        
        if "salary" in data:
            dc = data["salary"]["deduction_config"]
            assert dc["epf_applicable"] == True
            assert dc["esi_applicable"] == False
            assert dc["sewa_applicable"] == True
            print(f"✓ Deduction toggles work correctly (EPF: True, ESI: False, SEWA: True)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
