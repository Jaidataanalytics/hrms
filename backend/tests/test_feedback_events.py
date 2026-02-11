"""
Backend tests for 360-Degree Feedback and Events APIs
Tests: Feedback cycles CRUD, analytics, and Today's events for celebration banner
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFeedbackCyclesAPI:
    """360-Degree Feedback Cycle API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.auth_cookies = self.session.cookies.get_dict()
    
    def test_get_feedback_cycles_list(self):
        """GET /api/helpdesk/feedback-cycles - returns list of cycles"""
        resp = self.session.get(
            f"{BASE_URL}/api/helpdesk/feedback-cycles",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get feedback cycles: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} feedback cycles")
        
        # Verify existing Q1 2026 Peer Review cycle exists
        q1_cycle = next((c for c in data if "Q1 2026" in c.get("title", "")), None)
        if q1_cycle:
            print(f"Found existing cycle: {q1_cycle.get('title')} with status: {q1_cycle.get('status')}")
            assert "cycle_id" in q1_cycle
            assert "status" in q1_cycle
    
    def test_create_feedback_cycle(self):
        """POST /api/helpdesk/feedback-cycles - creates new cycle"""
        test_cycle = {
            "title": f"TEST Feedback Cycle {datetime.now().strftime('%H%M%S')}",
            "description": "Test cycle created by pytest",
            "start_date": "2026-01-15",
            "end_date": "2026-02-15",
            "allow_self_nomination": True,
            "anonymous": True,
            "min_reviewers": 3
        }
        resp = self.session.post(
            f"{BASE_URL}/api/helpdesk/feedback-cycles",
            json=test_cycle,
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to create cycle: {resp.text}"
        data = resp.json()
        assert "cycle_id" in data, "Response should have cycle_id"
        assert data["title"] == test_cycle["title"]
        assert data["status"] == "draft"
        print(f"Created cycle: {data['cycle_id']}")
        
        # Clean up - delete the test cycle
        self.session.delete(
            f"{BASE_URL}/api/helpdesk/feedback-cycles/{data['cycle_id']}",
            cookies=self.auth_cookies
        )
    
    def test_get_feedback_cycle_analytics(self):
        """GET /api/helpdesk/feedback-cycles/{cycle_id}/analytics - returns analytics"""
        # First get existing cycles
        cycles_resp = self.session.get(
            f"{BASE_URL}/api/helpdesk/feedback-cycles",
            cookies=self.auth_cookies
        )
        cycles = cycles_resp.json()
        
        if not cycles:
            pytest.skip("No feedback cycles exist to test analytics")
        
        cycle_id = cycles[0].get("cycle_id")
        resp = self.session.get(
            f"{BASE_URL}/api/helpdesk/feedback-cycles/{cycle_id}/analytics",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get analytics: {resp.text}"
        data = resp.json()
        
        # Verify analytics structure
        assert "cycle" in data, "Response should have cycle info"
        assert "summary" in data, "Response should have summary"
        assert "question_summaries" in data, "Response should have question_summaries"
        
        summary = data["summary"]
        assert "total_assignments" in summary
        assert "completed" in summary
        assert "completion_rate" in summary
        print(f"Analytics for {cycle_id}: {summary['total_assignments']} assignments, {summary['completion_rate']}% completion")


class TestEventsAPI:
    """Events/Celebrations API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.auth_cookies = self.session.cookies.get_dict()
    
    def test_get_today_events(self):
        """GET /api/events/today - returns today's celebrations"""
        resp = self.session.get(
            f"{BASE_URL}/api/events/today",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get today's events: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} events today")
        
        # If events exist, verify structure
        for event in data[:3]:
            print(f"  Event: {event.get('event_type')} for {event.get('employee_name', event.get('emp_code'))}")
            assert "event_id" in event or "emp_code" in event
            assert "event_type" in event
    
    def test_get_all_events(self):
        """GET /api/events - returns all employee events"""
        resp = self.session.get(
            f"{BASE_URL}/api/events",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get events: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} total events")
    
    def test_get_upcoming_events(self):
        """GET /api/events/upcoming - returns upcoming celebrations"""
        resp = self.session.get(
            f"{BASE_URL}/api/events/upcoming?days=30",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get upcoming events: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} upcoming events in next 30 days")


class TestSurveyAnalyticsAPI:
    """Survey Analytics API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.auth_cookies = self.session.cookies.get_dict()
    
    def test_get_surveys_list(self):
        """GET /api/helpdesk/surveys - returns list of surveys"""
        resp = self.session.get(
            f"{BASE_URL}/api/helpdesk/surveys",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get surveys: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} surveys")
    
    def test_get_survey_analytics_detailed(self):
        """GET /api/helpdesk/surveys/{survey_id}/analytics/detailed - returns detailed analytics"""
        # First get existing surveys
        surveys_resp = self.session.get(
            f"{BASE_URL}/api/helpdesk/surveys",
            cookies=self.auth_cookies
        )
        surveys = surveys_resp.json()
        
        if not surveys:
            pytest.skip("No surveys exist to test analytics")
        
        survey_id = surveys[0].get("survey_id")
        resp = self.session.get(
            f"{BASE_URL}/api/helpdesk/surveys/{survey_id}/analytics/detailed",
            cookies=self.auth_cookies
        )
        assert resp.status_code == 200, f"Failed to get detailed analytics: {resp.text}"
        data = resp.json()
        
        # Verify analytics structure
        assert "survey" in data, "Response should have survey info"
        assert "summary" in data, "Response should have summary"
        assert "question_analytics" in data, "Response should have question_analytics"
        print(f"Survey analytics for {survey_id}: {data['summary']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
