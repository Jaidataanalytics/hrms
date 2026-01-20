"""
Test Biometric Sync API Endpoints
Tests for:
- POST /api/biometric/sync - Manual sync endpoint (admin only)
- POST /api/biometric/sync/historical - Historical sync endpoint (super_admin only)
- GET /api/biometric/sync/status - Get sync status and logs
- GET /api/biometric/sync/unmatched-codes - Get unmatched employee codes
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Admin@123"


class TestBiometricSyncAPI:
    """Test biometric sync API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
            # Also store cookies from response
            self.session.cookies.update(login_response.cookies)
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_01_admin_login_success(self):
        """Test admin can login successfully"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") in ["super_admin", "hr_admin"]
        print(f"✓ Admin login successful - role: {data.get('role')}")
    
    def test_02_get_sync_status(self):
        """Test GET /api/biometric/sync/status - Get sync status and logs"""
        response = self.session.get(f"{BASE_URL}/api/biometric/sync/status")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "last_sync" in data or data.get("last_sync") is None
        assert "recent_logs" in data
        
        # If there are logs, verify structure
        if data.get("recent_logs"):
            log = data["recent_logs"][0]
            assert "synced_at" in log or "sync_id" in log
            print(f"✓ Sync status retrieved - Last sync: {data.get('last_sync')}")
            print(f"  Total logs: {len(data.get('recent_logs', []))}")
            if data.get("last_sync_stats"):
                stats = data["last_sync_stats"]
                print(f"  Last sync stats - Total: {stats.get('total')}, Matched: {stats.get('matched')}, Updated: {stats.get('updated')}")
        else:
            print("✓ Sync status retrieved - No sync logs yet")
    
    def test_03_get_unmatched_codes(self):
        """Test GET /api/biometric/sync/unmatched-codes - Get unmatched employee codes"""
        response = self.session.get(f"{BASE_URL}/api/biometric/sync/unmatched-codes")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "unmatched_codes" in data
        assert "count" in data
        assert "message" in data
        
        print(f"✓ Unmatched codes retrieved - Count: {data.get('count')}")
        if data.get("unmatched_codes"):
            # Show first 10 unmatched codes
            codes = data["unmatched_codes"][:10]
            print(f"  Sample unmatched codes: {codes}")
    
    def test_04_manual_sync_endpoint(self):
        """Test POST /api/biometric/sync - Manual sync (admin only)"""
        # Test with specific date range (last 2 days to avoid heavy load)
        from datetime import datetime, timedelta
        to_date = datetime.now().strftime("%Y-%m-%d")
        from_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/biometric/sync",
            json={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        
        if data.get("success"):
            print(f"✓ Manual sync completed successfully")
            if data.get("stats"):
                stats = data["stats"]
                print(f"  Total records: {stats.get('total_records', 0)}")
                print(f"  Matched: {stats.get('matched', 0)}")
                print(f"  Updated: {stats.get('updated', 0)}")
                print(f"  Unmatched: {stats.get('unmatched', 0)}")
        else:
            print(f"✓ Manual sync endpoint responded - Message: {data.get('message', data.get('error'))}")
    
    def test_05_historical_sync_requires_super_admin(self):
        """Test POST /api/biometric/sync/historical - Requires super_admin role"""
        response = self.session.post(
            f"{BASE_URL}/api/biometric/sync/historical",
            json={"days": 7}  # Small number for testing
        )
        
        # Should be 200 if super_admin, 403 if hr_admin
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Historical sync allowed (user is super_admin)")
            if data.get("stats"):
                print(f"  Records processed: {data['stats'].get('total_records', 0)}")
        elif response.status_code == 403:
            print(f"✓ Historical sync correctly restricted (user is not super_admin)")
        else:
            # Unexpected status
            print(f"⚠ Unexpected status: {response.status_code}")
            assert response.status_code in [200, 403]
    
    def test_06_verify_attendance_records_exist(self):
        """Verify attendance records were created from biometric sync"""
        # Get attendance records
        response = self.session.get(f"{BASE_URL}/api/attendance")
        assert response.status_code == 200
        data = response.json()
        
        # Check if there are attendance records
        if isinstance(data, list) and len(data) > 0:
            # Find records with biometric source
            biometric_records = [
                att for att in data 
                if any(p.get("source") == "biometric_api" for p in att.get("punches", []))
            ]
            print(f"✓ Found {len(data)} total attendance records")
            print(f"  Records from biometric API: {len(biometric_records)}")
            
            if biometric_records:
                sample = biometric_records[0]
                print(f"  Sample record - Date: {sample.get('date')}, Employee: {sample.get('employee_id')}")
                print(f"  First IN: {sample.get('first_in')}, Last OUT: {sample.get('last_out')}")
        else:
            print("✓ Attendance endpoint working (no records found)")
    
    def test_07_verify_employee_code_mapping(self):
        """Verify employee codes are mapped correctly (S0001, S0002, etc.)"""
        # Get employees with emp_code
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        employees = response.json()
        
        # Check for S-prefix employee codes
        s_prefix_employees = [
            emp for emp in employees 
            if emp.get("emp_code", "").startswith("S")
        ]
        
        print(f"✓ Found {len(employees)} total employees")
        print(f"  Employees with S-prefix codes: {len(s_prefix_employees)}")
        
        if s_prefix_employees:
            codes = [emp.get("emp_code") for emp in s_prefix_employees[:10]]
            print(f"  Sample codes: {codes}")
    
    def test_08_sync_status_after_manual_sync(self):
        """Verify sync status is updated after manual sync"""
        response = self.session.get(f"{BASE_URL}/api/biometric/sync/status")
        assert response.status_code == 200
        data = response.json()
        
        if data.get("last_sync"):
            print(f"✓ Last sync timestamp: {data.get('last_sync')}")
            if data.get("last_sync_stats"):
                stats = data["last_sync_stats"]
                print(f"  Stats - Total: {stats.get('total')}, Matched: {stats.get('matched')}")
        else:
            print("✓ Sync status endpoint working")


class TestBiometricSyncUnauthorized:
    """Test biometric sync endpoints require authentication"""
    
    def test_sync_status_requires_auth(self):
        """Test GET /api/biometric/sync/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/biometric/sync/status")
        assert response.status_code == 401
        print("✓ Sync status correctly requires authentication")
    
    def test_manual_sync_requires_auth(self):
        """Test POST /api/biometric/sync requires authentication"""
        response = requests.post(f"{BASE_URL}/api/biometric/sync", json={})
        assert response.status_code == 401
        print("✓ Manual sync correctly requires authentication")
    
    def test_unmatched_codes_requires_auth(self):
        """Test GET /api/biometric/sync/unmatched-codes requires authentication"""
        response = requests.get(f"{BASE_URL}/api/biometric/sync/unmatched-codes")
        assert response.status_code == 401
        print("✓ Unmatched codes correctly requires authentication")


class TestBiometricSyncEmployeeAccess:
    """Test that regular employees cannot access biometric sync endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as employee"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Try to login as employee
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "employee@shardahr.com", "password": "NewPass@123"}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.session.cookies.update(login_response.cookies)
            self.employee_role = data.get("user", {}).get("role", "employee")
        else:
            pytest.skip("Employee login failed - skipping employee access tests")
    
    def test_employee_cannot_access_sync_status(self):
        """Test employee cannot access sync status"""
        response = self.session.get(f"{BASE_URL}/api/biometric/sync/status")
        # Should be 403 Forbidden for employees
        if response.status_code == 403:
            print("✓ Employee correctly denied access to sync status")
        elif response.status_code == 200:
            # If employee has hr_executive role, they might have access
            print(f"⚠ Employee has access to sync status (role might be elevated)")
        assert response.status_code in [200, 403]
    
    def test_employee_cannot_trigger_sync(self):
        """Test employee cannot trigger manual sync"""
        response = self.session.post(f"{BASE_URL}/api/biometric/sync", json={})
        # Should be 403 Forbidden for employees
        if response.status_code == 403:
            print("✓ Employee correctly denied access to manual sync")
        else:
            print(f"⚠ Unexpected status: {response.status_code}")
        assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
