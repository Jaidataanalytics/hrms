"""
Test suite for Employee Events & Celebrations API
Tests all Events API endpoints: CRUD, today/upcoming, template download

Test Coverage:
- POST /api/events - Create event
- GET /api/events - List all events
- GET /api/events/today - Get today's events (MM-DD matching)
- GET /api/events/upcoming - Get upcoming events (next 30 days)
- DELETE /api/events/{event_id} - Delete event
- GET /api/events/template - Download Excel template
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://feedback-360.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Admin@123"


class TestEventsAPI:
    """Test suite for Events API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth cookies"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth cookies
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        # Store token for header-based auth too
        login_data = login_response.json()
        self.access_token = login_data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
        
        yield
        
        # Cleanup - will be done in individual tests
    
    def test_01_list_events(self):
        """Test GET /api/events - List all events"""
        response = self.session.get(f"{BASE_URL}/api/events")
        
        assert response.status_code == 200, f"Failed to list events: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} events")
    
    def test_02_create_birthday_event(self):
        """Test POST /api/events - Create a birthday event"""
        # First get an employee to create event for
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available for testing")
        
        employee = emp_response.json()[0]
        emp_code = employee.get("employee_id")
        
        # Create birthday event for today (for testing today endpoint)
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "emp_code": emp_code,
            "event_type": "birthday",
            "event_date": today,
            "label": "TEST Birthday Event"
        }
        
        response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        
        data = response.json()
        assert "event_id" in data, "Response should contain event_id"
        assert data.get("event_type") == "birthday", "Event type should be birthday"
        
        # Store event_id for cleanup
        self.test_event_id = data.get("event_id")
        print(f"✓ Created birthday event: {self.test_event_id}")
        
        # Cleanup - delete test event
        self.session.delete(f"{BASE_URL}/api/events/{self.test_event_id}")
    
    def test_03_create_work_anniversary_event(self):
        """Test POST /api/events - Create work anniversary event"""
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available for testing")
        
        employee = emp_response.json()[0]
        emp_code = employee.get("employee_id")
        
        # Create work anniversary event
        payload = {
            "emp_code": emp_code,
            "event_type": "work_anniversary",
            "event_date": "2020-02-11",  # Joined date
            "label": "TEST Joined as Engineer"
        }
        
        response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        
        data = response.json()
        assert data.get("event_type") == "work_anniversary"
        
        # Cleanup
        event_id = data.get("event_id")
        self.session.delete(f"{BASE_URL}/api/events/{event_id}")
        print(f"✓ Created and cleaned up work anniversary event")
    
    def test_04_create_event_validation(self):
        """Test POST /api/events - Validation errors"""
        # Missing required fields
        response = self.session.post(f"{BASE_URL}/api/events", json={})
        
        assert response.status_code == 400, f"Should return 400 for missing fields: {response.text}"
        print("✓ Validation works - missing fields rejected")
        
        # Invalid event type
        response = self.session.post(f"{BASE_URL}/api/events", json={
            "emp_code": "TEST_EMP",
            "event_type": "invalid_type",
            "event_date": "2026-02-11"
        })
        
        assert response.status_code == 400, f"Should return 400 for invalid event type: {response.text}"
        print("✓ Validation works - invalid event type rejected")
    
    def test_05_get_today_events(self):
        """Test GET /api/events/today - Get today's celebrations"""
        # First create an event for today
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available for testing")
        
        employee = emp_response.json()[0]
        emp_code = employee.get("employee_id")
        
        # Create event for today's MM-DD (events are matched by month-day for recurring)
        today = datetime.now()
        # Use a past year but today's month-day
        event_date = f"1990-{today.month:02d}-{today.day:02d}"
        
        payload = {
            "emp_code": emp_code,
            "event_type": "birthday",
            "event_date": event_date,
            "label": "TEST Today Birthday"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        assert create_response.status_code == 200, f"Failed to create event: {create_response.text}"
        
        event_id = create_response.json().get("event_id")
        
        # Now test the today endpoint
        response = self.session.get(f"{BASE_URL}/api/events/today")
        
        assert response.status_code == 200, f"Failed to get today's events: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if our event is in today's events
        our_event = next((e for e in data if e.get("event_id") == event_id), None)
        assert our_event is not None, "Created event should appear in today's events"
        print(f"✓ Today endpoint returned {len(data)} events, including our test event")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/events/{event_id}")
    
    def test_06_get_upcoming_events(self):
        """Test GET /api/events/upcoming - Get upcoming events"""
        # Create an event for 5 days from now
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available for testing")
        
        employee = emp_response.json()[0]
        emp_code = employee.get("employee_id")
        
        # Create event for 5 days from now (MM-DD will be matched)
        future_date = datetime.now() + timedelta(days=5)
        event_date = f"1990-{future_date.month:02d}-{future_date.day:02d}"
        
        payload = {
            "emp_code": emp_code,
            "event_type": "birthday",
            "event_date": event_date,
            "label": "TEST Upcoming Birthday"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        assert create_response.status_code == 200
        
        event_id = create_response.json().get("event_id")
        
        # Test upcoming endpoint with 30 day window
        response = self.session.get(f"{BASE_URL}/api/events/upcoming?days=30")
        
        assert response.status_code == 200, f"Failed to get upcoming events: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if upcoming events have days_until field
        for event in data:
            assert "days_until" in event, "Upcoming events should have days_until field"
        
        print(f"✓ Upcoming endpoint returned {len(data)} events")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/events/{event_id}")
    
    def test_07_delete_event(self):
        """Test DELETE /api/events/{event_id} - Delete event"""
        # First create an event
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available for testing")
        
        employee = emp_response.json()[0]
        
        payload = {
            "emp_code": employee.get("employee_id"),
            "event_type": "custom",
            "event_date": "2026-06-15",
            "label": "TEST Custom Event to Delete"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        assert create_response.status_code == 200
        
        event_id = create_response.json().get("event_id")
        
        # Delete the event
        response = self.session.delete(f"{BASE_URL}/api/events/{event_id}")
        
        assert response.status_code == 200, f"Failed to delete event: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"✓ Successfully deleted event: {event_id}")
        
        # Verify deletion - try to get the event (should not be in list)
        list_response = self.session.get(f"{BASE_URL}/api/events")
        events = list_response.json()
        deleted_event = next((e for e in events if e.get("event_id") == event_id), None)
        assert deleted_event is None, "Deleted event should not appear in list"
        print("✓ Verified event no longer in list after deletion")
    
    def test_08_delete_nonexistent_event(self):
        """Test DELETE /api/events/{event_id} - 404 for non-existent"""
        response = self.session.delete(f"{BASE_URL}/api/events/evt_nonexistent12345")
        
        assert response.status_code == 404, f"Should return 404 for non-existent event: {response.text}"
        print("✓ 404 returned for non-existent event deletion")
    
    def test_09_download_template(self):
        """Test GET /api/events/template - Download Excel template"""
        response = self.session.get(f"{BASE_URL}/api/events/template")
        
        assert response.status_code == 200, f"Failed to download template: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, \
            f"Response should be Excel file, got: {content_type}"
        
        # Check content disposition
        content_disposition = response.headers.get("content-disposition", "")
        assert "employee_events_template" in content_disposition, \
            f"Should contain filename in disposition: {content_disposition}"
        
        print("✓ Template download working correctly")
    
    def test_10_marriage_anniversary_event(self):
        """Test creating marriage anniversary event"""
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee = emp_response.json()[0]
        
        payload = {
            "emp_code": employee.get("employee_id"),
            "event_type": "marriage_anniversary",
            "event_date": "2018-11-20",
            "label": "TEST Marriage"
        }
        
        response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        
        assert response.status_code == 200, f"Failed to create marriage anniversary: {response.text}"
        
        data = response.json()
        assert data.get("event_type") == "marriage_anniversary"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/events/{data.get('event_id')}")
        print("✓ Marriage anniversary event creation works")
    
    def test_11_event_enrichment_with_employee_data(self):
        """Test that events are enriched with employee name and department"""
        emp_response = self.session.get(f"{BASE_URL}/api/employees?limit=1")
        
        if emp_response.status_code != 200 or len(emp_response.json()) == 0:
            pytest.skip("No employees available")
        
        employee = emp_response.json()[0]
        expected_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
        
        # Create event
        payload = {
            "emp_code": employee.get("employee_id"),
            "event_type": "birthday",
            "event_date": "1990-03-15",
            "label": "TEST Birthday"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/events", json=payload)
        assert create_response.status_code == 200
        
        event_id = create_response.json().get("event_id")
        
        # Get events and check enrichment
        list_response = self.session.get(f"{BASE_URL}/api/events")
        events = list_response.json()
        
        our_event = next((e for e in events if e.get("event_id") == event_id), None)
        assert our_event is not None, "Event should be in list"
        
        # Check enrichment fields
        if expected_name:
            assert "employee_name" in our_event, "Event should have employee_name"
            assert our_event.get("employee_name") == expected_name, "Employee name should match"
        
        print(f"✓ Event enriched with employee_name: {our_event.get('employee_name')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/events/{event_id}")


class TestCalendarTasksAPI:
    """Test suite for Calendar Tasks API - specifically testing the Add Task bug fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth cookies"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        login_data = login_response.json()
        self.access_token = login_data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
        
        yield
    
    def test_01_create_task_for_self(self):
        """Test POST /api/calendar/tasks - Create task for self (assigned_to empty)"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "title": "TEST Task for Self",
            "description": "Testing Add Task with self assignment",
            "due_date": today,
            "due_time": "10:00",
            "priority": "medium",
            "assigned_to": ""  # Empty = self (this was the bug - SelectItem value='')
        }
        
        response = self.session.post(f"{BASE_URL}/api/calendar/tasks", json=payload)
        
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        data = response.json()
        assert "task_id" in data, "Response should contain task_id"
        assert data.get("title") == "TEST Task for Self"
        
        task_id = data.get("task_id")
        print(f"✓ Created task for self: {task_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/calendar/tasks/{task_id}")
    
    def test_02_create_task_with_priority(self):
        """Test task creation with different priorities"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        for priority in ["low", "medium", "high"]:
            payload = {
                "title": f"TEST Task {priority.upper()} Priority",
                "due_date": today,
                "priority": priority
            }
            
            response = self.session.post(f"{BASE_URL}/api/calendar/tasks", json=payload)
            
            assert response.status_code == 200, f"Failed to create {priority} task: {response.text}"
            
            data = response.json()
            assert data.get("priority") == priority
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/calendar/tasks/{data.get('task_id')}")
        
        print("✓ All priority levels work correctly")
    
    def test_03_get_tasks_by_month(self):
        """Test GET /api/calendar/tasks - Get tasks for a month"""
        month_str = datetime.now().strftime("%Y-%m")
        
        response = self.session.get(f"{BASE_URL}/api/calendar/tasks?month={month_str}")
        
        assert response.status_code == 200, f"Failed to get tasks: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Got {len(data)} tasks for month {month_str}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
