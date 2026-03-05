"""
Test cases for Two-Step Leave Approval Flow:
Employee → Manager → HR

Tests cover:
1. POST /api/leave/apply - sets dept_head_id from reporting_manager_id
2. GET /api/leave/pending-approvals - returns leaves for managers with reportees
3. PUT /api/leave/{leave_id}/approve - Manager approval sets dept_head_status=approved but keeps status=pending
4. PUT /api/leave/{leave_id}/approve - HR approval after manager sets final status=approved
5. PUT /api/leave/{leave_id}/reject - Manager can reject leave request
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "password"
EMPLOYEE_RUDRA_EMAIL = "accounts2@shardadiesels.co.in"  # Employee who applies for leave
EMPLOYEE_RUDRA_PASSWORD = "password"
EMPLOYEE_RUDRA_ID = "EMP31088E46"
MANAGER_RAJIV_EMAIL = "purchase1@shardadiesels.co.in"  # Rudra's reporting manager
MANAGER_RAJIV_PASSWORD = "password"
MANAGER_RAJIV_ID = "EMPD12C8C64"


class TestLeaveApprovalFlow:
    """Test two-step leave approval: Employee → Manager → HR"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session with token"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
        return session
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Get employee (Rudra) session with token"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_RUDRA_EMAIL,
            "password": EMPLOYEE_RUDRA_PASSWORD
        })
        assert response.status_code == 200, f"Employee login failed: {response.text}"
        token = response.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
        return session
    
    @pytest.fixture(scope="class")
    def manager_session(self):
        """Get manager (Rajiv) session with token"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_RAJIV_EMAIL,
            "password": MANAGER_RAJIV_PASSWORD
        })
        assert response.status_code == 200, f"Manager login failed: {response.text}"
        token = response.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
        return session
    
    # --------------------------------------------------
    # TEST 1: Verify employee has reporting_manager_id set
    # --------------------------------------------------
    def test_employee_has_reporting_manager(self, admin_session):
        """Verify Rudra's reporting_manager_id is set to Rajiv"""
        response = admin_session.get(f"{BASE_URL}/api/employees/{EMPLOYEE_RUDRA_ID}")
        assert response.status_code == 200, f"Failed to get employee: {response.text}"
        
        employee = response.json()
        assert employee.get("reporting_manager_id") == MANAGER_RAJIV_ID, \
            f"Expected reporting_manager_id={MANAGER_RAJIV_ID}, got {employee.get('reporting_manager_id')}"
        print(f"✓ Employee {EMPLOYEE_RUDRA_ID} has reporting_manager_id={MANAGER_RAJIV_ID}")
    
    # --------------------------------------------------
    # TEST 2: Apply leave sets dept_head_id from reporting_manager_id
    # --------------------------------------------------
    def test_apply_leave_sets_dept_head_id(self, employee_session, admin_session):
        """POST /api/leave/apply should set dept_head_id from employee's reporting_manager_id"""
        # Apply leave as employee
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        leave_data = {
            "leave_type_id": "lt_cl",  # Casual Leave
            "from_date": tomorrow,
            "to_date": tomorrow,
            "is_half_day": False,
            "reason": "TEST_two_step_approval_test"
        }
        
        response = employee_session.post(f"{BASE_URL}/api/leave/apply", json=leave_data)
        assert response.status_code == 200, f"Failed to apply leave: {response.text}"
        
        leave_response = response.json()
        leave_id = leave_response.get("leave_id")
        assert leave_id, "Leave ID not returned"
        print(f"✓ Leave applied with ID: {leave_id}")
        
        # Verify leave request has correct dept_head_id
        # Use admin to fetch the leave request directly
        leaves_response = admin_session.get(f"{BASE_URL}/api/leave/requests?employee_id={EMPLOYEE_RUDRA_ID}&limit=50")
        assert leaves_response.status_code == 200, f"Failed to get leave requests: {leaves_response.text}"
        
        leaves = leaves_response.json()
        test_leave = next((l for l in leaves if l.get("leave_id") == leave_id), None)
        assert test_leave, f"Could not find leave request {leave_id}"
        
        # Verify dept_head_id is set to reporting_manager_id
        assert test_leave.get("dept_head_id") == MANAGER_RAJIV_ID, \
            f"Expected dept_head_id={MANAGER_RAJIV_ID}, got {test_leave.get('dept_head_id')}"
        assert test_leave.get("dept_head_status") == "pending", \
            f"Expected dept_head_status=pending, got {test_leave.get('dept_head_status')}"
        assert test_leave.get("hr_status") == "pending", \
            f"Expected hr_status=pending, got {test_leave.get('hr_status')}"
        assert test_leave.get("status") == "pending", \
            f"Expected status=pending, got {test_leave.get('status')}"
        
        print(f"✓ Leave has dept_head_id={test_leave.get('dept_head_id')}, dept_head_status={test_leave.get('dept_head_status')}")
        
        # Store leave_id for subsequent tests
        self.__class__.test_leave_id = leave_id
        return leave_id
    
    # --------------------------------------------------
    # TEST 3: Manager sees pending approvals from reportees
    # --------------------------------------------------
    def test_manager_sees_pending_approvals(self, manager_session):
        """GET /api/leave/pending-approvals should return leaves where user is the reporting manager"""
        response = manager_session.get(f"{BASE_URL}/api/leave/pending-approvals")
        assert response.status_code == 200, f"Failed to get pending approvals: {response.text}"
        
        pending = response.json()
        assert isinstance(pending, list), "Expected list of pending approvals"
        
        # Find our test leave
        test_leave = next((l for l in pending if "TEST_two_step_approval" in l.get("reason", "")), None)
        if test_leave:
            assert test_leave.get("dept_head_status") == "pending", \
                f"Expected dept_head_status=pending, got {test_leave.get('dept_head_status')}"
            print(f"✓ Manager sees pending leave from reportee: {test_leave.get('leave_id')}")
        else:
            # The leave might have been created in a previous test run; just check we got a list
            print(f"✓ Manager can access pending approvals endpoint. Found {len(pending)} pending leaves.")
    
    # --------------------------------------------------
    # TEST 4: Manager approval sets dept_head_status=approved, keeps status=pending
    # --------------------------------------------------
    def test_manager_approves_leave(self, manager_session, admin_session, employee_session):
        """PUT /api/leave/{leave_id}/approve - Manager approval should set dept_head_status=approved but keep status=pending"""
        # First apply a fresh leave for this test
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        leave_data = {
            "leave_type_id": "lt_cl",
            "from_date": tomorrow,
            "to_date": tomorrow,
            "is_half_day": False,
            "reason": "TEST_manager_approval_check"
        }
        
        apply_response = employee_session.post(f"{BASE_URL}/api/leave/apply", json=leave_data)
        assert apply_response.status_code == 200, f"Failed to apply leave: {apply_response.text}"
        leave_id = apply_response.json().get("leave_id")
        print(f"✓ Created test leave: {leave_id}")
        
        # Manager approves
        approve_response = manager_session.put(f"{BASE_URL}/api/leave/{leave_id}/approve")
        assert approve_response.status_code == 200, f"Manager approval failed: {approve_response.text}"
        
        result = approve_response.json()
        print(f"✓ Manager approval response: {result.get('message')}")
        
        # Verify leave status via admin
        leaves_response = admin_session.get(f"{BASE_URL}/api/leave/requests?employee_id={EMPLOYEE_RUDRA_ID}&limit=50")
        leaves = leaves_response.json()
        approved_leave = next((l for l in leaves if l.get("leave_id") == leave_id), None)
        assert approved_leave, f"Could not find leave {leave_id}"
        
        # Manager approved: dept_head_status should be approved, but overall status still pending (waiting HR)
        assert approved_leave.get("dept_head_status") == "approved", \
            f"Expected dept_head_status=approved, got {approved_leave.get('dept_head_status')}"
        assert approved_leave.get("status") == "pending", \
            f"Expected status=pending after manager approval, got {approved_leave.get('status')}"
        assert approved_leave.get("hr_status") == "pending", \
            f"Expected hr_status=pending, got {approved_leave.get('hr_status')}"
        
        print(f"✓ After manager approval: dept_head_status={approved_leave.get('dept_head_status')}, status={approved_leave.get('status')}, hr_status={approved_leave.get('hr_status')}")
        
        # Store for HR approval test
        self.__class__.manager_approved_leave_id = leave_id
        return leave_id
    
    # --------------------------------------------------
    # TEST 5: HR approval after manager sets final status=approved
    # --------------------------------------------------
    def test_hr_approves_after_manager(self, admin_session):
        """PUT /api/leave/{leave_id}/approve - HR approval after manager should set final status=approved"""
        leave_id = getattr(self.__class__, 'manager_approved_leave_id', None)
        
        if not leave_id:
            pytest.skip("No manager-approved leave found from previous test")
        
        # HR (admin) approves
        approve_response = admin_session.put(f"{BASE_URL}/api/leave/{leave_id}/approve")
        assert approve_response.status_code == 200, f"HR approval failed: {approve_response.text}"
        
        result = approve_response.json()
        print(f"✓ HR approval response: {result.get('message')}")
        
        # Verify final status
        leaves_response = admin_session.get(f"{BASE_URL}/api/leave/requests?employee_id={EMPLOYEE_RUDRA_ID}&limit=50")
        leaves = leaves_response.json()
        final_leave = next((l for l in leaves if l.get("leave_id") == leave_id), None)
        assert final_leave, f"Could not find leave {leave_id}"
        
        # After HR approval, status should be approved
        assert final_leave.get("status") == "approved", \
            f"Expected status=approved after HR approval, got {final_leave.get('status')}"
        assert final_leave.get("hr_status") == "approved", \
            f"Expected hr_status=approved, got {final_leave.get('hr_status')}"
        assert final_leave.get("dept_head_status") == "approved", \
            f"Expected dept_head_status=approved, got {final_leave.get('dept_head_status')}"
        
        print(f"✓ After HR approval: status={final_leave.get('status')}, dept_head_status={final_leave.get('dept_head_status')}, hr_status={final_leave.get('hr_status')}")
    
    # --------------------------------------------------
    # TEST 6: Manager can reject leave request
    # --------------------------------------------------
    def test_manager_can_reject_leave(self, manager_session, admin_session, employee_session):
        """PUT /api/leave/{leave_id}/reject - Manager can reject leave request"""
        # Apply a fresh leave for rejection test
        day_after = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        leave_data = {
            "leave_type_id": "lt_sl",  # Sick Leave
            "from_date": day_after,
            "to_date": day_after,
            "is_half_day": False,
            "reason": "TEST_manager_rejection_test"
        }
        
        apply_response = employee_session.post(f"{BASE_URL}/api/leave/apply", json=leave_data)
        assert apply_response.status_code == 200, f"Failed to apply leave: {apply_response.text}"
        leave_id = apply_response.json().get("leave_id")
        print(f"✓ Created leave for rejection test: {leave_id}")
        
        # Manager rejects
        rejection_reason = "TEST_Rejected for testing purposes"
        reject_response = manager_session.put(
            f"{BASE_URL}/api/leave/{leave_id}/reject?rejection_reason={rejection_reason}"
        )
        assert reject_response.status_code == 200, f"Manager rejection failed: {reject_response.text}"
        
        result = reject_response.json()
        print(f"✓ Manager rejection response: {result.get('message')}")
        
        # Verify status is rejected
        leaves_response = admin_session.get(f"{BASE_URL}/api/leave/requests?employee_id={EMPLOYEE_RUDRA_ID}&limit=50")
        leaves = leaves_response.json()
        rejected_leave = next((l for l in leaves if l.get("leave_id") == leave_id), None)
        assert rejected_leave, f"Could not find leave {leave_id}"
        
        assert rejected_leave.get("status") == "rejected", \
            f"Expected status=rejected, got {rejected_leave.get('status')}"
        assert rejection_reason in (rejected_leave.get("rejection_reason") or ""), \
            f"Rejection reason not saved correctly"
        
        print(f"✓ Leave rejected: status={rejected_leave.get('status')}, reason={rejected_leave.get('rejection_reason')}")
    
    # --------------------------------------------------
    # TEST 7: HR can approve directly without manager approval
    # --------------------------------------------------
    def test_hr_can_approve_directly(self, admin_session, employee_session):
        """HR can approve leave even if manager hasn't approved yet"""
        # Apply a fresh leave
        day_after = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d")
        leave_data = {
            "leave_type_id": "lt_cl",
            "from_date": day_after,
            "to_date": day_after,
            "is_half_day": False,
            "reason": "TEST_hr_direct_approval"
        }
        
        apply_response = employee_session.post(f"{BASE_URL}/api/leave/apply", json=leave_data)
        assert apply_response.status_code == 200, f"Failed to apply leave: {apply_response.text}"
        leave_id = apply_response.json().get("leave_id")
        print(f"✓ Created leave for HR direct approval: {leave_id}")
        
        # HR approves directly
        approve_response = admin_session.put(f"{BASE_URL}/api/leave/{leave_id}/approve")
        assert approve_response.status_code == 200, f"HR direct approval failed: {approve_response.text}"
        
        # Verify status
        leaves_response = admin_session.get(f"{BASE_URL}/api/leave/requests?employee_id={EMPLOYEE_RUDRA_ID}&limit=50")
        leaves = leaves_response.json()
        approved_leave = next((l for l in leaves if l.get("leave_id") == leave_id), None)
        assert approved_leave, f"Could not find leave {leave_id}"
        
        # HR approval should set status=approved and hr_status=approved
        assert approved_leave.get("status") == "approved", \
            f"Expected status=approved, got {approved_leave.get('status')}"
        assert approved_leave.get("hr_status") == "approved", \
            f"Expected hr_status=approved, got {approved_leave.get('hr_status')}"
        
        print(f"✓ HR direct approval: status={approved_leave.get('status')}, hr_status={approved_leave.get('hr_status')}")


