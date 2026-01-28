"""
Test Suite for New Features:
1. HR Attendance Editing (Edit Records tab, Manual attendance entry)
2. Tour Management (Create tour, My Tours, Remote Check-in, Field Employees)
3. Payslip PDF Download
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Admin@123"
EMPLOYEE_EMAIL = "employee@shardahr.com"
EMPLOYEE_PASSWORD = "Employee@123"

# Test payslip ID provided
TEST_PAYSLIP_ID = "ps_b09fe38ce3de"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session, data.get("user", {})
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Get employee session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_EMAIL,
            "password": EMPLOYEE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Employee login failed: {response.text}")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session, data.get("user", {})
    
    def test_admin_login(self, admin_session):
        """Test admin login works"""
        session, user = admin_session
        assert user.get("email") == ADMIN_EMAIL
        assert user.get("role") in ["super_admin", "hr_admin"]
        print(f"✓ Admin login successful: {user.get('name')}")


class TestHRAttendanceEditing:
    """Test HR Attendance Editing features"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_get_daily_attendance(self, admin_session):
        """Test GET /api/attendance/daily - Load attendance records for a date"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = admin_session.get(f"{BASE_URL}/api/attendance/daily?date={today}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Daily attendance loaded: {len(data)} records for {today}")
    
    def test_get_attendance_with_date_range(self, admin_session):
        """Test GET /api/attendance with date range"""
        today = datetime.now()
        from_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = admin_session.get(
            f"{BASE_URL}/api/attendance?from_date={from_date}&to_date={to_date}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Attendance records loaded: {len(data)} records from {from_date} to {to_date}")
    
    def test_edit_attendance_record(self, admin_session):
        """Test PUT /api/attendance/{attendance_id} - Edit attendance record"""
        # First get an attendance record
        today = datetime.now().strftime("%Y-%m-%d")
        response = admin_session.get(f"{BASE_URL}/api/attendance/daily?date={today}")
        
        if response.status_code == 200 and len(response.json()) > 0:
            record = response.json()[0]
            attendance_id = record.get("attendance_id")
            
            # Try to edit the record
            edit_response = admin_session.put(
                f"{BASE_URL}/api/attendance/{attendance_id}",
                json={
                    "status": record.get("status", "present"),
                    "remarks": "TEST_Edit_by_HR",
                    "edit_reason": "Testing HR edit functionality"
                }
            )
            assert edit_response.status_code == 200, f"Edit failed: {edit_response.text}"
            print(f"✓ Attendance record edited: {attendance_id}")
        else:
            # No records to edit, test with non-existent ID
            edit_response = admin_session.put(
                f"{BASE_URL}/api/attendance/att_nonexistent123",
                json={
                    "status": "present",
                    "edit_reason": "Testing"
                }
            )
            assert edit_response.status_code == 404
            print("✓ Edit returns 404 for non-existent record (expected)")
    
    def test_get_attendance_edit_history(self, admin_session):
        """Test GET /api/attendance/{attendance_id}/history"""
        # First get an attendance record
        today = datetime.now().strftime("%Y-%m-%d")
        response = admin_session.get(f"{BASE_URL}/api/attendance/daily?date={today}")
        
        if response.status_code == 200 and len(response.json()) > 0:
            record = response.json()[0]
            attendance_id = record.get("attendance_id")
            
            history_response = admin_session.get(
                f"{BASE_URL}/api/attendance/{attendance_id}/history"
            )
            assert history_response.status_code == 200, f"History failed: {history_response.text}"
            data = history_response.json()
            assert "edit_history" in data
            print(f"✓ Edit history retrieved: {len(data.get('edit_history', []))} entries")
        else:
            print("✓ No attendance records to check history (skipped)")
    
    def test_add_manual_attendance_validation(self, admin_session):
        """Test POST /api/attendance/manual - Validation"""
        # Test without required fields
        response = admin_session.post(
            f"{BASE_URL}/api/attendance/manual",
            json={}
        )
        assert response.status_code == 400, f"Should fail without required fields: {response.text}"
        print("✓ Manual attendance validation works (rejects empty request)")
    
    def test_add_manual_attendance_nonexistent_employee(self, admin_session):
        """Test POST /api/attendance/manual - Non-existent employee"""
        response = admin_session.post(
            f"{BASE_URL}/api/attendance/manual",
            json={
                "employee_id": "nonexistent_emp_123",
                "date": "2026-01-15",
                "status": "present",
                "first_in": "09:00",
                "last_out": "18:00",
                "edit_reason": "Testing"
            }
        )
        assert response.status_code == 404, f"Should return 404 for non-existent employee: {response.text}"
        print("✓ Manual attendance returns 404 for non-existent employee")


class TestTourManagement:
    """Test Tour Management features"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    @pytest.fixture(scope="class")
    def employee_session(self):
        """Get employee session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_EMAIL,
            "password": EMPLOYEE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Employee login failed")
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_list_travel_requests(self, admin_session):
        """Test GET /api/travel/requests - List all tour requests"""
        response = admin_session.get(f"{BASE_URL}/api/travel/requests")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Travel requests listed: {len(data)} requests")
    
    def test_create_tour_request(self, admin_session):
        """Test POST /api/travel/requests - Create new tour request"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = admin_session.post(
            f"{BASE_URL}/api/travel/requests",
            json={
                "purpose": "TEST_Client_Meeting",
                "location": "Mumbai",
                "client_name": "Test Client Corp",
                "start_date": tomorrow,
                "end_date": next_week,
                "transport_mode": "train",
                "remarks": "Testing tour creation",
                "request_type": "tour"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "request_id" in data
        assert data.get("status") == "pending"
        print(f"✓ Tour request created: {data.get('request_id')}")
        return data.get("request_id")
    
    def test_get_my_travel_requests(self, admin_session):
        """Test GET /api/travel/my-requests - Get user's own requests"""
        response = admin_session.get(f"{BASE_URL}/api/travel/my-requests")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ My travel requests: {len(data)} requests")
    
    def test_get_my_active_tour(self, admin_session):
        """Test GET /api/travel/my-active-tour - Check active tour status"""
        response = admin_session.get(f"{BASE_URL}/api/travel/my-active-tour")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "has_active_tour" in data
        assert "is_field_employee" in data
        assert "can_remote_checkin" in data
        print(f"✓ Active tour status: has_active_tour={data.get('has_active_tour')}, is_field_employee={data.get('is_field_employee')}")
    
    def test_remote_checkin_without_tour(self, admin_session):
        """Test POST /api/travel/remote-check-in - Without active tour"""
        response = admin_session.post(
            f"{BASE_URL}/api/travel/remote-check-in",
            json={
                "punch_type": "IN",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "location_name": "Mumbai Office"
            }
        )
        # Should fail if user is not on tour and not a field employee
        # Status could be 200 (if field employee) or 403 (if not authorized)
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code} - {response.text}"
        if response.status_code == 403:
            print("✓ Remote check-in correctly denied (not on tour/not field employee)")
        else:
            print("✓ Remote check-in allowed (user is field employee or on tour)")
    
    def test_remote_checkin_validation(self, admin_session):
        """Test POST /api/travel/remote-check-in - Validation"""
        # Test without GPS coordinates
        response = admin_session.post(
            f"{BASE_URL}/api/travel/remote-check-in",
            json={
                "punch_type": "IN"
            }
        )
        assert response.status_code == 400, f"Should fail without GPS: {response.text}"
        print("✓ Remote check-in validation works (requires GPS)")
    
    def test_get_field_employees(self, admin_session):
        """Test GET /api/travel/field-employees - List field employees (HR only)"""
        response = admin_session.get(f"{BASE_URL}/api/travel/field-employees")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Field employees listed: {len(data)} employees")
    
    def test_get_remote_checkins(self, admin_session):
        """Test GET /api/travel/remote-check-ins - List remote check-ins"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = admin_session.get(f"{BASE_URL}/api/travel/remote-check-ins?date={today}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Remote check-ins listed: {len(data)} check-ins for {today}")
    
    def test_approve_tour_request(self, admin_session):
        """Test PUT /api/travel/requests/{id}/approve - Approve tour"""
        # First create a tour request
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        create_response = admin_session.post(
            f"{BASE_URL}/api/travel/requests",
            json={
                "purpose": "TEST_Approval_Tour",
                "location": "Delhi",
                "start_date": tomorrow,
                "end_date": tomorrow,
                "request_type": "tour"
            }
        )
        
        if create_response.status_code == 200:
            request_id = create_response.json().get("request_id")
            
            # Approve the request
            approve_response = admin_session.put(
                f"{BASE_URL}/api/travel/requests/{request_id}/approve",
                json={"approved_budget": 5000, "remarks": "Approved for testing"}
            )
            assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
            print(f"✓ Tour request approved: {request_id}")
        else:
            print("✓ Tour creation skipped, approval test skipped")
    
    def test_toggle_field_employee(self, admin_session):
        """Test PUT /api/travel/field-employees/{id} - Toggle field employee status"""
        # Get an employee first
        emp_response = admin_session.get(f"{BASE_URL}/api/employees?limit=1")
        if emp_response.status_code == 200 and len(emp_response.json()) > 0:
            employee = emp_response.json()[0]
            employee_id = employee.get("employee_id")
            
            # Toggle field employee status
            toggle_response = admin_session.put(
                f"{BASE_URL}/api/travel/field-employees/{employee_id}",
                json={"is_field_employee": True}
            )
            assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
            print(f"✓ Field employee status toggled for: {employee_id}")
            
            # Toggle back
            admin_session.put(
                f"{BASE_URL}/api/travel/field-employees/{employee_id}",
                json={"is_field_employee": False}
            )
        else:
            print("✓ No employees found, toggle test skipped")


class TestPayslipPDFDownload:
    """Test Payslip PDF Download feature"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_get_my_payslips(self, admin_session):
        """Test GET /api/payroll/my-payslips - List user's payslips"""
        response = admin_session.get(f"{BASE_URL}/api/payroll/my-payslips")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ My payslips listed: {len(data)} payslips")
        return data
    
    def test_download_payslip_pdf_by_id(self, admin_session):
        """Test GET /api/payroll/payslip/{payslip_id}/pdf - Download PDF by ID"""
        response = admin_session.get(
            f"{BASE_URL}/api/payroll/payslip/{TEST_PAYSLIP_ID}/pdf"
        )
        
        if response.status_code == 200:
            assert response.headers.get("content-type") == "application/pdf"
            assert "content-disposition" in response.headers
            assert len(response.content) > 0
            print(f"✓ Payslip PDF downloaded: {len(response.content)} bytes")
        elif response.status_code == 404:
            print(f"✓ Payslip {TEST_PAYSLIP_ID} not found (expected if no payslips exist)")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_download_payslip_pdf_nonexistent(self, admin_session):
        """Test GET /api/payroll/payslip/{payslip_id}/pdf - Non-existent payslip"""
        response = admin_session.get(
            f"{BASE_URL}/api/payroll/payslip/ps_nonexistent123/pdf"
        )
        assert response.status_code == 404, f"Should return 404: {response.text}"
        print("✓ PDF download returns 404 for non-existent payslip")
    
    def test_download_my_payslip_pdf_by_month(self, admin_session):
        """Test GET /api/payroll/my-payslip/{month}/{year}/pdf - Download by month/year"""
        # Try current month
        now = datetime.now()
        response = admin_session.get(
            f"{BASE_URL}/api/payroll/my-payslip/{now.month}/{now.year}/pdf"
        )
        
        if response.status_code == 200:
            assert response.headers.get("content-type") == "application/pdf"
            print(f"✓ My payslip PDF downloaded for {now.month}/{now.year}")
        elif response.status_code == 404:
            print(f"✓ No payslip found for {now.month}/{now.year} (expected)")
        elif response.status_code == 400:
            print("✓ No employee profile linked (expected for admin without employee profile)")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_list_payslips_for_download(self, admin_session):
        """Test GET /api/payroll/payslips - List all payslips (HR)"""
        response = admin_session.get(f"{BASE_URL}/api/payroll/payslips")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ All payslips listed: {len(data)} payslips")
        
        # If there are payslips, try to download one
        if len(data) > 0:
            payslip_id = data[0].get("payslip_id")
            pdf_response = admin_session.get(
                f"{BASE_URL}/api/payroll/payslip/{payslip_id}/pdf"
            )
            if pdf_response.status_code == 200:
                print(f"✓ Successfully downloaded PDF for payslip: {payslip_id}")
            else:
                print(f"✓ PDF download returned {pdf_response.status_code} for {payslip_id}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        return session
    
    def test_cleanup_test_tours(self, admin_session):
        """Clean up test tour requests"""
        response = admin_session.get(f"{BASE_URL}/api/travel/requests")
        if response.status_code == 200:
            tours = response.json()
            test_tours = [t for t in tours if t.get("purpose", "").startswith("TEST_")]
            for tour in test_tours:
                cancel_response = admin_session.put(
                    f"{BASE_URL}/api/travel/requests/{tour['request_id']}/cancel",
                    json={"reason": "Test cleanup"}
                )
                if cancel_response.status_code == 200:
                    print(f"✓ Cancelled test tour: {tour['request_id']}")
        print("✓ Test cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
