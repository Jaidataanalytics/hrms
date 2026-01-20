"""
Test HR Features:
1. Login API returns must_change_password flag
2. Change password API endpoint works correctly
3. Employee role restrictions (employees can't access certain endpoints)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLoginMustChangePassword:
    """Test login API returns must_change_password flag"""
    
    def test_admin_login_returns_must_change_password_false(self):
        """Admin should have must_change_password=false"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify must_change_password field exists
        assert "must_change_password" in data, "must_change_password field missing from login response"
        # Admin should have must_change_password=false
        assert data["must_change_password"] == False, f"Admin should have must_change_password=false, got {data['must_change_password']}"
        
        # Verify other required fields
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@shardahr.com"
        print(f"✓ Admin login returns must_change_password={data['must_change_password']}")
    
    def test_employee_login_returns_must_change_password_field(self):
        """Employee login should return must_change_password field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "NewPass@123"
        })
        assert response.status_code == 200, f"Employee login failed: {response.text}"
        data = response.json()
        
        # Verify must_change_password field exists
        assert "must_change_password" in data, "must_change_password field missing from login response"
        print(f"✓ Employee login returns must_change_password={data['must_change_password']}")


class TestChangePasswordAPI:
    """Test change password API endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def employee_token(self):
        """Get employee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "NewPass@123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employee login failed")
    
    def test_change_password_requires_auth(self):
        """Change password should require authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "new_password": "TestPass@123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Change password requires authentication")
    
    def test_change_password_validates_length(self, admin_token):
        """Change password should validate minimum length"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"new_password": "short"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should fail with 400 for short password
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        print("✓ Change password validates minimum length")
    
    def test_change_password_requires_current_for_non_first_login(self, admin_token):
        """Non-first-login users should require current password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"new_password": "NewValidPass@123"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Admin has must_change_password=false, so should require current password
        assert response.status_code == 400, f"Expected 400 without current password, got {response.status_code}"
        data = response.json()
        assert "current password" in data.get("detail", "").lower(), f"Expected current password error, got: {data}"
        print("✓ Change password requires current password for non-first-login users")


class TestEmployeeRoleRestrictions:
    """Test that employees have restricted access"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            session.headers.update({"Authorization": f"Bearer {token}"})
            return session
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def employee_session(self):
        """Get employee session with cookies"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "NewPass@123"
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            session.headers.update({"Authorization": f"Bearer {token}"})
            return session
        pytest.skip("Employee login failed")
    
    def test_admin_can_list_all_employees(self, admin_session):
        """Admin should be able to list all employees"""
        response = admin_session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Admin failed to list employees: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of employees"
        print(f"✓ Admin can list employees (found {len(data)} employees)")
    
    def test_employee_can_only_see_own_data(self, employee_session):
        """Employee should only see their own data in employees list"""
        response = employee_session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Employee failed to list employees: {response.text}"
        data = response.json()
        # Employee should only see their own record (or empty if no employee_id linked)
        assert isinstance(data, list), "Expected list of employees"
        assert len(data) <= 1, f"Employee should see at most 1 record (their own), got {len(data)}"
        print(f"✓ Employee can only see own data (found {len(data)} records)")
    
    def test_admin_can_access_auth_me(self, admin_session):
        """Admin should be able to access /auth/me"""
        response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Admin failed to access /auth/me: {response.text}"
        data = response.json()
        assert data["email"] == "admin@shardahr.com"
        assert data["role"] in ["super_admin", "hr_admin"]
        print(f"✓ Admin can access /auth/me (role: {data['role']})")
    
    def test_employee_can_access_auth_me(self, employee_session):
        """Employee should be able to access /auth/me"""
        response = employee_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Employee failed to access /auth/me: {response.text}"
        data = response.json()
        assert data["email"] == "employee@shardahr.com"
        assert data["role"] == "employee"
        print(f"✓ Employee can access /auth/me (role: {data['role']})")


class TestAttendanceOrganizationAccess:
    """Test attendance organization view access"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            session.headers.update({"Authorization": f"Bearer {token}"})
            return session
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def employee_session(self):
        """Get employee session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "NewPass@123"
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            session.headers.update({"Authorization": f"Bearer {token}"})
            return session
        pytest.skip("Employee login failed")
    
    def test_admin_can_access_organization_attendance(self, admin_session):
        """Admin should be able to access organization attendance"""
        import datetime
        today = datetime.date.today()
        response = admin_session.get(
            f"{BASE_URL}/api/attendance/organization",
            params={"month": today.month, "year": today.year, "date": today.isoformat()}
        )
        assert response.status_code == 200, f"Admin failed to access org attendance: {response.text}"
        data = response.json()
        assert "summary" in data or "today_attendance" in data, f"Expected org attendance data, got: {data}"
        print(f"✓ Admin can access organization attendance")
    
    def test_employee_can_access_my_attendance(self, employee_session):
        """Employee should be able to access their own attendance"""
        import datetime
        today = datetime.date.today()
        response = employee_session.get(
            f"{BASE_URL}/api/attendance/my",
            params={"month": today.month, "year": today.year}
        )
        assert response.status_code == 200, f"Employee failed to access my attendance: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list of attendance records, got: {type(data)}"
        print(f"✓ Employee can access their own attendance (found {len(data)} records)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
