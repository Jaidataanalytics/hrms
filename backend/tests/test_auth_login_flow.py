"""
Backend Auth Login Flow Tests
Tests for login, auth/me, and token refresh endpoints
Iteration 64 - Mobile APK login fix verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Sharda@2026!"
INVALID_EMAIL = "wrong@email.com"
INVALID_PASSWORD = "wrongpassword"


class TestAuthLogin:
    """Authentication login endpoint tests"""
    
    def test_login_with_valid_credentials(self):
        """Test login with valid admin credentials returns access_token, user, must_change_password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions - validate response structure
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        assert "user" in data, "Response missing user"
        assert "must_change_password" in data, "Response missing must_change_password"
        
        # Validate token is non-empty string
        assert isinstance(data["access_token"], str), "access_token should be string"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        
        # Validate user data
        user = data["user"]
        assert user["email"] == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {user['email']}"
        assert user["role"] == "super_admin", f"Expected role super_admin, got {user['role']}"
        assert "user_id" in user, "User missing user_id"
        assert "name" in user, "User missing name"
        
        # Validate must_change_password is boolean
        assert isinstance(data["must_change_password"], bool), "must_change_password should be boolean"
    
    def test_login_with_invalid_credentials(self):
        """Test login with invalid credentials returns 401 with error detail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": INVALID_EMAIL, "password": INVALID_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        # Data assertion - validate error response
        data = response.json()
        assert "detail" in data, "Error response missing detail"
        assert "Invalid email or password" in data["detail"], f"Unexpected error: {data['detail']}"
    
    def test_login_with_empty_email(self):
        """Test login with empty email returns validation error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "", "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 or 422 for validation error
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
    
    def test_login_with_empty_password(self):
        """Test login with empty password returns validation error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ""},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 or 422 for validation error
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"


class TestAuthMe:
    """Authentication /auth/me endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_auth_me_with_valid_token(self, auth_token):
        """Test /auth/me returns user data with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "email" in data, "Response missing email"
        assert data["email"] == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {data['email']}"
        assert "user_id" in data, "Response missing user_id"
        assert "role" in data, "Response missing role"
        assert "name" in data, "Response missing name"
    
    def test_auth_me_without_token(self):
        """Test /auth/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_auth_me_with_invalid_token(self):
        """Test /auth/me returns 401 with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestAuthRefresh:
    """Authentication token refresh endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_token_refresh_with_valid_token(self, auth_token):
        """Test /auth/refresh returns new access_token with valid token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            }
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        assert isinstance(data["access_token"], str), "access_token should be string"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        
        # New token should be different from old token (new expiry)
        # Note: This may not always be true if tokens are generated with same timestamp
        # So we just verify we got a valid token back
    
    def test_token_refresh_without_token(self):
        """Test /auth/refresh returns 401 without token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            headers={"Content-Type": "application/json"}
        )
        
        # Status code assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestLoginResponseFormat:
    """Verify login response format matches expected structure for mobile APK"""
    
    def test_login_response_has_correct_structure(self):
        """Verify login response has all required fields for mobile app"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Required top-level fields
        required_fields = ["access_token", "user", "must_change_password"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Required user fields
        user = data["user"]
        user_required_fields = ["user_id", "email", "name", "role"]
        for field in user_required_fields:
            assert field in user, f"Missing required user field: {field}"
        
        # Verify types
        assert isinstance(data["access_token"], str)
        assert isinstance(data["must_change_password"], bool)
        assert isinstance(data["user"], dict)
        
        print(f"✓ Login response structure verified: {list(data.keys())}")
        print(f"✓ User fields: {list(user.keys())}")
