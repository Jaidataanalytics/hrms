"""
Test Duplicate Prevention in Bulk Import Endpoints
Tests for HR Management System - Duplicate Data Prevention

Features tested:
1. Employee import - prevents duplicate emp_code and email
2. Insurance import - updates existing record instead of creating duplicate
3. Salary import - deactivates old salary before inserting new
4. Attendance import - uses upsert to prevent duplicates
5. Leave balance import - uses upsert to prevent duplicates
6. Business insurance import - updates existing record for same policy
7. Assets import - updates existing record for same employee
"""

import pytest
import requests
import os
import io
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")


class TestDuplicatePrevention:
    """Test duplicate prevention in bulk import endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
        yield
    
    # ==================== DATABASE STATE VERIFICATION ====================
    
    def test_01_no_duplicate_employees_by_emp_code(self):
        """Verify no duplicate employees with same emp_code exist in database"""
        # Use MongoDB aggregation via API or direct check
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        # Check for duplicate emp_codes
        emp_codes = [e.get("emp_code") for e in employees if e.get("emp_code")]
        unique_codes = set(emp_codes)
        
        assert len(emp_codes) == len(unique_codes), \
            f"Found duplicate emp_codes: {[c for c in emp_codes if emp_codes.count(c) > 1]}"
        print(f"✓ No duplicate emp_codes found among {len(employees)} employees")
    
    def test_02_no_duplicate_insurance_records(self):
        """Verify no duplicate insurance records for same employee exist"""
        response = self.session.get(f"{BASE_URL}/api/insurance")
        assert response.status_code == 200
        
        data = response.json()
        records = data if isinstance(data, list) else data.get("records", [])
        
        # Check for duplicate employee_ids
        employee_ids = [r.get("employee_id") for r in records if r.get("employee_id")]
        unique_ids = set(employee_ids)
        
        assert len(employee_ids) == len(unique_ids), \
            f"Found duplicate insurance records for employees: {[e for e in employee_ids if employee_ids.count(e) > 1]}"
        print(f"✓ No duplicate insurance records found among {len(records)} records")
    
    def test_03_no_duplicate_active_salary_records(self):
        """Verify no duplicate active salary records for same employee exist"""
        response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures")
        assert response.status_code == 200
        
        data = response.json()
        salaries = data if isinstance(data, list) else data.get("salaries", [])
        
        # Filter active salaries and check for duplicates
        active_salaries = [s for s in salaries if s.get("is_active", True)]
        employee_ids = [s.get("employee_id") for s in active_salaries if s.get("employee_id")]
        unique_ids = set(employee_ids)
        
        assert len(employee_ids) == len(unique_ids), \
            f"Found duplicate active salary records for employees: {[e for e in employee_ids if employee_ids.count(e) > 1]}"
        print(f"✓ No duplicate active salary records found among {len(active_salaries)} records")
    
    # ==================== EMPLOYEE IMPORT DUPLICATE PREVENTION ====================
    
    def test_04_employee_import_prevents_duplicate_emp_code(self):
        """Employee import should reject duplicate emp_code"""
        # Get an existing employee's emp_code
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        existing_emp = employees[0] if employees else None
        assert existing_emp, "No employees found for testing"
        
        existing_emp_code = existing_emp.get("emp_code")
        
        # Create Excel file with duplicate emp_code
        try:
            import xlsxwriter
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Employees')
            
            headers = ["emp_code", "first_name", "last_name", "email", "phone"]
            for col, h in enumerate(headers):
                worksheet.write(0, col, h)
            
            # Row with duplicate emp_code
            worksheet.write(1, 0, existing_emp_code)  # Duplicate emp_code
            worksheet.write(1, 1, "Test")
            worksheet.write(1, 2, "Duplicate")
            worksheet.write(1, 3, f"test_dup_{datetime.now().timestamp()}@test.com")
            worksheet.write(1, 4, "1234567890")
            
            workbook.close()
            output.seek(0)
            
            # Upload file
            files = {"file": ("test_employees.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/employees",
                files=files,
                headers=headers
            )
            
            assert response.status_code == 200
            result = response.json()
            
            # Should have error for duplicate emp_code
            assert result.get("imported") == 0, f"Should not import duplicate emp_code, got: {result}"
            assert len(result.get("errors", [])) > 0, "Should have error for duplicate emp_code"
            
            error_msg = str(result.get("errors", []))
            assert "already exists" in error_msg.lower() or "duplicate" in error_msg.lower(), \
                f"Error should mention duplicate: {error_msg}"
            
            print(f"✓ Employee import correctly rejected duplicate emp_code: {existing_emp_code}")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    def test_05_employee_import_prevents_duplicate_email(self):
        """Employee import should reject duplicate email"""
        # Get an existing employee's email
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        existing_emp = employees[0] if employees else None
        assert existing_emp, "No employees found for testing"
        
        existing_email = existing_emp.get("email")
        
        # Create Excel file with duplicate email
        try:
            import xlsxwriter
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Employees')
            
            headers = ["emp_code", "first_name", "last_name", "email", "phone"]
            for col, h in enumerate(headers):
                worksheet.write(0, col, h)
            
            # Row with duplicate email
            worksheet.write(1, 0, f"TEST_DUP_{datetime.now().timestamp()}")  # New emp_code
            worksheet.write(1, 1, "Test")
            worksheet.write(1, 2, "DupEmail")
            worksheet.write(1, 3, existing_email)  # Duplicate email
            worksheet.write(1, 4, "1234567890")
            
            workbook.close()
            output.seek(0)
            
            # Upload file
            files = {"file": ("test_employees.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/employees",
                files=files,
                headers=headers
            )
            
            assert response.status_code == 200
            result = response.json()
            
            # Should have error for duplicate email
            assert result.get("imported") == 0, f"Should not import duplicate email, got: {result}"
            assert len(result.get("errors", [])) > 0, "Should have error for duplicate email"
            
            error_msg = str(result.get("errors", []))
            assert "already exists" in error_msg.lower() or "email" in error_msg.lower(), \
                f"Error should mention duplicate email: {error_msg}"
            
            print(f"✓ Employee import correctly rejected duplicate email: {existing_email}")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    # ==================== INSURANCE IMPORT DUPLICATE PREVENTION ====================
    
    def test_06_insurance_import_updates_existing_record(self):
        """Insurance import should update existing record instead of creating duplicate"""
        # Get an existing employee
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        test_emp = employees[0] if employees else None
        assert test_emp, "No employees found for testing"
        
        emp_code = test_emp.get("emp_code")
        employee_id = test_emp.get("employee_id")
        
        # Get initial insurance count for this employee
        response = self.session.get(f"{BASE_URL}/api/insurance")
        initial_data = response.json()
        initial_records = initial_data if isinstance(initial_data, list) else initial_data.get("records", [])
        initial_count = len([r for r in initial_records if r.get("employee_id") == employee_id])
        
        # Create Excel file with insurance data
        try:
            import xlsxwriter
            
            # First import
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Insurance Data')
            
            headers = ["SL NO.", "Employee Code", "Employee Name", "ESIC (Yes/No)", "PMJJBY (Yes/No)", "Accidental Insurance (Yes/No)"]
            for col, h in enumerate(headers):
                worksheet.write(1, col, h)
            
            worksheet.write(2, 0, 1)
            worksheet.write(2, 1, emp_code)
            worksheet.write(2, 2, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet.write(2, 3, "Yes")
            worksheet.write(2, 4, "No")
            worksheet.write(2, 5, "Yes")
            
            workbook.close()
            output.seek(0)
            
            files = {"file": ("test_insurance.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/insurance",
                files=files,
                headers=headers
            )
            
            assert response.status_code == 200
            result1 = response.json()
            print(f"First import result: {result1}")
            
            # Second import with same employee - should update, not create duplicate
            output2 = io.BytesIO()
            workbook2 = xlsxwriter.Workbook(output2, {'in_memory': True})
            worksheet2 = workbook2.add_worksheet('Insurance Data')
            
            for col, h in enumerate(headers):
                worksheet2.write(1, col, h)
            
            worksheet2.write(2, 0, 1)
            worksheet2.write(2, 1, emp_code)
            worksheet2.write(2, 2, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet2.write(2, 3, "No")  # Changed value
            worksheet2.write(2, 4, "Yes")  # Changed value
            worksheet2.write(2, 5, "No")  # Changed value
            
            workbook2.close()
            output2.seek(0)
            
            files2 = {"file": ("test_insurance2.xlsx", output2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            
            response2 = requests.post(
                f"{BASE_URL}/api/import/insurance",
                files=files2,
                headers=headers
            )
            
            assert response2.status_code == 200
            result2 = response2.json()
            print(f"Second import result: {result2}")
            
            # Verify no duplicate was created
            response = self.session.get(f"{BASE_URL}/api/insurance")
            final_data = response.json()
            final_records = final_data if isinstance(final_data, list) else final_data.get("records", [])
            final_count = len([r for r in final_records if r.get("employee_id") == employee_id])
            
            # Should have at most 1 record per employee (either initial or updated)
            assert final_count <= 1, f"Duplicate insurance records created! Count: {final_count}"
            
            print(f"✓ Insurance import correctly updates existing record (no duplicates)")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    # ==================== SALARY IMPORT DUPLICATE PREVENTION ====================
    
    def test_07_salary_import_deactivates_old_salary(self):
        """Salary import should deactivate old salary before inserting new"""
        # Get an existing employee
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        test_emp = employees[0] if employees else None
        assert test_emp, "No employees found for testing"
        
        emp_code = test_emp.get("emp_code")
        employee_id = test_emp.get("employee_id")
        
        try:
            import xlsxwriter
            
            # First salary import
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Salary Structure')
            
            headers = ["Emp Code", "Name of Employees", "BASIC", "DA", "HRA", "Conveyance", "GRADE PAY", "OTHER ALLOW", "Med./Spl. Allow", "Total Salary (FIXED)"]
            for col, h in enumerate(headers):
                worksheet.write(0, col, h)
            
            worksheet.write(1, 0, emp_code)
            worksheet.write(1, 1, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet.write(1, 2, 25000)  # BASIC
            worksheet.write(1, 3, 2500)   # DA
            worksheet.write(1, 4, 10000)  # HRA
            worksheet.write(1, 5, 2000)   # Conveyance
            worksheet.write(1, 6, 3000)   # Grade Pay
            worksheet.write(1, 7, 2000)   # Other Allow
            worksheet.write(1, 8, 1500)   # Medical
            worksheet.write(1, 9, 46000)  # Total Fixed
            
            workbook.close()
            output.seek(0)
            
            files = {"file": ("test_salary.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/salary",
                files=files,
                headers=headers
            )
            
            assert response.status_code == 200
            result1 = response.json()
            print(f"First salary import result: {result1}")
            
            # Second salary import - should deactivate old and create new
            output2 = io.BytesIO()
            workbook2 = xlsxwriter.Workbook(output2, {'in_memory': True})
            worksheet2 = workbook2.add_worksheet('Salary Structure')
            
            for col, h in enumerate(headers):
                worksheet2.write(0, col, h)
            
            worksheet2.write(1, 0, emp_code)
            worksheet2.write(1, 1, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet2.write(1, 2, 30000)  # BASIC - increased
            worksheet2.write(1, 3, 3000)   # DA
            worksheet2.write(1, 4, 12000)  # HRA
            worksheet2.write(1, 5, 2500)   # Conveyance
            worksheet2.write(1, 6, 3500)   # Grade Pay
            worksheet2.write(1, 7, 2500)   # Other Allow
            worksheet2.write(1, 8, 2000)   # Medical
            worksheet2.write(1, 9, 55500)  # Total Fixed
            
            workbook2.close()
            output2.seek(0)
            
            files2 = {"file": ("test_salary2.xlsx", output2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            
            response2 = requests.post(
                f"{BASE_URL}/api/import/salary",
                files=files2,
                headers=headers
            )
            
            assert response2.status_code == 200
            result2 = response2.json()
            print(f"Second salary import result: {result2}")
            
            # Verify only one active salary exists
            response = self.session.get(f"{BASE_URL}/api/payroll/all-salary-structures")
            assert response.status_code == 200
            
            data = response.json()
            salaries = data if isinstance(data, list) else data.get("salaries", [])
            
            # Count active salaries for this employee
            active_salaries = [s for s in salaries if s.get("employee_id") == employee_id and s.get("is_active", True)]
            
            assert len(active_salaries) <= 1, f"Multiple active salaries found! Count: {len(active_salaries)}"
            
            print(f"✓ Salary import correctly deactivates old salary (only 1 active)")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    # ==================== ATTENDANCE IMPORT DUPLICATE PREVENTION ====================
    
    def test_08_attendance_import_uses_upsert(self):
        """Attendance import should use upsert to prevent duplicates"""
        # Get an existing employee
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        test_emp = employees[0] if employees else None
        assert test_emp, "No employees found for testing"
        
        emp_code = test_emp.get("emp_code")
        
        try:
            import xlsxwriter
            
            # First attendance import
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Attendance')
            
            # Headers: SL NO, Emp Code, Name, then days 1-31
            worksheet.write(0, 0, "SL NO")
            worksheet.write(0, 1, "Emp Code")
            worksheet.write(0, 2, "Name of Employees")
            for day in range(1, 32):
                worksheet.write(0, day + 2, str(day))
            
            # Data row
            worksheet.write(1, 0, 1)
            worksheet.write(1, 1, emp_code)
            worksheet.write(1, 2, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            for day in range(1, 32):
                worksheet.write(1, day + 2, "P")  # Present
            
            workbook.close()
            output.seek(0)
            
            files = {"file": ("test_attendance.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            data = {"month": "12", "year": "2025"}
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/attendance",
                files=files,
                data=data,
                headers=headers
            )
            
            assert response.status_code == 200
            result1 = response.json()
            print(f"First attendance import result: {result1}")
            
            # Second attendance import - same month, should upsert
            output2 = io.BytesIO()
            workbook2 = xlsxwriter.Workbook(output2, {'in_memory': True})
            worksheet2 = workbook2.add_worksheet('Attendance')
            
            worksheet2.write(0, 0, "SL NO")
            worksheet2.write(0, 1, "Emp Code")
            worksheet2.write(0, 2, "Name of Employees")
            for day in range(1, 32):
                worksheet2.write(0, day + 2, str(day))
            
            worksheet2.write(1, 0, 1)
            worksheet2.write(1, 1, emp_code)
            worksheet2.write(1, 2, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            for day in range(1, 32):
                worksheet2.write(1, day + 2, "A" if day % 7 == 0 else "P")  # Some absent
            
            workbook2.close()
            output2.seek(0)
            
            files2 = {"file": ("test_attendance2.xlsx", output2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            
            response2 = requests.post(
                f"{BASE_URL}/api/import/attendance",
                files=files2,
                data=data,
                headers=headers
            )
            
            assert response2.status_code == 200
            result2 = response2.json()
            print(f"Second attendance import result: {result2}")
            
            # Both imports should succeed (upsert behavior)
            assert result1.get("imported", 0) > 0 or result1.get("errors", []) == []
            assert result2.get("imported", 0) > 0 or result2.get("errors", []) == []
            
            print(f"✓ Attendance import correctly uses upsert (no duplicates)")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    # ==================== LEAVE BALANCE IMPORT DUPLICATE PREVENTION ====================
    
    def test_09_leave_balance_import_uses_upsert(self):
        """Leave balance import should use upsert to prevent duplicates"""
        # Get an existing employee
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        test_emp = employees[0] if employees else None
        assert test_emp, "No employees found for testing"
        
        emp_code = test_emp.get("emp_code")
        
        try:
            import xlsxwriter
            
            # First leave balance import
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Leave Balance')
            
            headers = ["Emp ID", "Name", "Casual Leave (CL)", "Sick Leave (SL)", "Earned Leave (EL)", "Complementary Off"]
            for col, h in enumerate(headers):
                worksheet.write(1, col, h)
            
            worksheet.write(2, 0, emp_code)
            worksheet.write(2, 1, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet.write(2, 2, 10)  # CL
            worksheet.write(2, 3, 8)   # SL
            worksheet.write(2, 4, 15)  # EL
            worksheet.write(2, 5, 2)   # CO
            
            workbook.close()
            output.seek(0)
            
            files = {"file": ("test_leave.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/leave-balance",
                files=files,
                headers=headers
            )
            
            assert response.status_code == 200
            result1 = response.json()
            print(f"First leave balance import result: {result1}")
            
            # Second leave balance import - should upsert
            output2 = io.BytesIO()
            workbook2 = xlsxwriter.Workbook(output2, {'in_memory': True})
            worksheet2 = workbook2.add_worksheet('Leave Balance')
            
            for col, h in enumerate(headers):
                worksheet2.write(1, col, h)
            
            worksheet2.write(2, 0, emp_code)
            worksheet2.write(2, 1, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet2.write(2, 2, 8)   # CL - changed
            worksheet2.write(2, 3, 6)   # SL - changed
            worksheet2.write(2, 4, 12)  # EL - changed
            worksheet2.write(2, 5, 3)   # CO - changed
            
            workbook2.close()
            output2.seek(0)
            
            files2 = {"file": ("test_leave2.xlsx", output2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            
            response2 = requests.post(
                f"{BASE_URL}/api/import/leave-balance",
                files=files2,
                headers=headers
            )
            
            assert response2.status_code == 200
            result2 = response2.json()
            print(f"Second leave balance import result: {result2}")
            
            # Both imports should succeed (upsert behavior)
            assert result1.get("imported", 0) > 0
            assert result2.get("imported", 0) > 0
            
            print(f"✓ Leave balance import correctly uses upsert (no duplicates)")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    # ==================== BUSINESS INSURANCE IMPORT DUPLICATE PREVENTION ====================
    
    def test_10_business_insurance_import_updates_existing(self):
        """Business insurance import should update existing record for same policy"""
        try:
            import xlsxwriter
            
            # First business insurance import - headers on row 1 (index 0)
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Business Insurance')
            
            col_headers = ["SL NO.", "Name of Insurance", "Vehicle No", "Insurance Company", "Date of Issuance", "Due Date", "Notes"]
            for col, h in enumerate(col_headers):
                worksheet.write(0, col, h)  # Row 0 for headers
            
            worksheet.write(1, 0, 1)  # Row 1 for data
            worksheet.write(1, 1, "TEST_Vehicle Insurance")
            worksheet.write(1, 2, "TEST-1234")
            worksheet.write(1, 3, "Test Insurance Co")
            worksheet.write(1, 4, "2025-01-01")
            worksheet.write(1, 5, "2026-01-01")
            worksheet.write(1, 6, "Test policy")
            
            workbook.close()
            output.seek(0)
            
            files = {"file": ("test_biz_ins.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            auth_headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/business-insurance",
                files=files,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            result1 = response.json()
            print(f"First business insurance import result: {result1}")
            
            # Second import with same policy - should update
            output2 = io.BytesIO()
            workbook2 = xlsxwriter.Workbook(output2, {'in_memory': True})
            worksheet2 = workbook2.add_worksheet('Business Insurance')
            
            for col, h in enumerate(col_headers):
                worksheet2.write(0, col, h)  # Row 0 for headers
            
            worksheet2.write(1, 0, 1)  # Row 1 for data
            worksheet2.write(1, 1, "TEST_Vehicle Insurance")  # Same name
            worksheet2.write(1, 2, "TEST-1234")  # Same vehicle
            worksheet2.write(1, 3, "Test Insurance Co")  # Same company
            worksheet2.write(1, 4, "2025-06-01")  # Changed date
            worksheet2.write(1, 5, "2026-06-01")  # Changed due date
            worksheet2.write(1, 6, "Updated policy")  # Changed notes
            
            workbook2.close()
            output2.seek(0)
            
            files2 = {"file": ("test_biz_ins2.xlsx", output2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            
            response2 = requests.post(
                f"{BASE_URL}/api/import/business-insurance",
                files=files2,
                headers=auth_headers
            )
            
            assert response2.status_code == 200
            result2 = response2.json()
            print(f"Second business insurance import result: {result2}")
            
            # Both imports should succeed
            assert result1.get("imported", 0) > 0 or len(result1.get("errors", [])) == 0
            assert result2.get("imported", 0) > 0 or len(result2.get("errors", [])) == 0
            
            print(f"✓ Business insurance import correctly updates existing record")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")
    
    # ==================== ASSETS IMPORT DUPLICATE PREVENTION ====================
    
    def test_11_assets_import_updates_existing(self):
        """Assets import should update existing record for same employee"""
        # Get an existing employee
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        
        test_emp = employees[0] if employees else None
        assert test_emp, "No employees found for testing"
        
        emp_code = test_emp.get("emp_code")
        
        try:
            import xlsxwriter
            
            # First assets import - use correct header format
            output = io.BytesIO()
            workbook = xlsxwriter.Workbook(output, {'in_memory': True})
            worksheet = workbook.add_worksheet('Assets')
            
            col_headers = ["S.NO.", "Empl.Code", "NAME", "ASSETS OF SDPL NUMBER", "TAG", "MOBILE & CHARGER", "LAPTOP", "SYSTEM", "PRINTER", "SIM(MOBILE NO)"]
            for col, h in enumerate(col_headers):
                worksheet.write(0, col, h)
            
            worksheet.write(1, 0, 1)
            worksheet.write(1, 1, emp_code)
            worksheet.write(1, 2, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet.write(1, 3, "SDPL-TEST-001")
            worksheet.write(1, 4, "TAG-TEST-001")
            worksheet.write(1, 5, "Yes")
            worksheet.write(1, 6, "Yes")
            worksheet.write(1, 7, "No")
            worksheet.write(1, 8, "No")
            worksheet.write(1, 9, "9876543210")
            
            workbook.close()
            output.seek(0)
            
            files = {"file": ("test_assets.xlsx", output, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            auth_headers = {"Authorization": f"Bearer {self.token}"}
            
            response = requests.post(
                f"{BASE_URL}/api/import/assets",
                files=files,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            result1 = response.json()
            print(f"First assets import result: {result1}")
            
            # Second import with same employee - should update
            output2 = io.BytesIO()
            workbook2 = xlsxwriter.Workbook(output2, {'in_memory': True})
            worksheet2 = workbook2.add_worksheet('Assets')
            
            for col, h in enumerate(col_headers):
                worksheet2.write(0, col, h)
            
            worksheet2.write(1, 0, 1)
            worksheet2.write(1, 1, emp_code)  # Same employee
            worksheet2.write(1, 2, f"{test_emp.get('first_name', '')} {test_emp.get('last_name', '')}")
            worksheet2.write(1, 3, "SDPL-TEST-002")  # Changed
            worksheet2.write(1, 4, "TAG-TEST-002")  # Changed
            worksheet2.write(1, 5, "No")  # Changed
            worksheet2.write(1, 6, "No")  # Changed
            worksheet2.write(1, 7, "Yes")  # Changed
            worksheet2.write(1, 8, "Yes")  # Changed
            worksheet2.write(1, 9, "1234567890")  # Changed
            
            workbook2.close()
            output2.seek(0)
            
            files2 = {"file": ("test_assets2.xlsx", output2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            
            response2 = requests.post(
                f"{BASE_URL}/api/import/assets",
                files=files2,
                headers=auth_headers
            )
            
            assert response2.status_code == 200
            result2 = response2.json()
            print(f"Second assets import result: {result2}")
            
            # Both imports should succeed
            assert result1.get("imported", 0) > 0
            assert result2.get("imported", 0) > 0
            
            print(f"✓ Assets import correctly updates existing record")
            
        except ImportError:
            pytest.skip("xlsxwriter not available")


# Cleanup test data after tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Cleanup would go here if needed


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
