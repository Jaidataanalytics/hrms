"""
Test suite for Internal Meeting Management System
Tests: Meetings CRUD, Notes, Follow-ups, Analytics, Notifications
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sop-flow-parser.preview.emergentagent.com').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', '')


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.cookies.set('session_token', SESSION_TOKEN)
    s.headers.update({'Content-Type': 'application/json'})
    return s


@pytest.fixture(scope="module")
def auth_check(session):
    """Verify authentication works"""
    response = session.get(f"{BASE_URL}/api/auth/me")
    if response.status_code != 200:
        pytest.skip("Authentication failed - skipping tests")
    return response.json()


class TestMeetingsCRUD:
    """Test Meeting CRUD operations"""
    
    created_meeting_id = None
    
    def test_list_meetings(self, session, auth_check):
        """Test listing meetings"""
        response = session.get(f"{BASE_URL}/api/meetings/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} meetings")
    
    def test_create_meeting_success(self, session, auth_check):
        """Test creating a new meeting with all fields"""
        meeting_data = {
            "subject": "TEST_API_Meeting_" + datetime.now().strftime("%Y%m%d%H%M%S"),
            "meeting_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "start_time": "14:00",
            "end_time": "15:00",
            "location": "Conference Room Test",
            "participants": [],
            "agenda_items": [
                {"content": "Test agenda item 1", "status": "pending"},
                {"content": "Test agenda item 2", "status": "pending"}
            ]
        }
        
        response = session.post(f"{BASE_URL}/api/meetings/create", json=meeting_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "meeting_id" in data
        assert data["subject"] == meeting_data["subject"]
        assert data["meeting_date"] == meeting_data["meeting_date"]
        assert data["start_time"] == meeting_data["start_time"]
        assert data["location"] == meeting_data["location"]
        assert data["status"] == "scheduled"
        assert len(data["agenda_items"]) == 2
        
        TestMeetingsCRUD.created_meeting_id = data["meeting_id"]
        print(f"Created meeting: {data['meeting_id']}")
    
    def test_create_meeting_validation_subject(self, session, auth_check):
        """Test meeting creation fails without subject"""
        response = session.post(f"{BASE_URL}/api/meetings/create", json={
            "meeting_date": "2026-01-20",
            "start_time": "10:00"
        })
        assert response.status_code == 400
        assert "Subject" in response.json().get("detail", "")
    
    def test_create_meeting_validation_date(self, session, auth_check):
        """Test meeting creation fails without date"""
        response = session.post(f"{BASE_URL}/api/meetings/create", json={
            "subject": "Test Meeting",
            "start_time": "10:00"
        })
        assert response.status_code == 400
        assert "date" in response.json().get("detail", "").lower()
    
    def test_create_meeting_validation_time(self, session, auth_check):
        """Test meeting creation fails without start time"""
        response = session.post(f"{BASE_URL}/api/meetings/create", json={
            "subject": "Test Meeting",
            "meeting_date": "2026-01-20"
        })
        assert response.status_code == 400
        assert "time" in response.json().get("detail", "").lower()
    
    def test_get_meeting_details(self, session, auth_check):
        """Test getting meeting details"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        response = session.get(f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["meeting_id"] == TestMeetingsCRUD.created_meeting_id
        assert "activities" in data  # Should include activity log
        assert "participant_details" in data
        print(f"Meeting details retrieved: {data['subject']}")
    
    def test_get_meeting_not_found(self, session, auth_check):
        """Test getting non-existent meeting"""
        response = session.get(f"{BASE_URL}/api/meetings/mtg_nonexistent123")
        assert response.status_code == 404
    
    def test_update_meeting(self, session, auth_check):
        """Test updating meeting details"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        update_data = {
            "subject": "TEST_Updated_Meeting_Subject",
            "location": "Updated Conference Room"
        }
        
        response = session.put(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["subject"] == update_data["subject"]
        assert data["location"] == update_data["location"]
        print("Meeting updated successfully")


class TestMeetingNotes:
    """Test Discussion Notes functionality"""
    
    created_note_id = None
    
    def test_add_discussion_note(self, session, auth_check):
        """Test adding a discussion note to meeting"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        note_data = {"content": "TEST_Discussion note content for testing"}
        
        response = session.post(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/notes",
            json=note_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "note_id" in data
        assert data["content"] == note_data["content"]
        assert "added_by_name" in data
        assert "timestamp" in data
        
        TestMeetingNotes.created_note_id = data["note_id"]
        print(f"Note added: {data['note_id']}")
    
    def test_add_note_validation(self, session, auth_check):
        """Test note creation fails without content"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        response = session.post(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/notes",
            json={"content": ""}
        )
        assert response.status_code == 400
    
    def test_update_discussion_note(self, session, auth_check):
        """Test editing a discussion note"""
        if not TestMeetingsCRUD.created_meeting_id or not TestMeetingNotes.created_note_id:
            pytest.skip("No meeting or note created")
        
        update_data = {"content": "TEST_Updated discussion note content"}
        
        response = session.put(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/notes/{TestMeetingNotes.created_note_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["content"] == update_data["content"]
        assert "edited_at" in data
        assert "edit_history" in data
        print("Note updated with edit tracking")
    
    def test_delete_discussion_note(self, session, auth_check):
        """Test deleting a discussion note"""
        if not TestMeetingsCRUD.created_meeting_id or not TestMeetingNotes.created_note_id:
            pytest.skip("No meeting or note created")
        
        response = session.delete(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/notes/{TestMeetingNotes.created_note_id}"
        )
        assert response.status_code == 200
        print("Note deleted successfully")


class TestFollowUpPoints:
    """Test Follow-up Points functionality"""
    
    created_followup_id = None
    
    def test_add_followup_point(self, session, auth_check):
        """Test adding a follow-up point"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        followup_data = {
            "content": "TEST_Follow-up action item",
            "assigned_to": auth_check.get("employee_id", "")
        }
        
        response = session.post(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/followups",
            json=followup_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "followup_id" in data
        assert data["content"] == followup_data["content"]
        assert data["status"] == "pending"
        assert "added_by_name" in data
        
        TestFollowUpPoints.created_followup_id = data["followup_id"]
        print(f"Follow-up added: {data['followup_id']}")
    
    def test_toggle_followup_to_completed(self, session, auth_check):
        """Test marking follow-up as completed"""
        if not TestMeetingsCRUD.created_meeting_id or not TestFollowUpPoints.created_followup_id:
            pytest.skip("No meeting or follow-up created")
        
        response = session.put(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/followups/{TestFollowUpPoints.created_followup_id}",
            json={"status": "completed"}
        )
        assert response.status_code == 200
        print("Follow-up marked as completed")
    
    def test_toggle_followup_to_pending(self, session, auth_check):
        """Test marking follow-up back to pending"""
        if not TestMeetingsCRUD.created_meeting_id or not TestFollowUpPoints.created_followup_id:
            pytest.skip("No meeting or follow-up created")
        
        response = session.put(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/followups/{TestFollowUpPoints.created_followup_id}",
            json={"status": "pending"}
        )
        assert response.status_code == 200
        print("Follow-up marked as pending")


class TestScheduleFollowUp:
    """Test Schedule Follow-up Meeting functionality"""
    
    followup_meeting_id = None
    
    def test_schedule_followup_meeting(self, session, auth_check):
        """Test scheduling a follow-up meeting"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        followup_data = {
            "meeting_date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "start_time": "15:00",
            "end_time": "16:00",
            "location": "Follow-up Room"
        }
        
        response = session.post(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/schedule-followup",
            json=followup_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "meeting_id" in data
        assert data["previous_meeting_id"] == TestMeetingsCRUD.created_meeting_id
        assert "Follow-up" in data["subject"]
        # Follow-up points should become agenda items
        assert "agenda_items" in data
        
        TestScheduleFollowUp.followup_meeting_id = data["meeting_id"]
        print(f"Follow-up meeting scheduled: {data['meeting_id']}")
    
    def test_schedule_followup_validation(self, session, auth_check):
        """Test follow-up scheduling fails without required fields"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        response = session.post(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/schedule-followup",
            json={"location": "Room"}
        )
        assert response.status_code == 400
    
    def test_get_meeting_series(self, session, auth_check):
        """Test getting meeting series (chain)"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting created")
        
        response = session.get(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/series"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        print(f"Meeting series has {len(data)} meetings")


class TestMeetingAnalytics:
    """Test Meeting Analytics (HR/Admin only)"""
    
    def test_analytics_overview(self, session, auth_check):
        """Test getting meeting analytics overview"""
        response = session.get(f"{BASE_URL}/api/meetings/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "date_range" in data
        assert "overview" in data
        assert "total_meetings" in data["overview"]
        assert "followup_completion_rate" in data["overview"]
        assert "avg_days_between_followup_meetings" in data["overview"]
        assert "day_frequency" in data
        assert "weekly_trend" in data
        assert "top_organizers" in data
        assert "top_attendees" in data
        print(f"Analytics: {data['overview']['total_meetings']} total meetings")
    
    def test_employee_meeting_stats(self, session, auth_check):
        """Test getting employee-specific meeting stats"""
        employee_id = auth_check.get("employee_id")
        if not employee_id:
            pytest.skip("No employee_id in auth")
        
        response = session.get(f"{BASE_URL}/api/meetings/analytics/employee/{employee_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["employee_id"] == employee_id
        assert "total_meetings" in data
        assert "organized" in data
        assert "attended" in data
        assert "followup_completion_rate" in data
        print(f"Employee stats: {data['total_meetings']} meetings")


class TestNotifications:
    """Test Notification Bell functionality"""
    
    def test_list_notifications(self, session, auth_check):
        """Test listing notifications"""
        response = session.get(f"{BASE_URL}/api/notifications/list")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} notifications")
    
    def test_unread_count(self, session, auth_check):
        """Test getting unread notification count"""
        response = session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"Unread count: {data['count']}")
    
    def test_mark_all_read(self, session, auth_check):
        """Test marking all notifications as read"""
        response = session.put(f"{BASE_URL}/api/notifications/mark-all-read")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print("All notifications marked as read")
    
    def test_clear_all_notifications(self, session, auth_check):
        """Test clearing all notifications"""
        response = session.delete(f"{BASE_URL}/api/notifications/clear-all")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print("All notifications cleared")


class TestMeetingCancellation:
    """Test Meeting Cancellation"""
    
    def test_cancel_meeting(self, session, auth_check):
        """Test cancelling a meeting"""
        if not TestScheduleFollowUp.followup_meeting_id:
            pytest.skip("No follow-up meeting to cancel")
        
        response = session.delete(
            f"{BASE_URL}/api/meetings/{TestScheduleFollowUp.followup_meeting_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print("Follow-up meeting cancelled")
    
    def test_cancel_original_meeting(self, session, auth_check):
        """Test cancelling the original test meeting"""
        if not TestMeetingsCRUD.created_meeting_id:
            pytest.skip("No meeting to cancel")
        
        response = session.delete(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}"
        )
        assert response.status_code == 200
        print("Original test meeting cancelled")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
