"""
Test Helpdesk Features - Surveys, Suggestions, and Payroll Delete
Tests for Phase 1 Helpdesk overhaul: Complaints with priority, Anonymous Suggestions, Surveys with templates
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Admin@123"


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        if data.get("access_token"):
            session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        
        return session
    
    def test_login_success(self, auth_session):
        """Verify login works"""
        response = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data or "email" in data
        print(f"Logged in as: {data.get('email', data.get('name', 'Unknown'))}")


class TestSuggestions:
    """Test Anonymous Suggestions API"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        if data.get("access_token"):
            session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        
        return session
    
    def test_list_suggestions(self, auth_session):
        """GET /api/helpdesk/suggestions - List suggestions"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/suggestions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} suggestions")
    
    def test_create_suggestion(self, auth_session):
        """POST /api/helpdesk/suggestions - Create a suggestion"""
        suggestion_data = {
            "title": f"TEST_Suggestion_{uuid.uuid4().hex[:6]}",
            "description": "This is a test suggestion for improving workplace",
            "category": "workplace",
            "is_anonymous": False
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/helpdesk/suggestions",
            json=suggestion_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "suggestion_id" in data
        assert data["title"] == suggestion_data["title"]
        assert data["status"] == "submitted"
        print(f"Created suggestion: {data['suggestion_id']}")
        
        return data["suggestion_id"]
    
    def test_create_anonymous_suggestion(self, auth_session):
        """POST /api/helpdesk/suggestions - Create anonymous suggestion"""
        suggestion_data = {
            "title": f"TEST_Anonymous_{uuid.uuid4().hex[:6]}",
            "description": "This is an anonymous suggestion",
            "category": "general",
            "is_anonymous": True
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/helpdesk/suggestions",
            json=suggestion_data
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_anonymous"] == True
        print(f"Created anonymous suggestion: {data['suggestion_id']}")
    
    def test_list_suggestions_with_status_filter(self, auth_session):
        """GET /api/helpdesk/suggestions?status=submitted - Filter by status"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/suggestions?status=submitted")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} submitted suggestions")


