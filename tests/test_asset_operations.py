"""
Test Asset Operations - CRUD, Reassign, Unassign, Delete
Tests for:
- GET /api/assets - Asset inventory list
- GET /api/assets/employee-assignments - Employee summaries
- DELETE /api/assets/{asset_id} - Soft delete asset
- PUT /api/assets/{asset_id} - Update asset details
- PUT /api/assets/{asset_id}/reassign - Reassign asset to new employee
- PUT /api/assets/{asset_id}/unassign - Return asset to inventory
- DELETE /api/assets/employee-assignments/{emp_code} - Delete employee assignment
- GET /api/payroll/leave-policy-rules - Get leave policy config
- PUT /api/payroll/leave-policy-rules - Update leave policy config
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hrpro-dashboard.preview.emergentagent.com')

class TestAssetOperations:
    """Test asset CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.auth_cookies = login_response.cookies
        self.session.cookies.update(self.auth_cookies)
    
    def test_get_assets_inventory(self):
        """Test GET /api/assets returns asset inventory list with total count"""
        response = self.session.get(f"{BASE_URL}/api/assets")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total" in data, "Response should have 'total' field"
        assert "assets" in data, "Response should have 'assets' field"
        assert isinstance(data["assets"], list), "Assets should be a list"
        print(f"✓ GET /api/assets - Found {data['total']} assets")
    
    def test_get_assets_with_filters(self):
        """Test GET /api/assets with type and status filters"""
        # Test with type filter
        response = self.session.get(f"{BASE_URL}/api/assets?asset_type=laptop")
        assert response.status_code == 200
        
        # Test with status filter
        response = self.session.get(f"{BASE_URL}/api/assets?status=assigned")
        assert response.status_code == 200
        
        # Test with search
        response = self.session.get(f"{BASE_URL}/api/assets?search=test")
        assert response.status_code == 200
        print("✓ GET /api/assets with filters works")
    
    def test_get_employee_assignments(self):
        """Test GET /api/assets/employee-assignments returns employee summaries"""
        response = self.session.get(f"{BASE_URL}/api/assets/employee-assignments")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total" in data, "Response should have 'total' field"
        assert "records" in data, "Response should have 'records' field"
        assert isinstance(data["records"], list), "Records should be a list"
        
        # Check record structure if records exist
        if data["records"]:
            record = data["records"][0]
            assert "emp_code" in record, "Record should have emp_code"
            assert "assigned_assets" in record or "assets_count" in record, "Record should have assets info"
        
        print(f"✓ GET /api/assets/employee-assignments - Found {data['total']} employee records")
    
    def test_create_and_delete_asset(self):
        """Test POST /api/assets and DELETE /api/assets/{asset_id}"""
        # Create a test asset
        test_asset = {
            "name": f"Test Asset {uuid.uuid4().hex[:8]}",
            "asset_tag": f"TEST-{uuid.uuid4().hex[:6]}",
            "category": "laptop",
            "brand": "Test Brand",
            "model": "Test Model",
            "condition": "good"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/assets",
            json=test_asset
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        created_asset = create_response.json()
        asset_id = created_asset.get("asset_id")
        assert asset_id, "Created asset should have asset_id"
        print(f"✓ Created test asset: {asset_id}")
        
        # Delete the asset (soft delete)
        delete_response = self.session.delete(f"{BASE_URL}/api/assets/{asset_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        delete_data = delete_response.json()
        assert "message" in delete_data, "Delete response should have message"
        print(f"✓ DELETE /api/assets/{asset_id} - Asset soft deleted")
    
    def test_update_asset(self):
        """Test PUT /api/assets/{asset_id} updates asset details"""
        # First create a test asset
        test_asset = {
            "name": f"Update Test {uuid.uuid4().hex[:8]}",
            "asset_tag": f"UPD-{uuid.uuid4().hex[:6]}",
            "category": "laptop"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/assets", json=test_asset)
        assert create_response.status_code == 200
        asset_id = create_response.json().get("asset_id")
        
        # Update the asset
        update_data = {
            "description": "Updated description",
            "asset_tag": f"UPD-NEW-{uuid.uuid4().hex[:4]}",
            "asset_type": "system"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/assets/{asset_id}",
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_asset = update_response.json()
        
        # Verify update
        assert updated_asset.get("description") == "Updated description", "Description should be updated"
        print(f"✓ PUT /api/assets/{asset_id} - Asset updated successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/assets/{asset_id}")
    
    def test_reassign_asset(self):
        """Test PUT /api/assets/{asset_id}/reassign reassigns asset to new employee"""
        # Create a test asset
        test_asset = {
            "name": f"Reassign Test {uuid.uuid4().hex[:8]}",
            "asset_tag": f"RSN-{uuid.uuid4().hex[:6]}",
            "category": "laptop"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/assets", json=test_asset)
        assert create_response.status_code == 200
        asset_id = create_response.json().get("asset_id")
        
        # Reassign to an employee
        reassign_data = {
            "emp_code": "TEST_EMP_001",
            "employee_name": "Test Employee"
        }
        
        reassign_response = self.session.put(
            f"{BASE_URL}/api/assets/{asset_id}/reassign",
            json=reassign_data
        )
        assert reassign_response.status_code == 200, f"Reassign failed: {reassign_response.text}"
        reassigned_asset = reassign_response.json()
        
        # Verify reassignment
        assert reassigned_asset.get("status") == "assigned", "Asset should be assigned"
        assert reassigned_asset.get("emp_code") == "TEST_EMP_001", "emp_code should match"
        print(f"✓ PUT /api/assets/{asset_id}/reassign - Asset reassigned successfully")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/assets/{asset_id}")
    
    def test_unassign_asset(self):
        """Test PUT /api/assets/{asset_id}/unassign returns asset to inventory"""
        # Create and assign a test asset
        test_asset = {
            "name": f"Unassign Test {uuid.uuid4().hex[:8]}",
            "asset_tag": f"UNA-{uuid.uuid4().hex[:6]}",
            "category": "laptop"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/assets", json=test_asset)
        assert create_response.status_code == 200
        asset_id = create_response.json().get("asset_id")
        
        # First assign it
        self.session.put(
            f"{BASE_URL}/api/assets/{asset_id}/reassign",
            json={"emp_code": "TEST_EMP_002", "employee_name": "Test Employee 2"}
        )
        
        # Now unassign it
        unassign_response = self.session.put(f"{BASE_URL}/api/assets/{asset_id}/unassign")
        assert unassign_response.status_code == 200, f"Unassign failed: {unassign_response.text}"
        unassigned_asset = unassign_response.json()
        
        # Verify unassignment
        assert unassigned_asset.get("status") == "available", "Asset should be available"
        assert unassigned_asset.get("emp_code") is None, "emp_code should be None"
        print(f"✓ PUT /api/assets/{asset_id}/unassign - Asset returned to inventory")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/assets/{asset_id}")
    
    def test_delete_employee_assignment(self):
        """Test DELETE /api/assets/employee-assignments/{emp_code}"""
        # First create an asset and assign it to create an employee assignment
        test_asset = {
            "name": f"EmpAssign Test {uuid.uuid4().hex[:8]}",
            "asset_tag": f"EMP-{uuid.uuid4().hex[:6]}",
            "category": "laptop"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/assets", json=test_asset)
        assert create_response.status_code == 200
        asset_id = create_response.json().get("asset_id")
        
        test_emp_code = f"TEST_DEL_{uuid.uuid4().hex[:6]}"
        
        # Assign to create employee assignment
        self.session.put(
            f"{BASE_URL}/api/assets/{asset_id}/reassign",
            json={"emp_code": test_emp_code, "employee_name": "Delete Test Employee"}
        )
        
        # Delete employee assignment
        delete_response = self.session.delete(
            f"{BASE_URL}/api/assets/employee-assignments/{test_emp_code}"
        )
        assert delete_response.status_code == 200, f"Delete assignment failed: {delete_response.text}"
        delete_data = delete_response.json()
        assert "message" in delete_data, "Response should have message"
        print(f"✓ DELETE /api/assets/employee-assignments/{test_emp_code} - Assignment deleted")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/assets/{asset_id}")


class TestLeavePolicyRules:
    """Test leave policy rules endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.session.cookies.update(login_response.cookies)
    
    def test_get_leave_policy_rules(self):
        """Test GET /api/payroll/leave-policy-rules returns leave policy configuration"""
        response = self.session.get(f"{BASE_URL}/api/payroll/leave-policy-rules")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "annual_quotas" in data, "Response should have annual_quotas"
        assert "carry_forward" in data, "Response should have carry_forward"
        assert "sunday_leave_rules" in data, "Response should have sunday_leave_rules"
        
        # Verify annual quotas structure
        quotas = data["annual_quotas"]
        assert "CL" in quotas, "Should have CL quota"
        assert "SL" in quotas, "Should have SL quota"
        assert "EL" in quotas, "Should have EL quota"
        
        # Verify carry forward structure
        carry = data["carry_forward"]
        assert "CL" in carry, "Should have CL carry forward setting"
        assert "EL" in carry, "Should have EL carry forward setting"
        assert "max_el_accumulation" in carry, "Should have max_el_accumulation"
        
        # Verify sunday rules structure
        sunday = data["sunday_leave_rules"]
        assert "enabled" in sunday, "Should have enabled flag"
        assert "weekly_threshold" in sunday, "Should have weekly_threshold"
        assert "monthly_threshold" in sunday, "Should have monthly_threshold"
        
        print(f"✓ GET /api/payroll/leave-policy-rules - Config retrieved")
        print(f"  Annual Quotas: CL={quotas.get('CL')}, SL={quotas.get('SL')}, EL={quotas.get('EL')}")
        print(f"  Sunday Rules: enabled={sunday.get('enabled')}, weekly={sunday.get('weekly_threshold')}, monthly={sunday.get('monthly_threshold')}")
    
    def test_update_leave_policy_rules(self):
        """Test PUT /api/payroll/leave-policy-rules updates leave policy configuration"""
        # Get current rules first
        get_response = self.session.get(f"{BASE_URL}/api/payroll/leave-policy-rules")
        assert get_response.status_code == 200
        current_rules = get_response.json()
        
        # Update with new values
        updated_rules = {
            "financial_year_start": "04-01",
            "annual_quotas": {
                "CL": 7,  # Changed from default
                "SL": 7,
                "EL": 15
            },
            "carry_forward": {
                "CL": False,
                "SL": False,
                "EL": True,
                "max_el_accumulation": 35
            },
            "sunday_leave_rules": {
                "enabled": True,
                "weekly_threshold": 3,
                "monthly_threshold": 7,
                "auto_apply": True
            }
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/payroll/leave-policy-rules",
            json=updated_rules
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        update_data = update_response.json()
        
        assert "message" in update_data, "Response should have message"
        assert "leave_policy_rules" in update_data, "Response should have leave_policy_rules"
        
        # Verify the update was applied
        verify_response = self.session.get(f"{BASE_URL}/api/payroll/leave-policy-rules")
        assert verify_response.status_code == 200
        verified_rules = verify_response.json()
        
        assert verified_rules["annual_quotas"]["CL"] == 7, "CL quota should be updated"
        assert verified_rules["sunday_leave_rules"]["weekly_threshold"] == 3, "Weekly threshold should be updated"
        
        print("✓ PUT /api/payroll/leave-policy-rules - Config updated and verified")
        
        # Restore original values
        restore_rules = {
            "financial_year_start": current_rules.get("financial_year_start", "04-01"),
            "annual_quotas": current_rules.get("annual_quotas", {"CL": 6, "SL": 6, "EL": 12}),
            "carry_forward": current_rules.get("carry_forward", {"CL": False, "SL": False, "EL": True, "max_el_accumulation": 30}),
            "sunday_leave_rules": current_rules.get("sunday_leave_rules", {"enabled": True, "weekly_threshold": 2, "monthly_threshold": 6, "auto_apply": True})
        }
        self.session.put(f"{BASE_URL}/api/payroll/leave-policy-rules", json=restore_rules)
        print("✓ Original leave policy rules restored")


class TestAssetNotFound:
    """Test error handling for non-existent assets"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200
        self.session.cookies.update(login_response.cookies)
    
    def test_get_nonexistent_asset(self):
        """Test GET /api/assets/{asset_id} returns 404 for non-existent asset"""
        response = self.session.get(f"{BASE_URL}/api/assets/nonexistent_asset_id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET non-existent asset returns 404")
    
    def test_update_nonexistent_asset(self):
        """Test PUT /api/assets/{asset_id} returns 404 for non-existent asset"""
        response = self.session.put(
            f"{BASE_URL}/api/assets/nonexistent_asset_id",
            json={"description": "test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT non-existent asset returns 404")
    
    def test_delete_nonexistent_asset(self):
        """Test DELETE /api/assets/{asset_id} returns 404 for non-existent asset"""
        response = self.session.delete(f"{BASE_URL}/api/assets/nonexistent_asset_id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE non-existent asset returns 404")
    
    def test_reassign_without_emp_code(self):
        """Test PUT /api/assets/{asset_id}/reassign returns 400 without emp_code"""
        # Create a test asset first
        test_asset = {
            "name": f"Error Test {uuid.uuid4().hex[:8]}",
            "asset_tag": f"ERR-{uuid.uuid4().hex[:6]}",
            "category": "laptop"
        }
        create_response = self.session.post(f"{BASE_URL}/api/assets", json=test_asset)
        asset_id = create_response.json().get("asset_id")
        
        # Try to reassign without emp_code
        response = self.session.put(
            f"{BASE_URL}/api/assets/{asset_id}/reassign",
            json={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Reassign without emp_code returns 400")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/assets/{asset_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
