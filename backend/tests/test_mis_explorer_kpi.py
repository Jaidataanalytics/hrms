"""
Test Suite for MIS Explorer & KPI Viewer Feature
Tests:
- GET /api/performance/mis-entries with employee_id and period filters
- GET /api/performance/mis-summary with employee_id and period
- GET /api/performance/kpi-scores with employee_id and period
- Period range function supporting daily, weekly, monthly, quarterly, half_yearly, annual
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMisExplorerKpi:
    """Test MIS Explorer & KPI Viewer APIs for Admin"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "password"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    # ========== MIS ENTRIES API TESTS ==========
    
    def test_mis_entries_endpoint_accessible(self):
        """Test GET /api/performance/mis-entries returns 200"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries")
        assert response.status_code == 200, f"MIS entries endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET /api/performance/mis-entries returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_employee_id(self):
        """Test GET /api/performance/mis-entries?employee_id={id} returns entries for specific employee"""
        # Test employee ID from context: EMP8C8264A1 (Amit Kumar)
        test_emp_id = "EMP8C8264A1"
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?employee_id={test_emp_id}")
        assert response.status_code == 200, f"MIS entries with employee_id failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        # All entries should belong to the requested employee
        for entry in data:
            assert entry.get("employee_id") == test_emp_id, f"Entry employee_id mismatch"
        print(f"PASS: GET mis-entries?employee_id={test_emp_id} returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_period_daily(self):
        """Test GET /api/performance/mis-entries?period=daily returns today's entries"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?period=daily")
        assert response.status_code == 200, f"MIS entries with daily period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        today = datetime.now().strftime("%Y-%m-%d")
        # All entries should be from today
        for entry in data:
            assert entry.get("date") == today, f"Entry date {entry.get('date')} is not today {today}"
        print(f"PASS: GET mis-entries?period=daily returns 200, got {len(data)} entries for today")
    
    def test_mis_entries_with_period_weekly(self):
        """Test GET /api/performance/mis-entries?period=weekly"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?period=weekly")
        assert response.status_code == 200, f"MIS entries with weekly period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET mis-entries?period=weekly returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_period_monthly(self):
        """Test GET /api/performance/mis-entries?period=monthly"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?period=monthly")
        assert response.status_code == 200, f"MIS entries with monthly period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET mis-entries?period=monthly returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_period_quarterly(self):
        """Test GET /api/performance/mis-entries?period=quarterly"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?period=quarterly")
        assert response.status_code == 200, f"MIS entries with quarterly period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET mis-entries?period=quarterly returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_period_half_yearly(self):
        """Test GET /api/performance/mis-entries?period=half_yearly"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?period=half_yearly")
        assert response.status_code == 200, f"MIS entries with half_yearly period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET mis-entries?period=half_yearly returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_period_annual(self):
        """Test GET /api/performance/mis-entries?period=annual"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?period=annual")
        assert response.status_code == 200, f"MIS entries with annual period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET mis-entries?period=annual returns 200, got {len(data)} entries")
    
    def test_mis_entries_with_employee_and_period(self):
        """Test GET /api/performance/mis-entries?employee_id={id}&period=monthly"""
        test_emp_id = "EMP7BEEC93A"  # Abritee Das Roy
        response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?employee_id={test_emp_id}&period=monthly")
        assert response.status_code == 200, f"MIS entries with emp+period failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of MIS entries"
        print(f"PASS: GET mis-entries?employee_id={test_emp_id}&period=monthly returns 200, got {len(data)} entries")

    # ========== MIS SUMMARY API TESTS ==========
    
    def test_mis_summary_endpoint_accessible(self):
        """Test GET /api/performance/mis-summary returns 200"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-summary")
        assert response.status_code == 200, f"MIS summary endpoint failed: {response.text}"
        data = response.json()
        assert "entry_count" in data, "Missing entry_count in response"
        assert "period" in data, "Missing period in response"
        assert "from_date" in data, "Missing from_date in response"
        assert "to_date" in data, "Missing to_date in response"
        print(f"PASS: GET /api/performance/mis-summary returns 200 with entry_count={data.get('entry_count')}")
    
    def test_mis_summary_with_employee_id(self):
        """Test GET /api/performance/mis-summary?employee_id={id}"""
        test_emp_id = "EMP8C8264A1"
        response = self.session.get(f"{BASE_URL}/api/performance/mis-summary?employee_id={test_emp_id}")
        assert response.status_code == 200, f"MIS summary with employee_id failed: {response.text}"
        data = response.json()
        assert "entry_count" in data, "Missing entry_count"
        assert "sums" in data, "Missing sums in response"
        assert "averages" in data, "Missing averages in response"
        print(f"PASS: GET mis-summary?employee_id={test_emp_id} returns 200, entry_count={data.get('entry_count')}")
    
    def test_mis_summary_with_daily_period(self):
        """Test GET /api/performance/mis-summary?period=daily returns today's date range"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-summary?period=daily")
        assert response.status_code == 200, f"MIS summary with daily period failed: {response.text}"
        data = response.json()
        today = datetime.now().strftime("%Y-%m-%d")
        # Daily period should have from_date = to_date = today
        assert data.get("from_date") == today, f"Expected from_date={today}, got {data.get('from_date')}"
        assert data.get("to_date") == today, f"Expected to_date={today}, got {data.get('to_date')}"
        print(f"PASS: GET mis-summary?period=daily returns from_date=to_date={today}")
    
    def test_mis_summary_with_monthly_period(self):
        """Test GET /api/performance/mis-summary?period=monthly"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-summary?period=monthly")
        assert response.status_code == 200, f"MIS summary with monthly period failed: {response.text}"
        data = response.json()
        assert data.get("period") == "monthly", f"Expected period=monthly, got {data.get('period')}"
        print(f"PASS: GET mis-summary?period=monthly returns 200, period={data.get('period')}")
    
    def test_mis_summary_with_employee_and_period(self):
        """Test GET /api/performance/mis-summary?employee_id={id}&period={period}"""
        test_emp_id = "EMP7BEEC93A"
        response = self.session.get(f"{BASE_URL}/api/performance/mis-summary?employee_id={test_emp_id}&period=quarterly")
        assert response.status_code == 200, f"MIS summary with emp+period failed: {response.text}"
        data = response.json()
        assert "entry_count" in data, "Missing entry_count"
        assert "from_date" in data, "Missing from_date"
        assert "to_date" in data, "Missing to_date"
        print(f"PASS: GET mis-summary?employee_id={test_emp_id}&period=quarterly returns 200")

    # ========== KPI SCORES API TESTS ==========
    
    def test_kpi_scores_endpoint_accessible(self):
        """Test GET /api/performance/kpi-scores returns 200"""
        response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores")
        assert response.status_code == 200, f"KPI scores endpoint failed: {response.text}"
        data = response.json()
        assert "scores" in data, "Missing scores in response"
        assert "weighted_score" in data, "Missing weighted_score in response"
        assert "period" in data, "Missing period in response"
        print(f"PASS: GET /api/performance/kpi-scores returns 200, weighted_score={data.get('weighted_score')}")
    
    def test_kpi_scores_with_employee_id(self):
        """Test GET /api/performance/kpi-scores?employee_id={id} for employee with 4 KPIs"""
        test_emp_id = "EMP8C8264A1"  # Amit Kumar - should have 4 KPIs
        response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores?employee_id={test_emp_id}")
        assert response.status_code == 200, f"KPI scores with employee_id failed: {response.text}"
        data = response.json()
        assert "scores" in data, "Missing scores"
        assert "weighted_score" in data, "Missing weighted_score"
        assert isinstance(data.get("scores"), list), "scores should be a list"
        print(f"PASS: GET kpi-scores?employee_id={test_emp_id} returns 200, {len(data.get('scores', []))} KPIs, weighted_score={data.get('weighted_score')}")
    
    def test_kpi_scores_with_period_monthly(self):
        """Test GET /api/performance/kpi-scores?period=monthly"""
        response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores?period=monthly")
        assert response.status_code == 200, f"KPI scores with monthly period failed: {response.text}"
        data = response.json()
        assert data.get("period") == "monthly", f"Expected period=monthly, got {data.get('period')}"
        print(f"PASS: GET kpi-scores?period=monthly returns 200")
    
    def test_kpi_scores_with_period_quarterly(self):
        """Test GET /api/performance/kpi-scores?period=quarterly"""
        response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores?period=quarterly")
        assert response.status_code == 200, f"KPI scores with quarterly period failed: {response.text}"
        data = response.json()
        assert data.get("period") == "quarterly", f"Expected period=quarterly"
        print(f"PASS: GET kpi-scores?period=quarterly returns 200")
    
    def test_kpi_scores_with_employee_and_period(self):
        """Test GET /api/performance/kpi-scores?employee_id={id}&period={period}"""
        test_emp_id = "EMP8C8264A1"
        response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores?employee_id={test_emp_id}&period=half_yearly")
        assert response.status_code == 200, f"KPI scores with emp+period failed: {response.text}"
        data = response.json()
        # Validate response structure
        assert "scores" in data, "Missing scores"
        assert "weighted_score" in data, "Missing weighted_score"
        assert "from_date" in data, "Missing from_date"
        assert "to_date" in data, "Missing to_date"
        assert "entry_count" in data, "Missing entry_count"
        print(f"PASS: GET kpi-scores?employee_id={test_emp_id}&period=half_yearly returns 200")
    
    def test_kpi_scores_response_structure(self):
        """Test KPI scores response has correct structure with score fields"""
        test_emp_id = "EMP8C8264A1"
        response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores?employee_id={test_emp_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Check each score has required fields
        for score in data.get("scores", []):
            assert "kpi_id" in score, "Missing kpi_id in score"
            assert "name" in score, "Missing name in score"
            assert "score_percentage" in score, "Missing score_percentage in score"
            assert "actual_value" in score, "Missing actual_value in score"
            assert "target_value" in score, "Missing target_value in score"
            assert "source" in score, "Missing source type in score"
            assert "calculation_type" in score, "Missing calculation_type in score"
        
        print(f"PASS: KPI scores response has correct structure for {len(data.get('scores', []))} KPIs")

    # ========== ADMIN-SPECIFIC TESTS ==========
    
    def test_admin_can_view_any_employee_mis_entries(self):
        """Test admin can view MIS entries for any employee (not just their own)"""
        # Test with multiple employee IDs
        test_emp_ids = ["EMP8C8264A1", "EMP7BEEC93A", "EMP31088E46"]
        
        for emp_id in test_emp_ids:
            response = self.session.get(f"{BASE_URL}/api/performance/mis-entries?employee_id={emp_id}")
            assert response.status_code == 200, f"Admin cannot view MIS entries for {emp_id}"
            print(f"  - Admin can view MIS entries for {emp_id}")
        
        print(f"PASS: Admin can view MIS entries for any employee")
    
    def test_admin_can_view_any_employee_kpi_scores(self):
        """Test admin can view KPI scores for any employee"""
        test_emp_ids = ["EMP8C8264A1", "EMP7BEEC93A"]
        
        for emp_id in test_emp_ids:
            response = self.session.get(f"{BASE_URL}/api/performance/kpi-scores?employee_id={emp_id}")
            assert response.status_code == 200, f"Admin cannot view KPI scores for {emp_id}"
            print(f"  - Admin can view KPI scores for {emp_id}")
        
        print(f"PASS: Admin can view KPI scores for any employee")

    # ========== EXISTING ADMIN TAB SECTIONS ==========
    
    def test_mis_compliance_endpoint(self):
        """Test GET /api/performance/mis-compliance (Admin tab - MIS Compliance section)"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-compliance")
        assert response.status_code == 200, f"MIS compliance endpoint failed: {response.text}"
        data = response.json()
        assert "date" in data, "Missing date"
        assert "filled" in data, "Missing filled count"
        assert "not_filled" in data, "Missing not_filled count"
        print(f"PASS: GET /api/performance/mis-compliance returns 200, filled={data.get('filled')}, not_filled={data.get('not_filled')}")
    
    def test_mis_templates_endpoint(self):
        """Test GET /api/performance/mis-templates (Admin tab - MIS Templates section)"""
        response = self.session.get(f"{BASE_URL}/api/performance/mis-templates")
        assert response.status_code == 200, f"MIS templates endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of templates"
        print(f"PASS: GET /api/performance/mis-templates returns 200, {len(data)} templates")
    
    def test_all_kpi_definitions_endpoint(self):
        """Test GET /api/performance/all-kpi-definitions (Admin tab - KPI Definitions section)"""
        response = self.session.get(f"{BASE_URL}/api/performance/all-kpi-definitions")
        assert response.status_code == 200, f"All KPI definitions endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of KPI definitions"
        print(f"PASS: GET /api/performance/all-kpi-definitions returns 200, {len(data)} KPIs")
    
    def test_all_kra_definitions_endpoint(self):
        """Test GET /api/performance/all-kra-definitions (Admin tab - KRA Definitions section)"""
        response = self.session.get(f"{BASE_URL}/api/performance/all-kra-definitions")
        assert response.status_code == 200, f"All KRA definitions endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of KRA definitions"
        print(f"PASS: GET /api/performance/all-kra-definitions returns 200, {len(data)} KRAs")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
