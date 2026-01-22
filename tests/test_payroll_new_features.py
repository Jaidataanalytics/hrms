"""
Test Payroll New Features - SEWA Advances, One-time Deductions, Payslip Edit
Tests the new payroll calculation system overhaul features
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPayrollNewFeatures:
    """Test SEWA Advances, One-time Deductions, and Payslip Edit endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get session
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        if login_response.status_code == 200:
            # Session cookie should be set automatically
            pass
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test data created during tests
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data after tests"""
        try:
            # Get and delete test SEWA advances
            advances = self.session.get(f"{BASE_URL}/api/payroll/sewa-advances").json()
            for adv in advances:
                if adv.get("reason", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/payroll/sewa-advances/{adv['advance_id']}")
            
            # Get and delete test one-time deductions
            deductions = self.session.get(f"{BASE_URL}/api/payroll/one-time-deductions?month=1&year=2026").json()
            for ded in deductions:
                if ded.get("reason", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/payroll/one-time-deductions/{ded['deduction_id']}")
        except Exception:
            pass
    
    # ==================== SEWA ADVANCES TESTS ====================
    
    def test_get_sewa_advances_list(self):
        """Test GET /api/payroll/sewa-advances returns list"""
        response = self.session.get(f"{BASE_URL}/api/payroll/sewa-advances")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/payroll/sewa-advances returns {len(data)} advances")
    
    def test_create_sewa_advance_requires_employee_id(self):
        """Test POST /api/payroll/sewa-advances requires employee_id"""
        response = self.session.post(
            f"{BASE_URL}/api/payroll/sewa-advances",
            json={"total_amount": 5000, "monthly_amount": 500}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Employee ID" in response.json().get("detail", "")
        print("✓ POST /api/payroll/sewa-advances validates employee_id required")
    
    def test_create_sewa_advance_requires_valid_amounts(self):
        """Test POST /api/payroll/sewa-advances requires valid amounts"""
        # First get an employee
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        if emp_response.status_code != 200:
            pytest.skip("Could not get employees")
        
        employees = emp_response.json()
        if not employees.get("employees"):
            pytest.skip("No employees found")
        
        employee_id = employees["employees"][0]["employee_id"]
        
        response = self.session.post(
            f"{BASE_URL}/api/payroll/sewa-advances",
            json={"employee_id": employee_id, "total_amount": 0, "monthly_amount": 0}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ POST /api/payroll/sewa-advances validates amounts > 0")
    
    def test_create_sewa_advance_success(self):
        """Test POST /api/payroll/sewa-advances creates advance successfully"""
        # Get an employee without active SEWA advance
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=50")
        if emp_response.status_code != 200:
            pytest.skip("Could not get employees")
        
        employees = emp_response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        
        # Get existing advances to find employee without one
        advances_response = self.session.get(f"{BASE_URL}/api/payroll/sewa-advances")
        existing_emp_ids = set()
        if advances_response.status_code == 200:
            for adv in advances_response.json():
                if adv.get("is_active"):
                    existing_emp_ids.add(adv.get("employee_id"))
        
        # Find employee without active advance
        test_employee = None
        for emp in employees:
            if emp["employee_id"] not in existing_emp_ids:
                test_employee = emp
                break
        
        if not test_employee:
            pytest.skip("All employees have active SEWA advances")
        
        response = self.session.post(
            f"{BASE_URL}/api/payroll/sewa-advances",
            json={
                "employee_id": test_employee["employee_id"],
                "total_amount": 10000,
                "monthly_amount": 1000,
                "duration_months": 10,
                "reason": "TEST_SEWA_Advance"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "advance_id" in data, "Response should contain advance_id"
        assert data["total_amount"] == 10000
        assert data["monthly_amount"] == 1000
        assert data["remaining_amount"] == 10000
        assert data["is_active"] == True
        print(f"✓ POST /api/payroll/sewa-advances created advance {data['advance_id']}")
        
        # Store for cleanup
        self.created_advance_id = data["advance_id"]
    
    def test_delete_sewa_advance(self):
        """Test DELETE /api/payroll/sewa-advances/{id} cancels advance"""
        # First create an advance
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=50")
        employees = emp_response.json().get("employees", [])
        
        # Get existing advances
        advances_response = self.session.get(f"{BASE_URL}/api/payroll/sewa-advances")
        existing_emp_ids = set()
        if advances_response.status_code == 200:
            for adv in advances_response.json():
                if adv.get("is_active"):
                    existing_emp_ids.add(adv.get("employee_id"))
        
        test_employee = None
        for emp in employees:
            if emp["employee_id"] not in existing_emp_ids:
                test_employee = emp
                break
        
        if not test_employee:
            pytest.skip("No employee available for test")
        
        # Create advance
        create_response = self.session.post(
            f"{BASE_URL}/api/payroll/sewa-advances",
            json={
                "employee_id": test_employee["employee_id"],
                "total_amount": 5000,
                "monthly_amount": 500,
                "reason": "TEST_DELETE_Advance"
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create advance for delete test")
        
        advance_id = create_response.json()["advance_id"]
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/payroll/sewa-advances/{advance_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print(f"✓ DELETE /api/payroll/sewa-advances/{advance_id} cancelled advance")
    
    # ==================== ONE-TIME DEDUCTIONS TESTS ====================
    
    def test_get_one_time_deductions_list(self):
        """Test GET /api/payroll/one-time-deductions returns list"""
        response = self.session.get(f"{BASE_URL}/api/payroll/one-time-deductions?month=1&year=2026")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/payroll/one-time-deductions returns {len(data)} deductions")
    
    def test_create_one_time_deduction_requires_employee_id(self):
        """Test POST /api/payroll/one-time-deductions requires employee_id"""
        response = self.session.post(
            f"{BASE_URL}/api/payroll/one-time-deductions",
            json={"amount": 1000, "reason": "Test", "month": 1, "year": 2026}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ POST /api/payroll/one-time-deductions validates employee_id required")
    
    def test_create_one_time_deduction_success(self):
        """Test POST /api/payroll/one-time-deductions creates deduction"""
        # Get an employee
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        if emp_response.status_code != 200:
            pytest.skip("Could not get employees")
        
        employees = emp_response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        
        employee_id = employees[0]["employee_id"]
        
        response = self.session.post(
            f"{BASE_URL}/api/payroll/one-time-deductions",
            json={
                "employee_id": employee_id,
                "amount": 2500,
                "reason": "TEST_Loan_EMI",
                "category": "loan_emi",
                "month": 1,
                "year": 2026
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "deduction_id" in data, "Response should contain deduction_id"
        assert data["amount"] == 2500
        assert data["category"] == "loan_emi"
        print(f"✓ POST /api/payroll/one-time-deductions created deduction {data['deduction_id']}")
    
    def test_delete_one_time_deduction(self):
        """Test DELETE /api/payroll/one-time-deductions/{id} removes deduction"""
        # First create a deduction
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        employees = emp_response.json().get("employees", [])
        
        if not employees:
            pytest.skip("No employees found")
        
        employee_id = employees[0]["employee_id"]
        
        create_response = self.session.post(
            f"{BASE_URL}/api/payroll/one-time-deductions",
            json={
                "employee_id": employee_id,
                "amount": 1000,
                "reason": "TEST_DELETE_Deduction",
                "category": "other",
                "month": 1,
                "year": 2026
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create deduction for delete test")
        
        deduction_id = create_response.json()["deduction_id"]
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/payroll/one-time-deductions/{deduction_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print(f"✓ DELETE /api/payroll/one-time-deductions/{deduction_id} removed deduction")
    
    # ==================== PAYSLIP EDIT TESTS ====================
    
    def test_get_payroll_run_details(self):
        """Test GET /api/payroll/runs/{id} returns payroll details with payslips"""
        # Get payroll runs
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        if runs_response.status_code != 200:
            pytest.skip("Could not get payroll runs")
        
        runs = runs_response.json()
        if not runs:
            pytest.skip("No payroll runs found")
        
        # Find a processed run
        processed_run = None
        for run in runs:
            if run.get("status") in ["processed", "locked"]:
                processed_run = run
                break
        
        if not processed_run:
            pytest.skip("No processed payroll runs found")
        
        response = self.session.get(f"{BASE_URL}/api/payroll/runs/{processed_run['payroll_id']}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "payroll" in data, "Response should contain payroll"
        assert "payslips" in data, "Response should contain payslips"
        assert "summary" in data, "Response should contain summary"
        print(f"✓ GET /api/payroll/runs/{processed_run['payroll_id']} returns details with {len(data['payslips'])} payslips")
    
    def test_update_payslip_not_found(self):
        """Test PUT /api/payroll/payslips/{id} returns 404 for non-existent payslip"""
        response = self.session.put(
            f"{BASE_URL}/api/payroll/payslips/nonexistent_id",
            json={"gross_salary": 50000}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT /api/payroll/payslips returns 404 for non-existent payslip")
    
    def test_update_payslip_with_recalculate(self):
        """Test PUT /api/payroll/payslips/{id} with recalculate=true"""
        # Get a payslip from a non-locked payroll
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        if runs_response.status_code != 200:
            pytest.skip("Could not get payroll runs")
        
        runs = runs_response.json()
        
        # Find a processed (not locked) run
        processed_run = None
        for run in runs:
            if run.get("status") == "processed":
                processed_run = run
                break
        
        if not processed_run:
            pytest.skip("No processed (unlocked) payroll runs found")
        
        # Get payslips for this run
        details_response = self.session.get(f"{BASE_URL}/api/payroll/runs/{processed_run['payroll_id']}")
        if details_response.status_code != 200:
            pytest.skip("Could not get payroll details")
        
        payslips = details_response.json().get("payslips", [])
        if not payslips:
            pytest.skip("No payslips found in payroll run")
        
        test_payslip = payslips[0]
        
        # Update with recalculate
        response = self.session.put(
            f"{BASE_URL}/api/payroll/payslips/{test_payslip['payslip_id']}",
            json={
                "recalculate": True,
                "attendance": {
                    "office_days": 20,
                    "sundays_holidays": 5,
                    "leave_days": 2,
                    "wfh_days": 4,
                    "late_count": 1
                }
            }
        )
        
        # Could be 200 (success) or 400 (no salary structure)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ PUT /api/payroll/payslips/{test_payslip['payslip_id']} recalculated successfully")
        else:
            print(f"✓ PUT /api/payroll/payslips returns 400 when salary structure missing (expected)")
    
    def test_update_payslip_locked_payroll(self):
        """Test PUT /api/payroll/payslips/{id} returns 400 for locked payroll"""
        # Get a payslip from a locked payroll
        runs_response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        if runs_response.status_code != 200:
            pytest.skip("Could not get payroll runs")
        
        runs = runs_response.json()
        
        # Find a locked run
        locked_run = None
        for run in runs:
            if run.get("status") == "locked":
                locked_run = run
                break
        
        if not locked_run:
            pytest.skip("No locked payroll runs found")
        
        # Get payslips for this run
        details_response = self.session.get(f"{BASE_URL}/api/payroll/runs/{locked_run['payroll_id']}")
        if details_response.status_code != 200:
            pytest.skip("Could not get payroll details")
        
        payslips = details_response.json().get("payslips", [])
        if not payslips:
            pytest.skip("No payslips found in locked payroll run")
        
        test_payslip = payslips[0]
        
        # Try to update
        response = self.session.put(
            f"{BASE_URL}/api/payroll/payslips/{test_payslip['payslip_id']}",
            json={"gross_salary": 99999}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "locked" in response.json().get("detail", "").lower()
        print("✓ PUT /api/payroll/payslips returns 400 for locked payroll")
    
    # ==================== PAYROLL RULES TESTS ====================
    
    def test_get_payroll_rules(self):
        """Test GET /api/payroll/rules returns payroll rules"""
        response = self.session.get(f"{BASE_URL}/api/payroll/rules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should have EPF, ESI, SEWA percentages
        print(f"✓ GET /api/payroll/rules returns rules with EPF: {data.get('epf_employee_percentage')}%, ESI: {data.get('esi_employee_percentage')}%")
    
    def test_get_all_salary_structures(self):
        """Test GET /api/payroll/all-salary-structures returns employee salaries"""
        response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "data" in data, "Response should contain data array"
        assert "total" in data, "Response should contain total count"
        print(f"✓ GET /api/payroll/all-salary-structures returns {data['total']} employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
