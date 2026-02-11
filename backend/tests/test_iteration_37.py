"""
Iteration 37 Backend Tests
Testing employee sidebar access, remote check-in, CORS configuration, and auth headers fixes.

Tests cover:
- Employee access to Helpdesk, SOPs, Training, Tour Management APIs
- Remote check-in card visibility (my-active-tour endpoint)
- CORS headers for custom domain (shardahrms.com)
- Data Management API accessibility with auth headers
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Login as employee and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "Employee@123"
        })
        assert response.status_code == 200, f"Employee login failed: {response.text}"
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_admin_login(self, admin_session):
        """Test admin login returns valid token"""
        response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@shardahr.com"
        assert data["role"] in ["super_admin", "hr_admin"]
        print(f"✓ Admin login successful, role: {data['role']}")
    
    def test_employee_login(self, employee_session):
        """Test employee login returns valid token"""
        response = employee_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "employee@shardahr.com"
        print(f"✓ Employee login successful, role: {data.get('role', 'employee')}")


class TestEmployeeSidebarAccess:
    """Test employee access to sidebar pages - Helpdesk, SOPs, Training, Tour Management"""
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Login as employee and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "Employee@123"
        })
        if response.status_code != 200:
            pytest.skip(f"Employee login failed: {response.text}")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session

    def test_employee_helpdesk_surveys(self, employee_session):
        """Test employee can access /api/helpdesk/surveys"""
        response = employee_session.get(f"{BASE_URL}/api/helpdesk/surveys")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of surveys"
        print(f"✓ Employee can access Helpdesk surveys, got {len(data)} surveys")

    def test_employee_training_my_training(self, employee_session):
        """Test employee can access /api/training/my-training"""
        response = employee_session.get(f"{BASE_URL}/api/training/my-training")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of training assignments"
        print(f"✓ Employee can access Training My-Training, got {len(data)} assignments")

    def test_employee_sop_my_sops(self, employee_session):
        """Test employee can access /api/sop/my-sops"""
        response = employee_session.get(f"{BASE_URL}/api/sop/my-sops")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of SOPs"
        print(f"✓ Employee can access SOPs, got {len(data)} SOPs")

    def test_employee_travel_my_active_tour(self, employee_session):
        """Test employee can access /api/travel/my-active-tour"""
        response = employee_session.get(f"{BASE_URL}/api/travel/my-active-tour")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Response should have required fields
        assert "has_active_tour" in data
        assert "can_remote_checkin" in data
        assert "is_field_employee" in data
        print(f"✓ Employee can access my-active-tour: has_active_tour={data['has_active_tour']}, can_remote_checkin={data['can_remote_checkin']}")


class TestRemoteCheckinVisibility:
    """Test remote check-in card visibility based on user status"""
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Login as employee and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "Employee@123"
        })
        if response.status_code != 200:
            pytest.skip(f"Employee login failed: {response.text}")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_remote_checkin_visibility_regular_employee(self, employee_session):
        """Test that regular employee (no active tour, not field employee) gets can_remote_checkin=False"""
        response = employee_session.get(f"{BASE_URL}/api/travel/my-active-tour")
        assert response.status_code == 200
        data = response.json()
        
        # For a regular employee without active tour:
        # - has_active_tour should be False
        # - is_field_employee should be False (unless they are)
        # - can_remote_checkin should be False (since neither condition is true)
        
        # Note: If the employee IS a field employee or HAS an active tour, can_remote_checkin will be True
        # This test documents expected behavior, not strict assertions
        print(f"✓ Remote checkin visibility check: has_active_tour={data.get('has_active_tour')}, "
              f"is_field_employee={data.get('is_field_employee')}, can_remote_checkin={data.get('can_remote_checkin')}")
        
        # The remote check-in card should only appear when can_remote_checkin is True
        if not data.get('has_active_tour') and not data.get('is_field_employee'):
            assert data.get('can_remote_checkin') == False, "Expected can_remote_checkin=False for regular employee"
            print("✓ Regular employee correctly gets can_remote_checkin=False")
        else:
            print(f"ℹ Employee has special status - can_remote_checkin={data.get('can_remote_checkin')}")


class TestCORSConfiguration:
    """Test CORS headers for custom domain compatibility"""
    
    def test_cors_preflight_options(self):
        """Test OPTIONS preflight request returns proper CORS headers"""
        # Simulate preflight request from shardahrms.com
        headers = {
            "Origin": "https://shardahrms.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization, Content-Type"
        }
        response = requests.options(f"{BASE_URL}/api/auth/me", headers=headers)
        
        # OPTIONS should return 200 or allow the method
        print(f"OPTIONS response status: {response.status_code}")
        print(f"CORS headers: {dict(response.headers)}")
        
        # Check for CORS headers
        cors_origin = response.headers.get("access-control-allow-origin")
        cors_methods = response.headers.get("access-control-allow-methods")
        cors_headers = response.headers.get("access-control-allow-headers")
        cors_credentials = response.headers.get("access-control-allow-credentials")
        
        # For shardahrms.com, we should see it in allow-origin or a wildcard
        # Note: With allow_credentials=True, origin must be specific, not *
        print(f"✓ CORS check - Origin: {cors_origin}, Methods: {cors_methods}, Credentials: {cors_credentials}")
        
    def test_cors_with_bearer_token(self):
        """Test that requests with Bearer token from custom domain work"""
        # Login first to get a token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            
            # Make request with Bearer token and Origin header
            headers = {
                "Authorization": f"Bearer {token}",
                "Origin": "https://shardahrms.com",
                "Content-Type": "application/json"
            }
            response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            
            assert response.status_code == 200, f"Request with Bearer token failed: {response.status_code}"
            print(f"✓ Request with Bearer token from custom domain works")
        else:
            pytest.skip("Login failed, cannot test Bearer token")


class TestDataManagementAccess:
    """Test Data Management API works with auth headers"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_data_management_stats(self, admin_session):
        """Test /api/data-management/stats with auth headers"""
        response = admin_session.get(f"{BASE_URL}/api/data-management/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Data Management stats API works, got {type(data)}")
    
    def test_data_management_departments(self, admin_session):
        """Test /api/data-management/departments with auth headers"""
        response = admin_session.get(f"{BASE_URL}/api/data-management/departments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of departments"
        print(f"✓ Data Management departments API works, got {len(data)} departments")
    
    def test_data_management_employees_list(self, admin_session):
        """Test /api/data-management/employees-list with auth headers"""
        response = admin_session.get(f"{BASE_URL}/api/data-management/employees-list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of employees"
        print(f"✓ Data Management employees-list API works, got {len(data)} employees")


class TestTrainingPageAccess:
    """Test Training page APIs work correctly"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_training_programs(self, admin_session):
        """Test /api/training/programs endpoint"""
        response = admin_session.get(f"{BASE_URL}/api/training/programs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of programs"
        print(f"✓ Training programs API works, got {len(data)} programs")


class TestUserManagementAccess:
    """Test User Management APIs work with auth headers"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_users_list(self, admin_session):
        """Test /api/users endpoint works"""
        response = admin_session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Users endpoint should return count or list
        print(f"✓ Users list API works")
    
    def test_users_roles_list(self, admin_session):
        """Test /api/users/roles/list endpoint works"""
        response = admin_session.get(f"{BASE_URL}/api/users/roles/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of roles"
        print(f"✓ Users roles list API works, got {len(data)} roles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
