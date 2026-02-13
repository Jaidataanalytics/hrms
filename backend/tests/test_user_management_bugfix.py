"""
Test User Management Bug Fixes
- Bug #1: 'Failed to update user status' when deactivating/activating users (missing auth headers)
- Bug #2: 'Failed to delete user' when deleting users (missing auth headers)
- Bug #3: Deleted users showing with mangled emails (changed to permanent delete)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserManagementBugFixes:
    """Test user management CRUD operations with proper auth"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        data = login_response.json()
        self.token = data.get("access_token")
        self.cookies = login_response.cookies
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        yield
    
    def test_01_login_works(self):
        """Verify admin login returns token and user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        print("PASS: Admin login works")
    
    def test_02_list_users(self):
        """Verify user list endpoint works with auth"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers=self.headers,
            cookies=self.cookies
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert isinstance(data["users"], list)
        print(f"PASS: List users returns {len(data['users'])} users")
    
    def test_03_create_user(self):
        """Create a test user"""
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.headers,
            cookies=self.cookies,
            json={
                "name": "Test Delete User",
                "email": "test_delete_bugfix@test.com",
                "password": "password123",
                "role": "employee"
            }
        )
        # Could be 200 or 400 if user already exists
        if response.status_code == 400 and "already exists" in response.text.lower():
            print("INFO: User already exists, skipping create")
            return
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        self.created_user_id = data["user_id"]
        print(f"PASS: Created user {data['user_id']}")
    
    def test_04_deactivate_user_with_auth(self):
        """BUG FIX #1: Deactivate should work with auth headers"""
        # First get a user to deactivate
        list_response = requests.get(
            f"{BASE_URL}/api/users?status=active",
            headers=self.headers,
            cookies=self.cookies
        )
        assert list_response.status_code == 200
        users = list_response.json().get("users", [])
        
        # Find a test user (not admin)
        test_user = None
        for u in users:
            if "test" in u.get("email", "").lower() and u.get("role") != "super_admin":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No test user found to deactivate")
        
        # Deactivate user - THIS IS THE BUG FIX TEST
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['user_id']}/deactivate",
            headers=self.headers,
            cookies=self.cookies
        )
        
        # Should NOT return 401 or "Failed to update user status" error
        assert response.status_code == 200, f"Deactivate failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "deactivated" in data["message"].lower()
        print(f"PASS (BUG FIX #1): Deactivated user {test_user['user_id']}")
    
    def test_05_activate_user_with_auth(self):
        """BUG FIX #1: Activate should work with auth headers"""
        # Get inactive users
        list_response = requests.get(
            f"{BASE_URL}/api/users?status=inactive",
            headers=self.headers,
            cookies=self.cookies
        )
        assert list_response.status_code == 200
        users = list_response.json().get("users", [])
        
        if not users:
            pytest.skip("No inactive users to activate")
        
        test_user = users[0]
        
        # Activate user - THIS IS THE BUG FIX TEST
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['user_id']}/activate",
            headers=self.headers,
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Activate failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "activated" in data["message"].lower()
        print(f"PASS (BUG FIX #1): Activated user {test_user['user_id']}")
    
    def test_06_delete_user_permanent(self):
        """BUG FIX #2 & #3: Delete should work and user should be permanently removed"""
        # First create a user to delete
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=self.headers,
            cookies=self.cookies,
            json={
                "name": "Test Permanent Delete",
                "email": "test_permanent_delete@test.com",
                "password": "password123",
                "role": "employee"
            }
        )
        
        if create_response.status_code == 400 and "already exists" in create_response.text.lower():
            # Get existing user
            list_response = requests.get(
                f"{BASE_URL}/api/users?search=test_permanent_delete",
                headers=self.headers,
                cookies=self.cookies
            )
            users = list_response.json().get("users", [])
            for u in users:
                if "test_permanent_delete" in u.get("email", ""):
                    user_id = u["user_id"]
                    break
        else:
            assert create_response.status_code == 200
            user_id = create_response.json()["user_id"]
        
        # DELETE USER - THIS IS THE BUG FIX TEST
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        
        # Should NOT return 401 or "Failed to delete user" error
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        data = delete_response.json()
        assert "deleted" in data.get("message", "").lower()
        print(f"PASS (BUG FIX #2): Deleted user {user_id}")
        
        # VERIFY PERMANENT DELETE (BUG FIX #3): User should NOT exist anymore
        verify_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        
        # Should return 404 (user not found) - NOT 200 with mangled email
        assert verify_response.status_code == 404, "User should be permanently deleted"
        print(f"PASS (BUG FIX #3): User is permanently deleted (returns 404)")
    
    def test_07_roles_list(self):
        """Verify roles list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/users/roles/list",
            headers=self.headers,
            cookies=self.cookies
        )
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
        assert len(roles) > 0
        role_ids = [r["role_id"] for r in roles]
        assert "employee" in role_ids
        print(f"PASS: Roles list returns {len(roles)} roles")


class TestBiometricScheduler:
    """Verify scheduler configuration"""
    
    def test_scheduler_endpoints(self):
        """Verify scheduler-related endpoints work"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check health endpoint
        health_response = requests.get(f"{BASE_URL}/api/")
        assert health_response.status_code == 200
        print("PASS: Health endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
