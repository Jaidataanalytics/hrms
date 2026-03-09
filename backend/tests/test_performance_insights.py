"""
Test Performance Management Insights Tab - Backend API Tests
Tests: /api/performance/insights endpoint and related APIs for InsightsTab component
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@shardahr.com", "password": "password"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestInsightsEndpoint:
    """Tests for GET /api/performance/insights endpoint"""

    def test_insights_monthly_returns_correct_structure(self, auth_headers):
        """Verify insights endpoint returns correct JSON structure with monthly period"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check all required top-level keys
        expected_keys = ['period', 'date_range', 'summary', 'department_health', 
                        'compliance_heatmap', 'red_flags', 'executive_kra_tracker', 'employee_rankings']
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
        
        assert data['period'] == 'monthly'

    def test_insights_summary_structure(self, auth_headers):
        """Verify summary object has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        summary = response.json().get('summary', {})
        summary_keys = ['total_employees', 'total_kpis', 'auto_kpis', 'manual_kpis', 
                       'auto_pct', 'total_entries', 'total_departments']
        for key in summary_keys:
            assert key in summary, f"Summary missing key: {key}"
        
        # Verify data types
        assert isinstance(summary['total_employees'], int)
        assert isinstance(summary['total_kpis'], int)
        assert isinstance(summary['auto_pct'], (int, float))

    def test_insights_weekly_period(self, auth_headers):
        """Test insights with weekly period parameter"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=weekly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data['period'] == 'weekly'
        assert 'date_range' in data

    def test_insights_quarterly_period(self, auth_headers):
        """Test insights with quarterly period parameter"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=quarterly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data['period'] == 'quarterly'

    def test_insights_red_flags_structure(self, auth_headers):
        """Verify red flags array has correct structure when data exists"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        red_flags = response.json().get('red_flags', [])
        assert isinstance(red_flags, list)
        
        if len(red_flags) > 0:
            flag = red_flags[0]
            assert 'type' in flag
            assert 'severity' in flag
            assert 'employee_name' in flag
            assert 'message' in flag

    def test_insights_department_health_structure(self, auth_headers):
        """Verify department health has employees and stats"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        dept_health = response.json().get('department_health', [])
        assert isinstance(dept_health, list)
        
        if len(dept_health) > 0:
            dept = dept_health[0]
            assert 'name' in dept
            assert 'employees' in dept
            assert 'total_kpis' in dept
            assert 'total_entries' in dept

    def test_insights_employee_rankings_structure(self, auth_headers):
        """Verify employee rankings has correct columns"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        rankings = response.json().get('employee_rankings', [])
        assert isinstance(rankings, list)
        
        if len(rankings) > 0:
            emp = rankings[0]
            assert 'employee_id' in emp
            assert 'name' in emp
            assert 'department' in emp
            assert 'mis_entries' in emp
            assert 'kpi_count' in emp

    def test_insights_executive_kra_tracker(self, auth_headers):
        """Verify executive KRA tracker structure"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        tracker = response.json().get('executive_kra_tracker', [])
        assert isinstance(tracker, list)
        
        if len(tracker) > 0:
            exec_data = tracker[0]
            assert 'name' in exec_data
            assert 'kras' in exec_data
            assert isinstance(exec_data['kras'], list)

    def test_insights_compliance_heatmap_14_days(self, auth_headers):
        """Verify heatmap has 14 days of data"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        heatmap = response.json().get('compliance_heatmap', [])
        assert len(heatmap) == 14, f"Expected 14 days, got {len(heatmap)}"
        
        if len(heatmap) > 0:
            day_data = heatmap[0]
            assert 'date' in day_data
            assert 'employees' in day_data

    def test_insights_requires_auth(self):
        """Verify insights endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/performance/insights?period=monthly")
        assert response.status_code in [401, 403, 422]


class TestOtherPerformanceAPIs:
    """Tests for other performance APIs used by the Performance page"""

    def test_kpi_scores_returns_data(self, auth_headers):
        """GET /api/performance/kpi-scores returns scores structure"""
        response = requests.get(
            f"{BASE_URL}/api/performance/kpi-scores",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'scores' in data
        assert 'period' in data
        assert 'weighted_score' in data

    def test_kra_definitions_returns_data(self, auth_headers):
        """GET /api/performance/kra-definitions returns KRAs"""
        response = requests.get(
            f"{BASE_URL}/api/performance/kra-definitions",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Admin user should have KRAs assigned
        assert len(data) > 0, "Expected KRAs for admin user"

    def test_evaluations_returns_data(self, auth_headers):
        """GET /api/performance/evaluations returns evaluations list"""
        response = requests.get(
            f"{BASE_URL}/api/performance/evaluations",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_mis_templates_employee(self, auth_headers):
        """GET /api/performance/mis-templates/employee/{id} returns template or null"""
        response = requests.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/EMP001",
            headers=auth_headers
        )
        assert response.status_code == 200
        # EMP001 (admin) may not have a template, so null is acceptable
        data = response.json()
        # Can be null or a template object
        if data is not None:
            assert 'template_id' in data or 'fields' in data


class TestInsightsDataIntegrity:
    """Test data integrity and calculations in insights"""

    def test_auto_pct_calculation(self, auth_headers):
        """Verify auto_pct is calculated correctly"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        summary = response.json().get('summary', {})
        
        auto_kpis = summary.get('auto_kpis', 0)
        manual_kpis = summary.get('manual_kpis', 0)
        auto_pct = summary.get('auto_pct', 0)
        
        total = auto_kpis + manual_kpis
        if total > 0:
            expected_pct = round(auto_kpis * 100 / total)
            assert auto_pct == expected_pct, f"Expected {expected_pct}%, got {auto_pct}%"

    def test_date_range_monthly(self, auth_headers):
        """Verify date range is correct for monthly period"""
        response = requests.get(
            f"{BASE_URL}/api/performance/insights?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        date_range = response.json().get('date_range', {})
        
        assert 'start' in date_range
        assert 'end' in date_range
        # Monthly should start on day 1
        assert date_range['start'].endswith('-01'), "Monthly start should be first of month"
