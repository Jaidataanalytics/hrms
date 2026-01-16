"""
Test Global Search and Employee 360 View Features
Tests:
- Employee search API
- Employee details API
- Attendance API for specific employee
- Leave balances API for specific employee
- Payroll/Salary API for specific employee
- Insurance API for specific employee
- Employee assets API for specific employee
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Welcome@123"

# Test employee ID with salary data
TEST_EMPLOYEE_ID = "EMP7A155FF6"


class TestAuthAndSetup:
    """Authentication tests - run first"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        """Login and get auth cookies"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code} - {response.text}")
        
        # Return cookies from response
        return response.cookies
    
    def test_login_success(self, session, auth_cookies):
        """Test admin login works"""
        assert auth_cookies is not None
        print(f"✅ Login successful with {ADMIN_EMAIL}")
    
    def test_auth_me(self, session, auth_cookies):
        """Test /api/auth/me returns user data"""
        response = session.get(f"{BASE_URL}/api/auth/me", cookies=auth_cookies)
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] in ["super_admin", "hr_admin", "hr_executive"]
        print(f"✅ Auth/me returns user: {data['name']} with role: {data['role']}")


class TestGlobalSearchAPI:
    """Test Global Search API - /api/employees/search"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.cookies
    
    def test_search_by_name(self, session, auth_cookies):
        """Test search employees by name"""
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=Test&limit=10",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Search by name 'Test' returned {len(data)} results")
    
    def test_search_by_email(self, session, auth_cookies):
        """Test search employees by email"""
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=@&limit=10",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Search by email '@' returned {len(data)} results")
    
    def test_search_by_emp_code(self, session, auth_cookies):
        """Test search employees by employee code"""
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=EMP&limit=10",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            # Verify result structure
            emp = data[0]
            assert "employee_id" in emp
            assert "first_name" in emp or "last_name" in emp
        print(f"✅ Search by emp_code 'EMP' returned {len(data)} results")
    
    def test_search_minimum_chars(self, session, auth_cookies):
        """Test search requires minimum 2 characters (handled by frontend)"""
        # API should still work with 1 char but may return empty
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=a&limit=10",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        print("✅ Search with 1 char returns valid response")
    
    def test_search_limit_parameter(self, session, auth_cookies):
        """Test search respects limit parameter"""
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=a&limit=5",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) <= 5
        print(f"✅ Search with limit=5 returned {len(data)} results (max 5)")


class TestEmployee360API:
    """Test Employee 360 View APIs"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.cookies
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, session, auth_cookies):
        """Get a valid employee ID for testing"""
        # First try the specified test employee
        response = session.get(
            f"{BASE_URL}/api/employees/{TEST_EMPLOYEE_ID}",
            cookies=auth_cookies
        )
        if response.status_code == 200:
            return TEST_EMPLOYEE_ID
        
        # Fallback: get any employee from list
        response = session.get(
            f"{BASE_URL}/api/employees?limit=1",
            cookies=auth_cookies
        )
        if response.status_code == 200:
            data = response.json()
            if len(data) > 0:
                return data[0]["employee_id"]
        
        pytest.skip("No employees found for testing")
    
    def test_get_employee_details(self, session, auth_cookies, test_employee_id):
        """Test GET /api/employees/{employee_id}"""
        response = session.get(
            f"{BASE_URL}/api/employees/{test_employee_id}",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "employee_id" in data
        assert data["employee_id"] == test_employee_id
        assert "first_name" in data
        assert "last_name" in data
        print(f"✅ Employee details: {data.get('first_name')} {data.get('last_name')}")
    
    def test_get_employee_attendance(self, session, auth_cookies, test_employee_id):
        """Test GET /api/attendance?employee_id={id}&month={m}&year={y}"""
        from datetime import datetime
        now = datetime.now()
        
        response = session.get(
            f"{BASE_URL}/api/attendance?employee_id={test_employee_id}&month={now.month}&year={now.year}",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Attendance records for {now.month}/{now.year}: {len(data)} records")
    
    def test_get_employee_salary(self, session, auth_cookies, test_employee_id):
        """Test GET /api/payroll/employee/{employee_id}"""
        response = session.get(
            f"{BASE_URL}/api/payroll/employee/{test_employee_id}",
            cookies=auth_cookies
        )
        # Can be 200 with data or 200 with null/empty if no salary assigned
        assert response.status_code == 200
        
        data = response.json()
        if data:
            # Verify salary structure fields
            has_salary_info = (
                "total_fixed" in data or 
                "gross" in data or 
                "fixed_components" in data or
                "ctc" in data
            )
            print(f"✅ Salary data found: {has_salary_info}")
        else:
            print("✅ Salary API returned empty (no salary assigned)")
    
    def test_get_employee_leave_balances(self, session, auth_cookies, test_employee_id):
        """Test GET /api/leave/balances?employee_id={id}"""
        response = session.get(
            f"{BASE_URL}/api/leave/balances?employee_id={test_employee_id}",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            balance = data[0]
            assert "leave_type_id" in balance or "leave_type_name" in balance
        print(f"✅ Leave balances: {len(data)} leave types")
    
    def test_get_employee_leave_requests(self, session, auth_cookies, test_employee_id):
        """Test GET /api/leave/requests?employee_id={id}"""
        response = session.get(
            f"{BASE_URL}/api/leave/requests?employee_id={test_employee_id}&limit=20",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Leave requests: {len(data)} requests")
    
    def test_get_employee_insurance(self, session, auth_cookies, test_employee_id):
        """Test GET /api/insurance?employee_id={id}"""
        response = session.get(
            f"{BASE_URL}/api/insurance?employee_id={test_employee_id}",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        # Can be list or single object
        if isinstance(data, list):
            print(f"✅ Insurance records: {len(data)} records")
        else:
            print(f"✅ Insurance data: {type(data)}")
    
    def test_get_employee_assets(self, session, auth_cookies, test_employee_id):
        """Test GET /api/employee-assets/{employee_id}"""
        response = session.get(
            f"{BASE_URL}/api/employee-assets/{test_employee_id}",
            cookies=auth_cookies
        )
        # Can be 200 with data or 404 if no assets
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Assets data found")
        else:
            print("✅ No assets assigned (404 expected)")
    
    def test_get_employee_payslips(self, session, auth_cookies, test_employee_id):
        """Test GET /api/payroll/payslips?employee_id={id}"""
        response = session.get(
            f"{BASE_URL}/api/payroll/payslips?employee_id={test_employee_id}&limit=12",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Payslips: {len(data)} records")


class TestEmployee360WithSpecificEmployee:
    """Test Employee 360 with the specific test employee EMP7A155FF6"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.cookies
    
    def test_specific_employee_exists(self, session, auth_cookies):
        """Verify test employee EMP7A155FF6 exists"""
        response = session.get(
            f"{BASE_URL}/api/employees/{TEST_EMPLOYEE_ID}",
            cookies=auth_cookies
        )
        
        if response.status_code == 404:
            pytest.skip(f"Test employee {TEST_EMPLOYEE_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Test employee found: {data.get('first_name')} {data.get('last_name')}")
    
    def test_specific_employee_salary_structure(self, session, auth_cookies):
        """Test salary structure for EMP7A155FF6"""
        response = session.get(
            f"{BASE_URL}/api/payroll/employee/{TEST_EMPLOYEE_ID}",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if data:
            # Check for fixed_components structure
            if "fixed_components" in data:
                fc = data["fixed_components"]
                print(f"✅ Fixed components: basic={fc.get('basic')}, hra={fc.get('hra')}")
            elif "gross" in data:
                print(f"✅ Gross salary: {data.get('gross')}")
            else:
                print(f"✅ Salary data structure: {list(data.keys())}")
        else:
            print("⚠️ No salary data for test employee")


class TestSearchResultNavigation:
    """Test that search results contain data needed for navigation"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Login failed")
        return response.cookies
    
    def test_search_result_has_employee_id(self, session, auth_cookies):
        """Verify search results contain employee_id for navigation"""
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=a&limit=5",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            emp = data[0]
            assert "employee_id" in emp, "Search result must have employee_id"
            print(f"✅ Search result has employee_id: {emp['employee_id']}")
        else:
            print("⚠️ No search results to verify")
    
    def test_search_result_has_display_fields(self, session, auth_cookies):
        """Verify search results contain display fields"""
        response = session.get(
            f"{BASE_URL}/api/employees/search?q=a&limit=5",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            emp = data[0]
            # Check for display fields used in GlobalSearch.js
            has_name = "first_name" in emp or "last_name" in emp
            has_code = "emp_code" in emp
            has_status = "status" in emp
            
            assert has_name, "Search result should have name fields"
            print(f"✅ Search result fields: name={has_name}, emp_code={has_code}, status={has_status}")
        else:
            print("⚠️ No search results to verify")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
