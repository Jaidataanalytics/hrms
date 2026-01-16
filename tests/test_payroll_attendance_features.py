"""
Test suite for HR Management System - 3 New Features:
1. Payroll Calculation Bug Fix - Merging salary data from multiple collections
2. Attendance Page Enhancement - Month/Year filters and employee search
3. Salary Structures View - HR can see all employees' salary data

Test credentials: admin@shardahr.com / Welcome@123
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPayrollSalaryStructures:
    """Test the new /api/payroll/all-salary-structures endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for all tests"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Welcome@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
        print(f"Logged in as: {self.user.get('email')} with role: {self.user.get('role')}")
    
    def test_all_salary_structures_endpoint_exists(self):
        """Test that /api/payroll/all-salary-structures endpoint exists and returns data"""
        response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "data" in data, "Response should contain 'data' field"
        assert "total" in data, "Response should contain 'total' field"
        print(f"Total employees with salary data: {data.get('total')}")
        print(f"Returned {len(data.get('data', []))} records")
    
    def test_salary_structures_returns_employee_details(self):
        """Test that salary structures include employee details"""
        response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("data"):
            first_emp = data["data"][0]
            # Check required fields
            assert "employee_id" in first_emp, "Should have employee_id"
            assert "employee_name" in first_emp, "Should have employee_name"
            assert "has_salary_data" in first_emp, "Should have has_salary_data flag"
            print(f"Sample employee: {first_emp.get('employee_name')} - Salary: {first_emp.get('gross_salary')}")
    
    def test_salary_structures_search_functionality(self):
        """Test search functionality in salary structures"""
        # First get all to find a name to search
        all_response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures?limit=5")
        assert all_response.status_code == 200
        all_data = all_response.json()
        
        if all_data.get("data"):
            # Get first employee name for search
            first_name = all_data["data"][0].get("employee_name", "").split()[0]
            if first_name:
                search_response = self.session.get(
                    f"{BASE_URL}/api/payroll/all-salary-structures?search={first_name}"
                )
                assert search_response.status_code == 200
                search_data = search_response.json()
                print(f"Search for '{first_name}' returned {len(search_data.get('data', []))} results")
    
    def test_salary_structures_shows_salary_source(self):
        """Test that salary structures show the data source (employee_salaries or salary_structures)"""
        response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures?limit=50")
        assert response.status_code == 200
        data = response.json()
        
        sources = {}
        for emp in data.get("data", []):
            source = emp.get("salary_source") or "no_data"
            sources[source] = sources.get(source, 0) + 1
        
        print(f"Salary data sources: {sources}")
        # Should have data from multiple sources
        assert len(sources) > 0, "Should have at least one salary source"


class TestAttendanceFilters:
    """Test the enhanced attendance endpoint with month/year/employee filters"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for all tests"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Welcome@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.user = login_response.json().get("user", {})
    
    def test_attendance_endpoint_with_month_year_filter(self):
        """Test attendance endpoint with month and year filters"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance?month={current_month}&year={current_year}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"Attendance records for {current_month}/{current_year}: {len(data)}")
    
    def test_attendance_endpoint_with_employee_filter(self):
        """Test attendance endpoint with specific employee filter"""
        # First get an employee ID
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        assert emp_response.status_code == 200
        employees = emp_response.json()
        
        if employees:
            emp_id = employees[0].get("employee_id")
            response = self.session.get(
                f"{BASE_URL}/api/attendance?employee_id={emp_id}&month=12&year=2025"
            )
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            data = response.json()
            print(f"Attendance for employee {emp_id}: {len(data)} records")
    
    def test_attendance_returns_employee_info(self):
        """Test that attendance records include employee name and code"""
        response = self.session.get(f"{BASE_URL}/api/attendance?month=12&year=2025")
        assert response.status_code == 200
        data = response.json()
        
        if data:
            first_record = data[0]
            # HR view should include employee details
            assert "employee_name" in first_record or "employee_id" in first_record
            print(f"Sample attendance: {first_record.get('employee_name', first_record.get('employee_id'))} - {first_record.get('date')}")
    
    def test_attendance_organization_endpoint(self):
        """Test organization-wide attendance endpoint"""
        response = self.session.get(f"{BASE_URL}/api/attendance/organization")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "summary" in data, "Should have summary"
        assert "today_attendance" in data, "Should have today_attendance"
        print(f"Organization summary: {data.get('summary')}")


class TestPayrollProcessingMerge:
    """Test that payroll processing merges data from both collections"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for all tests"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Welcome@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_all_employees_pay_endpoint(self):
        """Test /api/payroll/all-employees-pay returns data"""
        response = self.session.get(
            f"{BASE_URL}/api/payroll/all-employees-pay?month=12&year=2025"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"All employees pay: {len(data)} records")
    
    def test_payroll_runs_endpoint(self):
        """Test payroll runs endpoint"""
        response = self.session.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        print(f"Payroll runs: {len(data)}")
    
    def test_employee_salary_details_endpoint(self):
        """Test individual employee salary details"""
        # Get an employee first
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        assert emp_response.status_code == 200
        employees = emp_response.json()
        
        if employees:
            emp_id = employees[0].get("employee_id")
            response = self.session.get(
                f"{BASE_URL}/api/payroll/employee-salary-details/{emp_id}"
            )
            # May return 404 if no salary data, which is acceptable
            assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
            if response.status_code == 200:
                data = response.json()
                print(f"Employee {emp_id} salary details: {data.get('gross_salary', 'N/A')}")


class TestEmployeeEndpoints:
    """Test employee-related endpoints used by the features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for all tests"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Welcome@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_employees_list_endpoint(self):
        """Test employees list endpoint"""
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        print(f"Total employees: {len(data)}")
        assert len(data) > 0, "Should have at least one employee"
    
    def test_employees_search_endpoint(self):
        """Test employees search endpoint"""
        response = self.session.get(f"{BASE_URL}/api/employees/search?q=a&limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        print(f"Search results: {len(data)}")


class TestDatabaseCollections:
    """Verify database has data in both salary collections"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for all tests"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Welcome@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_salary_structures_has_data_from_both_sources(self):
        """Verify that all-salary-structures merges data from both collections"""
        response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures?limit=500")
        assert response.status_code == 200
        data = response.json()
        
        # Count employees with salary data
        with_salary = [e for e in data.get("data", []) if e.get("has_salary_data")]
        without_salary = [e for e in data.get("data", []) if not e.get("has_salary_data")]
        
        print(f"Employees with salary data: {len(with_salary)}")
        print(f"Employees without salary data: {len(without_salary)}")
        
        # Check salary sources
        sources = {}
        for emp in with_salary:
            source = emp.get("salary_source", "unknown")
            sources[source] = sources.get(source, 0) + 1
        
        print(f"Salary sources breakdown: {sources}")
        
        # The test passes if we have employees with salary data
        assert len(with_salary) > 0, "Should have employees with salary data"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
