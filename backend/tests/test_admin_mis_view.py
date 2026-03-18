"""
Test MIS Templates View with filters + MIS/KPI Dialog APIs
Tests for Admin tab features: search filter, department filter, View MIS & KPI button
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API_BASE = f"{BASE_URL}/api/performance"


@pytest.fixture(scope="module")
def auth_token():
    """Admin login and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@shardahr.com",
        "password": "password"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


class TestMISTemplatesAPI:
    """Test MIS Templates listing for AdminTab filters"""
    
    def test_list_all_templates(self, auth_headers):
        """GET /api/performance/mis-templates returns all templates"""
        response = requests.get(f"{API_BASE}/mis-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 37, f"Expected at least 37 templates, got {len(data)}"
        
    def test_templates_have_required_fields(self, auth_headers):
        """Templates have employee_name, department_name, fields for filtering"""
        response = requests.get(f"{API_BASE}/mis-templates", headers=auth_headers)
        templates = response.json()
        # Get a template with employee_id
        emp_templates = [t for t in templates if t.get("employee_id")]
        assert len(emp_templates) >= 1, "Should have at least one employee-specific template"
        
        sample = emp_templates[0]
        assert "employee_name" in sample, "Template should have employee_name"
        assert "department_name" in sample, "Template should have department_name"
        assert "fields" in sample, "Template should have fields array"
        assert "template_id" in sample, "Template should have template_id"
        
    def test_templates_have_department_data(self, auth_headers):
        """Verify templates have department data for department filter"""
        response = requests.get(f"{API_BASE}/mis-templates", headers=auth_headers)
        templates = response.json()
        emp_templates = [t for t in templates if t.get("employee_id") and t.get("department_name")]
        
        # Should have templates with department_name set
        assert len(emp_templates) >= 10, "Should have multiple templates with department_name"
        
        # Get unique departments
        depts = set(t["department_name"] for t in emp_templates if t.get("department_name"))
        assert len(depts) >= 5, f"Expected at least 5 departments, got {len(depts)}: {depts}"


class TestMISEntriesAPI:
    """Test MIS Entries API with period filter"""
    
    # Test employee: EMP7BEEC93A (Abritee Das Roy - Marketing)
    TEST_EMP_ID = "EMP7BEEC93A"
    
    def test_mis_entries_daily_period(self, auth_headers):
        """GET /api/performance/mis-entries?period=daily returns today's entries"""
        response = requests.get(
            f"{API_BASE}/mis-entries?employee_id={self.TEST_EMP_ID}&period=daily", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_mis_entries_weekly_period(self, auth_headers):
        """GET /api/performance/mis-entries?period=weekly returns 200"""
        response = requests.get(
            f"{API_BASE}/mis-entries?employee_id={self.TEST_EMP_ID}&period=weekly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        
    def test_mis_entries_monthly_period(self, auth_headers):
        """GET /api/performance/mis-entries?period=monthly returns 200"""
        response = requests.get(
            f"{API_BASE}/mis-entries?employee_id={self.TEST_EMP_ID}&period=monthly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        
    def test_mis_entries_quarterly_period(self, auth_headers):
        """GET /api/performance/mis-entries?period=quarterly returns 200"""
        response = requests.get(
            f"{API_BASE}/mis-entries?employee_id={self.TEST_EMP_ID}&period=quarterly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        
    def test_mis_entries_half_yearly_period(self, auth_headers):
        """GET /api/performance/mis-entries?period=half_yearly returns 200"""
        response = requests.get(
            f"{API_BASE}/mis-entries?employee_id={self.TEST_EMP_ID}&period=half_yearly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        
    def test_mis_entries_annual_period(self, auth_headers):
        """GET /api/performance/mis-entries?period=annual returns 200"""
        response = requests.get(
            f"{API_BASE}/mis-entries?employee_id={self.TEST_EMP_ID}&period=annual", 
            headers=auth_headers
        )
        assert response.status_code == 200


class TestMISSummaryAPI:
    """Test MIS Summary API with period filter"""
    
    TEST_EMP_ID = "EMP7BEEC93A"
    
    def test_mis_summary_returns_correct_structure(self, auth_headers):
        """MIS summary has entry_count, from_date, to_date, sums, averages"""
        response = requests.get(
            f"{API_BASE}/mis-summary?employee_id={self.TEST_EMP_ID}&period=monthly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "entry_count" in data
        assert "from_date" in data
        assert "to_date" in data
        assert "sums" in data
        assert "averages" in data
        assert "period" in data
        
    def test_mis_summary_daily_period(self, auth_headers):
        """Daily period returns today's date as both from_date and to_date"""
        response = requests.get(
            f"{API_BASE}/mis-summary?employee_id={self.TEST_EMP_ID}&period=daily", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["from_date"] == data["to_date"], "Daily period should have same from_date and to_date"
        
    def test_mis_summary_quarterly_period(self, auth_headers):
        """Quarterly period returns correct date range"""
        response = requests.get(
            f"{API_BASE}/mis-summary?employee_id={self.TEST_EMP_ID}&period=quarterly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "quarterly"
        # Quarterly should start from Jan 1 for Q1
        assert data["from_date"].startswith("2026-01"), "Q1 should start from January"


class TestKPIScoresAPI:
    """Test KPI Scores API with period filter"""
    
    TEST_EMP_ID = "EMP7BEEC93A"
    
    def test_kpi_scores_returns_correct_structure(self, auth_headers):
        """KPI scores has scores array, weighted_score, period, from_date, to_date, entry_count"""
        response = requests.get(
            f"{API_BASE}/kpi-scores?employee_id={self.TEST_EMP_ID}&period=monthly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "scores" in data
        assert isinstance(data["scores"], list)
        assert "weighted_score" in data
        assert "period" in data
        assert "from_date" in data
        assert "to_date" in data
        assert "entry_count" in data
        
    def test_kpi_scores_score_item_structure(self, auth_headers):
        """Each KPI score has kpi_id, name, score_percentage, actual_value, target_value"""
        response = requests.get(
            f"{API_BASE}/kpi-scores?employee_id={self.TEST_EMP_ID}&period=monthly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["scores"]:
            score = data["scores"][0]
            assert "kpi_id" in score
            assert "name" in score
            assert "score_percentage" in score
            assert "actual_value" in score
            assert "target_value" in score
            
    def test_kpi_scores_daily_period(self, auth_headers):
        """KPI scores with daily period"""
        response = requests.get(
            f"{API_BASE}/kpi-scores?employee_id={self.TEST_EMP_ID}&period=daily", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "daily"
        
    def test_kpi_scores_half_yearly_period(self, auth_headers):
        """KPI scores with half_yearly period"""
        response = requests.get(
            f"{API_BASE}/kpi-scores?employee_id={self.TEST_EMP_ID}&period=half_yearly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "half_yearly"
        
    def test_kpi_scores_annual_period(self, auth_headers):
        """KPI scores with annual period"""
        response = requests.get(
            f"{API_BASE}/kpi-scores?employee_id={self.TEST_EMP_ID}&period=annual", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "annual"
        
    def test_employee_has_kpis(self, auth_headers):
        """Test employee EMP7BEEC93A has 7 KPIs defined"""
        response = requests.get(
            f"{API_BASE}/kpi-scores?employee_id={self.TEST_EMP_ID}&period=monthly", 
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["scores"]) >= 5, f"Expected at least 5 KPIs for test employee, got {len(data['scores'])}"


class TestMISComplianceAPI:
    """Test MIS Compliance API for AdminTab"""
    
    def test_mis_compliance_returns_200(self, auth_headers):
        """GET /api/performance/mis-compliance returns 200"""
        response = requests.get(f"{API_BASE}/mis-compliance", headers=auth_headers)
        assert response.status_code == 200
        
    def test_mis_compliance_structure(self, auth_headers):
        """MIS compliance has date, total_assigned, filled, not_filled counts"""
        response = requests.get(f"{API_BASE}/mis-compliance", headers=auth_headers)
        data = response.json()
        
        assert "date" in data
        assert "total_assigned" in data
        assert "filled" in data
        assert "not_filled" in data
        assert "filled_list" in data or "not_filled_list" in data


class TestAllDefinitionsAPIs:
    """Test All KPI/KRA definitions APIs for AdminTab"""
    
    def test_all_kpi_definitions(self, auth_headers):
        """GET /api/performance/all-kpi-definitions returns 200"""
        response = requests.get(f"{API_BASE}/all-kpi-definitions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5, "Should have at least 5 KPI definitions"
        
    def test_all_kra_definitions(self, auth_headers):
        """GET /api/performance/all-kra-definitions returns 200"""
        response = requests.get(f"{API_BASE}/all-kra-definitions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
