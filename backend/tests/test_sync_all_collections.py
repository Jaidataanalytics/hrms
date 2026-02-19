"""
Test suite for sync-all-collections feature
Tests: /api/data-management/sync/status, export-all, import-all, sync/from-deployed, sync/attendance

Feature: Dynamically sync ALL MongoDB collections (68+) instead of hardcoded 15 collections
Direction: Pull FROM deployed TO preview (not push to production)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No token received"
    return token


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestSyncStatus:
    """Test GET /api/data-management/sync/status - returns ALL collections dynamically"""
    
    def test_sync_status_returns_all_collections(self, auth_headers):
        """Verify sync/status returns 68+ collections dynamically"""
        response = requests.get(f"{BASE_URL}/api/data-management/sync/status", headers=auth_headers)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "sync_collections" in data, "Missing sync_collections in response"
        assert "local_counts" in data, "Missing local_counts in response"
        assert "total_collections" in data, "Missing total_collections in response"
        assert "deployed_url" in data, "Missing deployed_url in response"
        
        # Verify dynamic collection count (should be 68+, not hardcoded 15)
        total_collections = data["total_collections"]
        assert total_collections >= 60, f"Expected 60+ collections, got {total_collections} - NOT dynamic"
        
        # Verify local_counts has counts for all collections
        local_counts = data["local_counts"]
        sync_collections = data["sync_collections"]
        assert len(local_counts) == len(sync_collections), "Mismatch between counts and collections"
        
        # Verify all counts are integers
        for coll_name, count in local_counts.items():
            assert isinstance(count, int), f"Count for {coll_name} is not integer: {count}"
    
    def test_sync_status_includes_key_collections(self, auth_headers):
        """Verify key collections are present in sync status"""
        response = requests.get(f"{BASE_URL}/api/data-management/sync/status", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        collections = data["sync_collections"]
        
        # Key collections that MUST be present
        required_collections = [
            "employees", "attendance", "users", "leave_requests", "leave_balances",
            "payslips", "payroll_runs", "training_programs", "training_enrollments",
            "assets", "contractors", "contract_workers", "holidays", "departments"
        ]
        
        for coll in required_collections:
            assert coll in collections, f"Missing required collection: {coll}"
    
    def test_sync_status_requires_admin_auth(self):
        """Verify sync/status requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/data-management/sync/status")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestExportAll:
    """Test GET /api/data-management/export-all - exports ALL collections"""
    
    def test_export_all_returns_all_collections(self, auth_headers):
        """Verify export-all returns data for ALL collections"""
        response = requests.get(f"{BASE_URL}/api/data-management/export-all", headers=auth_headers)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert isinstance(data, dict), "Export data should be a dictionary"
        
        # Verify 68+ collections in export
        num_collections = len(data.keys())
        assert num_collections >= 60, f"Expected 60+ collections in export, got {num_collections}"
    
    def test_export_all_data_is_list_per_collection(self, auth_headers):
        """Verify each collection in export is a list of records"""
        response = requests.get(f"{BASE_URL}/api/data-management/export-all", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Each collection value should be a list
        for coll_name, records in data.items():
            assert isinstance(records, list), f"Collection {coll_name} is not a list: {type(records)}"
    
    def test_export_all_excludes_mongodb_id(self, auth_headers):
        """Verify export excludes MongoDB _id field"""
        response = requests.get(f"{BASE_URL}/api/data-management/export-all", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check first record of each collection with data
        for coll_name, records in data.items():
            if records and isinstance(records, list) and len(records) > 0:
                first_record = records[0]
                if isinstance(first_record, dict):
                    assert "_id" not in first_record, f"Collection {coll_name} contains _id field"
    
    def test_export_all_requires_admin_auth(self):
        """Verify export-all requires admin authentication"""
        response = requests.get(f"{BASE_URL}/api/data-management/export-all")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestImportAll:
    """Test POST /api/data-management/import-all - bulk import into collections"""
    
    def test_import_all_empty_data_returns_error(self, auth_headers):
        """Verify import-all returns error for empty data"""
        response = requests.post(
            f"{BASE_URL}/api/data-management/import-all",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"collections": {}}
        )
        
        # Should return 400 for empty data
        assert response.status_code == 400, f"Expected 400 for empty data, got {response.status_code}"
        assert "No collection data provided" in response.text
    
    def test_import_all_accepts_valid_data(self, auth_headers):
        """Verify import-all accepts and imports valid collection data"""
        test_collection = "test_import_sync_collection"
        test_data = {
            "collections": {
                test_collection: [
                    {"id": "test_import_1", "name": "Test Record 1"},
                    {"id": "test_import_2", "name": "Test Record 2"}
                ]
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/data-management/import-all",
            headers={**auth_headers, "Content-Type": "application/json"},
            json=test_data
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data.get("success") is True, f"Import not successful: {data}"
        assert "imported" in data, "Missing imported counts"
        assert data["imported"].get(test_collection) == 2, f"Expected 2 records imported"
        assert data["total_records"] == 2, "Total records mismatch"
        assert "imported_at" in data, "Missing imported_at timestamp"
        assert "imported_by" in data, "Missing imported_by user"
    
    def test_import_all_returns_import_summary(self, auth_headers):
        """Verify import-all returns proper summary with counts"""
        test_data = {
            "collections": {
                "test_sync_coll_a": [{"id": "a1"}],
                "test_sync_coll_b": [{"id": "b1"}, {"id": "b2"}],
                "test_sync_coll_c": []  # Empty collection
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/data-management/import-all",
            headers={**auth_headers, "Content-Type": "application/json"},
            json=test_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify counts
        assert data["imported"]["test_sync_coll_a"] == 1
        assert data["imported"]["test_sync_coll_b"] == 2
        assert data["imported"]["test_sync_coll_c"] == 0  # Empty
        assert data["total_records"] == 3
    
    def test_import_all_requires_admin_auth(self):
        """Verify import-all requires admin authentication"""
        response = requests.post(
            f"{BASE_URL}/api/data-management/import-all",
            json={"collections": {"test": []}}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestSyncFromDeployed:
    """Test POST /api/data-management/sync/from-deployed"""
    
    def test_sync_from_deployed_returns_proper_structure(self, auth_headers):
        """Verify sync/from-deployed returns expected response structure"""
        # Note: This will fail to connect to production but should return proper error structure
        response = requests.post(
            f"{BASE_URL}/api/data-management/sync/from-deployed",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"email": "test@test.com", "password": "test123"},
            timeout=30
        )
        
        # Status assertion - should return 200 even if sync fails
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions - verify response structure
        data = response.json()
        assert "success" in data, "Missing success field"
        assert "synced_collections" in data, "Missing synced_collections field"
        assert "errors" in data, "Missing errors field"
        assert "deployed_url" in data, "Missing deployed_url field"
        assert "total_records" in data, "Missing total_records field"
    
    def test_sync_from_deployed_handles_invalid_credentials(self, auth_headers):
        """Verify sync/from-deployed handles invalid production credentials gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/data-management/sync/from-deployed",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"email": "invalid@email.com", "password": "wrongpassword"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should fail but return structured error
        assert data["success"] is False, "Should return success=false for invalid credentials"
        assert len(data["errors"]) > 0, "Should have error messages"
    
    def test_sync_from_deployed_requires_admin_auth(self):
        """Verify sync/from-deployed requires admin authentication"""
        response = requests.post(
            f"{BASE_URL}/api/data-management/sync/from-deployed",
            json={"email": "test@test.com", "password": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestSyncAttendanceOnly:
    """Test POST /api/data-management/sync/attendance"""
    
    def test_sync_attendance_returns_proper_structure(self, auth_headers):
        """Verify sync/attendance returns expected response structure"""
        response = requests.post(
            f"{BASE_URL}/api/data-management/sync/attendance",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"email": "test@test.com", "password": "test123", "month": 1, "year": 2026},
            timeout=30
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions - verify response structure
        data = response.json()
        assert "success" in data, "Missing success field"
        assert "attendance_imported" in data, "Missing attendance_imported field"
        assert "employees_imported" in data, "Missing employees_imported field"
        assert "errors" in data, "Missing errors field"
    
    def test_sync_attendance_requires_admin_auth(self):
        """Verify sync/attendance requires admin authentication"""
        response = requests.post(
            f"{BASE_URL}/api/data-management/sync/attendance",
            json={"email": "test@test.com", "password": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestCollectionCounts:
    """Verify collection count consistency between endpoints"""
    
    def test_sync_status_and_export_all_collection_count_match(self, auth_headers):
        """Verify sync/status and export-all return same number of collections"""
        # Get sync status
        status_response = requests.get(f"{BASE_URL}/api/data-management/sync/status", headers=auth_headers)
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        # Get export-all
        export_response = requests.get(f"{BASE_URL}/api/data-management/export-all", headers=auth_headers)
        assert export_response.status_code == 200
        export_data = export_response.json()
        
        # Compare collection counts
        status_collections = set(status_data["sync_collections"])
        export_collections = set(export_data.keys())
        
        assert status_collections == export_collections, (
            f"Collection mismatch!\n"
            f"In status but not export: {status_collections - export_collections}\n"
            f"In export but not status: {export_collections - status_collections}"
        )
