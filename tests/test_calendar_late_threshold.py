"""
Test suite for Calendar View and Late Threshold features
- Late threshold changed to 10:00 AM
- Calendar tab in Attendance Analytics
- Calendar grid with present/late/absent counts
- Day details panel with employee breakdown
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Admin@123"


class TestLateThreshold:
    """Test late threshold is set to 10:00 AM"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_recalculate_late_endpoint_uses_10am_threshold(self):
        """Test that recalculate-late endpoint uses 10:00 AM threshold"""
        response = self.session.post(f"{BASE_URL}/api/biometric/sync/recalculate-late")
        assert response.status_code == 200, f"Recalculate late failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("late_threshold") == "10:00", f"Expected late_threshold '10:00', got '{data.get('late_threshold')}'"
        print(f"PASS: Recalculate late endpoint uses 10:00 AM threshold")
        print(f"  - Updated {data.get('updated', 0)} records")


class TestCalendarDataAPI:
    """Test GET /api/attendance/calendar-data endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_calendar_data_endpoint_exists(self):
        """Test that calendar-data endpoint exists and returns data"""
        # Use current month
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 200, f"Calendar data endpoint failed: {response.text}"
        print(f"PASS: Calendar data endpoint returns 200")
    
    def test_calendar_data_response_structure(self):
        """Test calendar data response has correct structure"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level fields
        assert "from_date" in data, "Missing from_date in response"
        assert "to_date" in data, "Missing to_date in response"
        assert "total_employees" in data, "Missing total_employees in response"
        assert "calendar_data" in data, "Missing calendar_data in response"
        
        print(f"PASS: Calendar data response has correct top-level structure")
        print(f"  - from_date: {data['from_date']}")
        print(f"  - to_date: {data['to_date']}")
        print(f"  - total_employees: {data['total_employees']}")
        print(f"  - calendar_data entries: {len(data['calendar_data'])}")
    
    def test_calendar_day_structure(self):
        """Test each day in calendar_data has correct structure"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 200
        
        data = response.json()
        calendar_data = data.get("calendar_data", [])
        
        assert len(calendar_data) > 0, "Calendar data is empty"
        
        # Check first day structure
        day = calendar_data[0]
        required_fields = [
            "date", "day_name", "is_sunday", "is_holiday", "holiday_name",
            "present_count", "late_count", "absent_count",
            "present_employees", "late_employees", "absent_employees"
        ]
        
        for field in required_fields:
            assert field in day, f"Missing field '{field}' in day data"
        
        print(f"PASS: Calendar day has all required fields")
        print(f"  - Sample day: {day['date']} ({day['day_name']})")
        print(f"  - is_sunday: {day['is_sunday']}, is_holiday: {day['is_holiday']}")
        print(f"  - present: {day['present_count']}, late: {day['late_count']}, absent: {day['absent_count']}")
    
    def test_calendar_data_employee_lists(self):
        """Test that employee lists contain correct data"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 200
        
        data = response.json()
        calendar_data = data.get("calendar_data", [])
        
        # Find a working day with data
        working_day = None
        for day in calendar_data:
            if not day["is_sunday"] and not day["is_holiday"]:
                if day["present_count"] > 0 or day["late_count"] > 0:
                    working_day = day
                    break
        
        if working_day:
            # Check present employees structure
            if working_day["present_employees"]:
                emp = working_day["present_employees"][0]
                assert "employee_id" in emp, "Missing employee_id in present employee"
                assert "name" in emp, "Missing name in present employee"
                assert "in_time" in emp, "Missing in_time in present employee"
                assert "out_time" in emp, "Missing out_time in present employee"
                print(f"PASS: Present employee has correct structure")
                print(f"  - Sample: {emp['name']} (in: {emp['in_time']}, out: {emp['out_time']})")
            
            # Check late employees structure
            if working_day["late_employees"]:
                emp = working_day["late_employees"][0]
                assert "employee_id" in emp, "Missing employee_id in late employee"
                assert "name" in emp, "Missing name in late employee"
                assert "in_time" in emp, "Missing in_time in late employee"
                print(f"PASS: Late employee has correct structure")
                print(f"  - Sample: {emp['name']} (in: {emp['in_time']})")
        else:
            print("INFO: No working day with attendance data found in current month")
    
    def test_calendar_data_sundays_marked(self):
        """Test that Sundays are correctly marked"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 200
        
        data = response.json()
        calendar_data = data.get("calendar_data", [])
        
        sundays = [d for d in calendar_data if d["is_sunday"]]
        
        # Verify Sundays have day_name = "Sunday"
        for sunday in sundays:
            assert sunday["day_name"] == "Sunday", f"Sunday {sunday['date']} has wrong day_name: {sunday['day_name']}"
            # Sundays should have 0 counts
            assert sunday["present_count"] == 0, f"Sunday {sunday['date']} has non-zero present count"
            assert sunday["late_count"] == 0, f"Sunday {sunday['date']} has non-zero late count"
            assert sunday["absent_count"] == 0, f"Sunday {sunday['date']} has non-zero absent count"
        
        print(f"PASS: {len(sundays)} Sundays correctly marked with zero counts")
    
    def test_calendar_data_requires_auth(self):
        """Test that calendar-data endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = no_auth_session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print(f"PASS: Calendar data endpoint requires authentication (401)")
    
    def test_calendar_data_hr_only(self):
        """Test that calendar-data endpoint is restricted to HR/Admin roles"""
        # Login as employee
        emp_session = requests.Session()
        response = emp_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employee@shardahr.com",
            "password": "Employee@123"
        })
        
        if response.status_code != 200:
            pytest.skip("Employee test user not available")
        
        token = response.json().get("access_token")
        emp_session.headers.update({"Authorization": f"Bearer {token}"})
        
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = emp_session.get(
            f"{BASE_URL}/api/attendance/calendar-data",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 403, f"Expected 403 for employee, got {response.status_code}"
        print(f"PASS: Calendar data endpoint restricted to HR/Admin (403 for employee)")


class TestAttendanceSummaryWithCalendar:
    """Test that attendance summary endpoint still works alongside calendar"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_attendance_summary_still_works(self):
        """Test that attendance summary endpoint still works"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        assert response.status_code == 200, f"Attendance summary failed: {response.text}"
        
        data = response.json()
        assert "overview" in data, "Missing overview in summary"
        print(f"PASS: Attendance summary endpoint still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