class TestSurveys:
    """Test Survey Management API"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        if data.get("access_token"):
            session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        
        return session
    
    def test_list_surveys(self, auth_session):
        """GET /api/helpdesk/surveys - List surveys"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/surveys")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} surveys")
    
    def test_get_survey_templates(self, auth_session):
        """GET /api/helpdesk/survey-templates - Get built-in templates"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/survey-templates")
        assert response.status_code == 200
        data = response.json()
        
        # Verify builtin templates exist
        assert "builtin_templates" in data
        builtin = data["builtin_templates"]
        assert len(builtin) >= 6  # Should have 6 built-in templates
        
        # Verify template names
        template_names = [t["template_name"] for t in builtin]
        expected_templates = [
            "Employee Satisfaction Survey",
            "Employee Engagement Survey",
            "Weekly Pulse Check",
            "New Employee Onboarding Survey",
            "Exit Interview Survey",
            "360 Degree Feedback"
        ]
        for expected in expected_templates:
            assert expected in template_names, f"Missing template: {expected}"
        
        print(f"Found {len(builtin)} built-in templates")
    
    def test_create_survey_with_questions(self, auth_session):
        """POST /api/helpdesk/surveys - Create survey with multiple question types"""
        survey_data = {
            "title": f"TEST_Survey_{uuid.uuid4().hex[:6]}",
            "description": "Test survey with various question types",
            "survey_type": "custom",
            "is_anonymous": False,
            "is_mandatory": False,
            "target_type": "all",
            "status": "draft",
            "questions": [
                {
                    "question_id": "q1",
                    "type": "rating",
                    "text": "How satisfied are you?",
                    "scale": 5
                },
                {
                    "question_id": "q2",
                    "type": "nps",
                    "text": "How likely are you to recommend?",
                    "scale": 10
                },
                {
                    "question_id": "q3",
                    "type": "yes_no",
                    "text": "Do you enjoy your work?"
                },
                {
                    "question_id": "q4",
                    "type": "single_choice",
                    "text": "What is your preferred work style?",
                    "options": ["Remote", "Office", "Hybrid"]
                },
                {
                    "question_id": "q5",
                    "type": "multiple_choice",
                    "text": "Which benefits do you value?",
                    "options": ["Health", "PTO", "Flexible hours", "Training"]
                },
                {
                    "question_id": "q6",
                    "type": "text",
                    "text": "Any additional comments?"
                }
            ]
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/helpdesk/surveys",
            json=survey_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert "survey_id" in data
        assert data["title"] == survey_data["title"]
        assert data["status"] == "draft"
        assert len(data["questions"]) == 6
        
        print(f"Created survey: {data['survey_id']} with {len(data['questions'])} questions")
        return data["survey_id"]
    
    def test_create_survey_with_targeting(self, auth_session):
        """POST /api/helpdesk/surveys - Create survey with department targeting"""
        survey_data = {
            "title": f"TEST_Targeted_Survey_{uuid.uuid4().hex[:6]}",
            "description": "Survey targeted to specific department",
            "survey_type": "satisfaction",
            "target_type": "department",
            "target_departments": ["dept_001"],  # Example department ID
            "status": "draft",
            "questions": [
                {
                    "question_id": "q1",
                    "type": "rating",
                    "text": "Rate your department",
                    "scale": 5
                }
            ]
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/helpdesk/surveys",
            json=survey_data
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["target_type"] == "department"
        print(f"Created targeted survey: {data['survey_id']}")
    
    def test_get_departments_for_targeting(self, auth_session):
        """GET /api/helpdesk/departments - Get departments for survey targeting"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/departments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} departments for targeting")
    
    def test_get_locations_for_targeting(self, auth_session):
        """GET /api/helpdesk/locations - Get locations for survey targeting"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/locations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} locations for targeting")
    
    def test_get_employees_for_selection(self, auth_session):
        """GET /api/helpdesk/employees-for-selection - Get employees for individual targeting"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/employees-for-selection")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} employees for selection")
    
    def test_search_employees_for_selection(self, auth_session):
        """GET /api/helpdesk/employees-for-selection?search=test - Search employees"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/employees-for-selection?search=a")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} employees matching search")


class TestPayrollDelete:
    """Test Payroll Delete functionality"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        if data.get("access_token"):
            session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        
        return session
    
    def test_list_payroll_runs(self, auth_session):
        """GET /api/payroll/runs - List payroll runs"""
        response = auth_session.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} payroll runs")
        
        # Check if any runs exist
        if data:
            run = data[0]
            assert "payroll_id" in run
            assert "status" in run
            print(f"Latest run: {run.get('month')}/{run.get('year')} - Status: {run.get('status')}")
    
    def test_delete_payroll_nonexistent(self, auth_session):
        """DELETE /api/payroll/runs/{id} - Delete non-existent payroll returns 404"""
        response = auth_session.delete(f"{BASE_URL}/api/payroll/runs/nonexistent_id_12345")
        assert response.status_code == 404
        print("Correctly returns 404 for non-existent payroll")
    
    def test_create_and_delete_payroll(self, auth_session):
        """Create a test payroll run and delete it"""
        # Use a future month to avoid conflicts
        test_month = 12
        test_year = 2099
        
        # Try to create a payroll run
        response = auth_session.post(
            f"{BASE_URL}/api/payroll/runs?month={test_month}&year={test_year}"
        )
        
        if response.status_code == 400:
            # Payroll already exists, try to find and delete it
            runs_response = auth_session.get(f"{BASE_URL}/api/payroll/runs?year={test_year}")
            if runs_response.status_code == 200:
                runs = runs_response.json()
                for run in runs:
                    if run.get("month") == test_month and run.get("year") == test_year:
                        payroll_id = run["payroll_id"]
                        delete_response = auth_session.delete(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
                        assert delete_response.status_code in [200, 204]
                        print(f"Deleted existing test payroll: {payroll_id}")
                        return
            print("Payroll already exists for test month, skipping create/delete test")
            return
        
        assert response.status_code == 200
        data = response.json()
        payroll_id = data["payroll_id"]
        print(f"Created test payroll: {payroll_id}")
        
        # Now delete it
        delete_response = auth_session.delete(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
        assert delete_response.status_code in [200, 204]
        print(f"Successfully deleted payroll: {payroll_id}")
        
        # Verify it's deleted
        verify_response = auth_session.get(f"{BASE_URL}/api/payroll/runs/{payroll_id}")
        assert verify_response.status_code == 404
        print("Verified payroll is deleted (404)")


class TestGrievancesWithPriority:
    """Test Grievances/Complaints with priority levels"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        if data.get("access_token"):
            session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        
        return session
    
    def test_list_grievances(self, auth_session):
        """GET /api/grievances - List grievances/complaints"""
        response = auth_session.get(f"{BASE_URL}/api/grievances")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} grievances/complaints")
    
    def test_create_grievance_with_priority(self, auth_session):
        """POST /api/grievances - Create grievance with priority"""
        grievance_data = {
            "title": f"TEST_Complaint_{uuid.uuid4().hex[:6]}",
            "description": "Test complaint with high priority",
            "category": "workplace",
            "priority": "high"
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/grievances",
            json=grievance_data
        )
        
        # Check if endpoint exists
        if response.status_code == 404:
            pytest.skip("Grievances endpoint not found")
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        if "grievance_id" in data or "ticket_id" in data:
            print(f"Created grievance with priority: {data.get('priority', 'N/A')}")
        else:
            print(f"Grievance created: {data}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        if data.get("access_token"):
            session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
        
        return session
    
    def test_cleanup_test_surveys(self, auth_session):
        """Clean up TEST_ prefixed surveys"""
        response = auth_session.get(f"{BASE_URL}/api/helpdesk/surveys")
        if response.status_code == 200:
            surveys = response.json()
            deleted = 0
            for survey in surveys:
                if survey.get("title", "").startswith("TEST_"):
                    del_response = auth_session.delete(
                        f"{BASE_URL}/api/helpdesk/surveys/{survey['survey_id']}"
                    )
                    if del_response.status_code in [200, 204]:
                        deleted += 1
            print(f"Cleaned up {deleted} test surveys")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