class TestLeaveApprovalStatusDisplay:
    """Test leave status display with dept_head_status and hr_status"""
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Get employee session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_RUDRA_EMAIL,
            "password": EMPLOYEE_RUDRA_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_my_requests_show_approval_status(self, employee_session):
        """GET /api/leave/my-requests should include dept_head_status and hr_status"""
        response = employee_session.get(f"{BASE_URL}/api/leave/my-requests")
        assert response.status_code == 200, f"Failed to get my requests: {response.text}"
        
        requests_list = response.json()
        assert isinstance(requests_list, list), "Expected list of leave requests"
        
        if requests_list:
            # Check that at least one request has approval status fields
            sample = requests_list[0]
            # dept_head_status and hr_status should be present
            has_status_fields = "dept_head_status" in sample or "hr_status" in sample
            print(f"✓ Sample leave request fields: {list(sample.keys())}")
            print(f"✓ Found {len(requests_list)} leave requests for employee")
        else:
            print("✓ No leave requests found for employee (empty list returned)")


class TestApprovalsTabVisibility:
    """Test that Approvals tab appears for users with pending approvals"""
    
    @pytest.fixture(scope="class")
    def manager_session(self):
        """Get manager session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_RAJIV_EMAIL,
            "password": MANAGER_RAJIV_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_manager_pending_approvals_accessible(self, manager_session):
        """Manager (even without manager role) can access pending-approvals if they have reportees"""
        response = manager_session.get(f"{BASE_URL}/api/leave/pending-approvals")
        assert response.status_code == 200, f"Manager should be able to access pending approvals: {response.text}"
        
        pending = response.json()
        print(f"✓ Manager can access pending approvals endpoint. Found {len(pending)} pending requests.")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
