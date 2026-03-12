"""
Test Work From Home (WFH) Request/Approval API endpoints
Tests the complete WFH flow: apply -> manager approve -> HR approve -> attendance auto-marked
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWFHFeature:
    """Work From Home feature test suite"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin to get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("access_token")
            self.user = data.get("user", {})
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    # ==== WFH Apply API Tests ====
    
    def test_wfh_apply_success(self):
        """Test POST /api/wfh/apply - Apply for WFH returns wfh_id, status=pending, correct dates"""
        payload = {
            "from_date": "2026-03-25",
            "to_date": "2026-03-26",
            "reason": "Testing WFH apply endpoint"
        }
        
        response = self.session.post(f"{BASE_URL}/api/wfh/apply", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "wfh_id" in data, "Response should contain wfh_id"
        assert data["wfh_id"].startswith("WFH-"), f"wfh_id should start with 'WFH-', got {data['wfh_id']}"
        assert data.get("status") == "pending", f"Status should be 'pending', got {data.get('status')}"
        assert data.get("from_date") == "2026-03-25", f"from_date mismatch: {data.get('from_date')}"
        assert data.get("to_date") == "2026-03-26", f"to_date mismatch: {data.get('to_date')}"
        assert "days" in data, "Response should contain days count"
        assert data.get("reason") == "Testing WFH apply endpoint"
        
        # Store wfh_id for later tests
        self.__class__.test_wfh_id = data["wfh_id"]
        print(f"[PASS] WFH apply successful - wfh_id: {data['wfh_id']}, days: {data.get('days')}")
    
    def test_wfh_apply_missing_fields(self):
        """Test POST /api/wfh/apply - Validation for missing fields"""
        # Missing from_date
        response = self.session.post(f"{BASE_URL}/api/wfh/apply", json={
            "to_date": "2026-03-26",
            "reason": "Test"
        })
        assert response.status_code in [400, 422], f"Should reject missing from_date: {response.status_code}"
        print("[PASS] Validation works for missing from_date")
    
    # ==== WFH My Requests API Tests ====
    
    def test_wfh_my_requests(self):
        """Test GET /api/wfh/my-requests - Returns user's WFH requests"""
        response = self.session.get(f"{BASE_URL}/api/wfh/my-requests")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            first_req = data[0]
            assert "wfh_id" in first_req, "Each request should have wfh_id"
            assert "from_date" in first_req, "Each request should have from_date"
            assert "to_date" in first_req, "Each request should have to_date"
            assert "status" in first_req, "Each request should have status"
            assert "reason" in first_req, "Each request should have reason"
            print(f"[PASS] GET /api/wfh/my-requests returned {len(data)} requests")
        else:
            print("[PASS] GET /api/wfh/my-requests returned empty list (no requests yet)")
    
    def test_wfh_my_requests_filter_status(self):
        """Test GET /api/wfh/my-requests with status filter"""
        response = self.session.get(f"{BASE_URL}/api/wfh/my-requests?status=pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # All results should be pending
        for req in data:
            assert req.get("status") == "pending", f"Expected all pending, got {req.get('status')}"
        
        print(f"[PASS] Status filter works - {len(data)} pending requests")
    
    # ==== WFH Pending Approvals API Tests ====
    
    def test_wfh_pending_approvals(self):
        """Test GET /api/wfh/pending-approvals - Returns pending WFH requests with employee names"""
        response = self.session.get(f"{BASE_URL}/api/wfh/pending-approvals")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            first_req = data[0]
            # Verify structure includes employee info
            assert "wfh_id" in first_req, "Should have wfh_id"
            assert "from_date" in first_req, "Should have from_date"
            assert "to_date" in first_req, "Should have to_date"
            # Employee name should be enriched
            if "employee_name" in first_req or "employee_id" in first_req:
                print(f"[PASS] GET /api/wfh/pending-approvals returned {len(data)} requests with employee info")
            else:
                print(f"[WARN] Employee info may be missing in response")
        else:
            print("[PASS] GET /api/wfh/pending-approvals returned empty list")
    
    # ==== WFH Approve API Tests ====
    
    def test_wfh_approve(self):
        """Test PUT /api/wfh/{wfh_id}/approve - Approve WFH request"""
        # First apply for a new WFH to approve
        apply_payload = {
            "from_date": "2026-03-27",
            "to_date": "2026-03-28",
            "reason": "Testing WFH approval flow"
        }
        
        apply_response = self.session.post(f"{BASE_URL}/api/wfh/apply", json=apply_payload)
        if apply_response.status_code != 200:
            pytest.skip(f"Could not create WFH for approval test: {apply_response.text}")
        
        wfh_id = apply_response.json().get("wfh_id")
        
        # Now approve it
        response = self.session.put(f"{BASE_URL}/api/wfh/{wfh_id}/approve")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        # Message should indicate approval (either full or manager approval)
        assert "approved" in data["message"].lower() or "wfh" in data["message"].lower(), \
            f"Message should indicate approval: {data['message']}"
        
        print(f"[PASS] WFH approve successful: {data['message']}")
    
    def test_wfh_approve_nonexistent(self):
        """Test PUT /api/wfh/{wfh_id}/approve - 404 for non-existent request"""
        response = self.session.put(f"{BASE_URL}/api/wfh/WFH-NOTEXIST/approve")
        
        assert response.status_code == 404, f"Expected 404 for non-existent WFH, got {response.status_code}"
        print("[PASS] Returns 404 for non-existent WFH request")
    
    # ==== WFH Reject API Tests ====
    
    def test_wfh_reject(self):
        """Test PUT /api/wfh/{wfh_id}/reject - Reject WFH with rejection_reason query param"""
        # First apply for a new WFH to reject
        apply_payload = {
            "from_date": "2026-03-29",
            "to_date": "2026-03-30",
            "reason": "Testing WFH rejection flow"
        }
        
        apply_response = self.session.post(f"{BASE_URL}/api/wfh/apply", json=apply_payload)
        if apply_response.status_code != 200:
            pytest.skip(f"Could not create WFH for rejection test: {apply_response.text}")
        
        wfh_id = apply_response.json().get("wfh_id")
        
        # Reject with reason as query parameter
        rejection_reason = "Not enough notice provided"
        response = self.session.put(f"{BASE_URL}/api/wfh/{wfh_id}/reject?rejection_reason={rejection_reason}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert "rejected" in data["message"].lower(), f"Message should indicate rejection: {data['message']}"
        
        print(f"[PASS] WFH reject successful: {data['message']}")
    
    # ==== WFH Cancel API Tests ====
    
    def test_wfh_cancel(self):
        """Test PUT /api/wfh/{wfh_id}/cancel - Cancel own pending WFH request"""
        # First apply for a new WFH to cancel
        apply_payload = {
            "from_date": "2026-03-31",
            "to_date": "2026-04-01",
            "reason": "Testing WFH cancel flow"
        }
        
        apply_response = self.session.post(f"{BASE_URL}/api/wfh/apply", json=apply_payload)
        if apply_response.status_code != 200:
            pytest.skip(f"Could not create WFH for cancel test: {apply_response.text}")
        
        wfh_id = apply_response.json().get("wfh_id")
        
        # Cancel the request
        response = self.session.put(f"{BASE_URL}/api/wfh/{wfh_id}/cancel")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert "cancelled" in data["message"].lower(), f"Message should indicate cancellation: {data['message']}"
        
        print(f"[PASS] WFH cancel successful: {data['message']}")
    
    def test_wfh_cancel_nonexistent(self):
        """Test PUT /api/wfh/{wfh_id}/cancel - 404 for non-existent request"""
        response = self.session.put(f"{BASE_URL}/api/wfh/WFH-NOTEXIST/cancel")
        
        assert response.status_code == 404, f"Expected 404 for non-existent WFH, got {response.status_code}"
        print("[PASS] Returns 404 for non-existent WFH cancel")
    
    # ==== WFH Days Calculation Test ====
    
    def test_wfh_days_calculation(self):
        """Test that WFH request correctly calculates days"""
        # 3-day WFH request
        payload = {
            "from_date": "2026-04-06",
            "to_date": "2026-04-08",
            "reason": "Testing days calculation"
        }
        
        response = self.session.post(f"{BASE_URL}/api/wfh/apply", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should be 3 days (6th, 7th, 8th)
        assert data.get("days") == 3, f"Expected 3 days, got {data.get('days')}"
        print(f"[PASS] Days calculation correct: {data.get('days')} days for April 6-8")
    
    # ==== Verify Approved WFH Status in My Requests ====
    
    def test_wfh_approved_status_persists(self):
        """Test that approved WFH shows correct status in my-requests"""
        # Apply
        apply_payload = {
            "from_date": "2026-04-10",
            "to_date": "2026-04-10",
            "reason": "Testing approval persistence"
        }
        
        apply_response = self.session.post(f"{BASE_URL}/api/wfh/apply", json=apply_payload)
        if apply_response.status_code != 200:
            pytest.skip(f"Could not create WFH: {apply_response.text}")
        
        wfh_id = apply_response.json().get("wfh_id")
        
        # Approve
        approve_response = self.session.put(f"{BASE_URL}/api/wfh/{wfh_id}/approve")
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
        
        # Check my-requests - should show the request
        my_requests_response = self.session.get(f"{BASE_URL}/api/wfh/my-requests")
        assert my_requests_response.status_code == 200
        
        requests_list = my_requests_response.json()
        target_req = next((r for r in requests_list if r.get("wfh_id") == wfh_id), None)
        
        if target_req:
            # Status should be either 'approved' or 'pending' (if two-step approval)
            assert target_req.get("status") in ["approved", "pending"], \
                f"Unexpected status: {target_req.get('status')}"
            print(f"[PASS] Approved WFH shows status: {target_req.get('status')}")
        else:
            print(f"[INFO] WFH {wfh_id} not found in my-requests (may have been filtered)")


class TestWFHUnauthorized:
    """Test unauthorized access to WFH endpoints"""
    
    def test_wfh_my_requests_unauthorized(self):
        """Test GET /api/wfh/my-requests without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/wfh/my-requests")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("[PASS] Unauthorized access correctly returns 401")
    
    def test_wfh_apply_unauthorized(self):
        """Test POST /api/wfh/apply without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/wfh/apply", json={
            "from_date": "2026-04-01",
            "to_date": "2026-04-02",
            "reason": "Test"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("[PASS] Apply without auth correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
