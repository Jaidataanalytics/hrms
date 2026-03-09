"""
Performance Management System - Backend API Tests
Tests MIS Templates, MIS Entries, KPI/KRA Definitions, Evaluations, and Company Dashboard

Test Categories:
1. MIS Templates - CRUD operations for department-specific templates
2. MIS Entries - Daily MIS entry submission and retrieval
3. KPI Definitions - KPI CRUD with auto-calculation types
4. KRA Definitions - KRA assignment by employee/department/designation
5. Performance Evaluations - Create evaluations with multi-rater system
6. Company Dashboard - Admin-only dashboard with department summaries
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "password"
ACCOUNTS_USER_EMAIL = "accounts2@shardadiesels.co.in"  # Has department assignment
ACCOUNTS_USER_PASSWORD = "password"


class TestPerformanceSetup:
    """Setup tests - ensure authentication and seed data exist"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def accounts_user_token(self):
        """Login as accounts user (has department)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTS_USER_EMAIL,
            "password": ACCOUNTS_USER_PASSWORD
        })
        assert response.status_code == 200, f"Accounts user login failed: {response.text}"
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def accounts_headers(self, accounts_user_token):
        """Headers with accounts user auth"""
        return {"Authorization": f"Bearer {accounts_user_token}", "Content-Type": "application/json"}
    
    def test_admin_login_success(self, admin_token):
        """Verify admin login works"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"✓ Admin login successful, token: {admin_token[:20]}...")
    
    def test_accounts_user_login_success(self, accounts_user_token):
        """Verify accounts user login works"""
        assert accounts_user_token is not None
        print(f"✓ Accounts user login successful")


class TestMISTemplates:
    """Test MIS Template endpoints - GET and POST"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_mis_templates_returns_seeded_templates(self, admin_headers):
        """GET /api/performance/mis-templates returns 13 department templates"""
        response = requests.get(f"{BASE_URL}/api/performance/mis-templates", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Response should be a list"
        assert len(templates) >= 10, f"Expected at least 10 templates, got {len(templates)}"
        
        # Verify template structure
        if templates:
            template = templates[0]
            assert "template_id" in template, "Template should have template_id"
            assert "department_id" in template, "Template should have department_id"
            assert "department_name" in template, "Template should have department_name"
            assert "fields" in template, "Template should have fields array"
            assert isinstance(template["fields"], list), "Fields should be a list"
        
        print(f"✓ GET /api/performance/mis-templates returned {len(templates)} templates")
        
        # Verify field types in templates
        dept_names = [t.get("department_name", "") for t in templates]
        print(f"  Departments with templates: {', '.join(dept_names[:5])}...")
    
    def test_mis_template_has_correct_field_types(self, admin_headers):
        """Verify MIS templates have correct field types (number, boolean, text)"""
        response = requests.get(f"{BASE_URL}/api/performance/mis-templates", headers=admin_headers)
        templates = response.json()
        
        field_types_found = set()
        for template in templates:
            for field in template.get("fields", []):
                field_type = field.get("type")
                field_types_found.add(field_type)
                assert field_type in ["number", "boolean", "text"], f"Invalid field type: {field_type}"
                assert "key" in field, "Field should have key"
                assert "label" in field, "Field should have label"
        
        # Verify all three field types exist
        assert "number" in field_types_found, "Should have number fields"
        assert "boolean" in field_types_found, "Should have boolean fields"
        assert "text" in field_types_found, "Should have text fields"
        print(f"✓ MIS templates have correct field types: {field_types_found}")
    
    def test_filter_templates_by_department(self, admin_headers):
        """GET /api/performance/mis-templates?department_id filters by department"""
        # First get all templates to find a valid department_id
        all_response = requests.get(f"{BASE_URL}/api/performance/mis-templates", headers=admin_headers)
        templates = all_response.json()
        
        if templates:
            dept_id = templates[0]["department_id"]
            filtered_response = requests.get(
                f"{BASE_URL}/api/performance/mis-templates?department_id={dept_id}",
                headers=admin_headers
            )
            assert filtered_response.status_code == 200
            filtered = filtered_response.json()
            assert all(t["department_id"] == dept_id for t in filtered)
            print(f"✓ Templates filtered by department_id={dept_id}")


class TestMISEntries:
    """Test MIS Entry endpoints - POST and GET with filtering"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def accounts_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTS_USER_EMAIL, "password": ACCOUNTS_USER_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def accounts_headers(self, accounts_token):
        return {"Authorization": f"Bearer {accounts_token}", "Content-Type": "application/json"}
    
    def test_create_mis_entry_with_fields(self, accounts_headers):
        """POST /api/performance/mis-entries saves daily MIS entry with fields"""
        # First get template for Accounts department
        templates_response = requests.get(
            f"{BASE_URL}/api/performance/mis-templates",
            headers=accounts_headers
        )
        templates = templates_response.json()
        accounts_template = next((t for t in templates if "Account" in t.get("department_name", "")), None)
        
        if not accounts_template:
            pytest.skip("No Accounts template found")
        
        test_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        entry_data = {
            "template_id": accounts_template["template_id"],
            "department_id": accounts_template["department_id"],
            "date": test_date,
            "fields": {
                "payments_processed": 25,
                "payment_value": 150000,
                "receipts_recorded": 15,
                "tally_updated": True,
                "critical_pending": "TEST_Performance_entry"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/performance/mis-entries",
            headers=accounts_headers,
            json=entry_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        entry = response.json()
        assert "entry_id" in entry, "Entry should have entry_id"
        assert entry["date"] == test_date, "Entry date should match"
        assert entry["fields"]["payments_processed"] == 25
        assert entry["fields"]["tally_updated"] == True
        print(f"✓ POST /api/performance/mis-entries created entry: {entry['entry_id']}")
        
        return entry["entry_id"]
    
    def test_get_mis_entries_with_filters(self, admin_headers):
        """GET /api/performance/mis-entries returns entries filtered by employee_id, department_id, date, period"""
        # Test period filter
        response = requests.get(
            f"{BASE_URL}/api/performance/mis-entries?period=monthly",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        entries = response.json()
        assert isinstance(entries, list), "Response should be a list"
        print(f"✓ GET /api/performance/mis-entries?period=monthly returned {len(entries)} entries")
    
    def test_get_mis_entries_by_date_range(self, admin_headers):
        """GET /api/performance/mis-entries with from_date and to_date filter"""
        today = datetime.now().strftime("%Y-%m-%d")
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/performance/mis-entries?from_date={week_ago}&to_date={today}",
            headers=admin_headers
        )
        assert response.status_code == 200
        entries = response.json()
        assert isinstance(entries, list)
        print(f"✓ Date range filter returned {len(entries)} entries")


class TestMISSummary:
    """Test MIS Summary aggregation endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_mis_summary_returns_aggregates(self, admin_headers):
        """GET /api/performance/mis-summary returns aggregated sums, averages, compliance_rates"""
        response = requests.get(
            f"{BASE_URL}/api/performance/mis-summary?period=monthly",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        summary = response.json()
        assert "period" in summary, "Summary should have period"
        assert "from_date" in summary, "Summary should have from_date"
        assert "to_date" in summary, "Summary should have to_date"
        assert "entry_count" in summary, "Summary should have entry_count"
        assert "sums" in summary, "Summary should have sums object"
        assert "averages" in summary, "Summary should have averages object"
        assert "compliance_rates" in summary, "Summary should have compliance_rates object"
        
        print(f"✓ GET /api/performance/mis-summary returned summary with {summary['entry_count']} entries")
        print(f"  Period: {summary['from_date']} to {summary['to_date']}")
        print(f"  Sums keys: {list(summary['sums'].keys())[:3]}...")
        print(f"  Compliance keys: {list(summary['compliance_rates'].keys())[:3] if summary['compliance_rates'] else 'none'}...")


class TestKPIDefinitions:
    """Test KPI Definition endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_kpi_definitions_returns_seeded_kpis(self, admin_headers):
        """GET /api/performance/kpi-definitions returns 25+ seeded KPI definitions"""
        response = requests.get(f"{BASE_URL}/api/performance/kpi-definitions", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        kpis = response.json()
        assert isinstance(kpis, list), "Response should be a list"
        assert len(kpis) >= 20, f"Expected at least 20 KPIs, got {len(kpis)}"
        
        # Verify KPI structure
        if kpis:
            kpi = kpis[0]
            assert "kpi_id" in kpi, "KPI should have kpi_id"
            assert "name" in kpi, "KPI should have name"
            assert "target_value" in kpi, "KPI should have target_value"
            assert "calculation_type" in kpi, "KPI should have calculation_type"
        
        print(f"✓ GET /api/performance/kpi-definitions returned {len(kpis)} KPIs")
        
        # Check calculation types
        calc_types = set(k.get("calculation_type") for k in kpis)
        print(f"  Calculation types: {calc_types}")
    
    def test_create_kpi_definition_admin_only(self, admin_headers):
        """POST /api/performance/kpi-definitions creates new KPI (admin only)"""
        kpi_data = {
            "name": "TEST_Performance_KPI",
            "description": "Test KPI created by performance tests",
            "department_id": None,  # All departments
            "category": "operational",
            "unit": "%",
            "target_value": 90,
            "weight": 1.0,
            "calculation_type": "manual"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/performance/kpi-definitions",
            headers=admin_headers,
            json=kpi_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        kpi = response.json()
        assert "kpi_id" in kpi
        assert kpi["name"] == "TEST_Performance_KPI"
        assert kpi["target_value"] == 90
        assert kpi["calculation_type"] == "manual"
        print(f"✓ POST /api/performance/kpi-definitions created KPI: {kpi['kpi_id']}")
    
    def test_create_kpi_non_admin_forbidden(self):
        """POST /api/performance/kpi-definitions returns 403 for non-admin users"""
        # Login as non-admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTS_USER_EMAIL, "password": ACCOUNTS_USER_PASSWORD
        })
        token = login_response.json().get("access_token") or login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/performance/kpi-definitions",
            headers=headers,
            json={"name": "Should Fail KPI"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ POST /api/performance/kpi-definitions correctly returns 403 for non-admin")


class TestKPIScores:
    """Test KPI Scores auto-calculation endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_kpi_scores_auto_calculates(self, admin_headers):
        """GET /api/performance/kpi-scores auto-calculates KPI scores from MIS data"""
        response = requests.get(
            f"{BASE_URL}/api/performance/kpi-scores?period=monthly",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "scores" in data, "Response should have scores array"
        assert "weighted_score" in data, "Response should have weighted_score"
        assert "period" in data, "Response should have period"
        assert "entry_count" in data, "Response should have entry_count"
        
        # Check score structure
        if data["scores"]:
            score = data["scores"][0]
            assert "kpi_id" in score, "Score should have kpi_id"
            assert "name" in score, "Score should have name"
            assert "target_value" in score, "Score should have target_value"
            assert "actual_value" in score, "Score should have actual_value"
            assert "score_percentage" in score, "Score should have score_percentage"
            assert "calculation_type" in score, "Score should have calculation_type"
        
        print(f"✓ GET /api/performance/kpi-scores returned {len(data['scores'])} scores")
        print(f"  Weighted score: {data['weighted_score']}%")
        print(f"  MIS entries used: {data['entry_count']}")


class TestKRADefinitions:
    """Test KRA Definition endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_create_kra_definition(self, admin_headers):
        """POST /api/performance/kra-definitions creates new KRA"""
        kra_data = {
            "name": "TEST_Department_Revenue_Growth",
            "description": "Ensure 15% YoY revenue growth for department",
            "department_id": None,  # All departments
            "designation_level": "Manager",
            "weight": 1.5,
            "target_description": "Achieve 15% revenue growth compared to previous year"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/performance/kra-definitions",
            headers=admin_headers,
            json=kra_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        kra = response.json()
        assert "kra_id" in kra, "KRA should have kra_id"
        assert kra["name"] == "TEST_Department_Revenue_Growth"
        assert kra["designation_level"] == "Manager"
        assert kra["weight"] == 1.5
        print(f"✓ POST /api/performance/kra-definitions created KRA: {kra['kra_id']}")
    
    def test_get_kra_definitions(self, admin_headers):
        """GET /api/performance/kra-definitions returns KRA definitions"""
        response = requests.get(f"{BASE_URL}/api/performance/kra-definitions", headers=admin_headers)
        assert response.status_code == 200
        
        kras = response.json()
        assert isinstance(kras, list)
        print(f"✓ GET /api/performance/kra-definitions returned {len(kras)} KRAs")
    
    def test_create_kra_non_admin_forbidden(self):
        """POST /api/performance/kra-definitions returns 403 for non-admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTS_USER_EMAIL, "password": ACCOUNTS_USER_PASSWORD
        })
        token = login_response.json().get("access_token") or login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/performance/kra-definitions",
            headers=headers,
            json={"name": "Should Fail KRA"}
        )
        assert response.status_code == 403
        print("✓ POST /api/performance/kra-definitions correctly returns 403 for non-admin")


class TestEvaluations:
    """Test Performance Evaluation endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, admin_headers):
        """Get a valid employee ID for testing"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=admin_headers)
        employees = response.json()
        if isinstance(employees, dict):
            employees = employees.get("employees", [])
        if employees:
            return employees[0]["employee_id"]
        return None
    
    def test_create_evaluation_with_ratings(self, admin_headers, test_employee_id):
        """POST /api/performance/evaluations creates evaluation with self/manager/hr ratings"""
        if not test_employee_id:
            pytest.skip("No employee found for testing")
        
        eval_data = {
            "employee_id": test_employee_id,
            "cycle": "quarterly",
            "period_label": "Q1 2026",
            "self_rating": 4,
            "self_comments": "TEST_evaluation - Good performance this quarter",
            "manager_rating": 4,
            "manager_comments": "Consistent performance",
            "hr_rating": 4,
            "hr_comments": "Meets expectations",
            "overall_rating": 4,
            "status": "completed"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/performance/evaluations",
            headers=admin_headers,
            json=eval_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        evaluation = response.json()
        assert "evaluation_id" in evaluation, "Evaluation should have evaluation_id"
        assert evaluation["employee_id"] == test_employee_id
        assert evaluation["cycle"] == "quarterly"
        assert evaluation["self_rating"] == 4
        assert evaluation["manager_rating"] == 4
        assert evaluation["hr_rating"] == 4
        print(f"✓ POST /api/performance/evaluations created evaluation: {evaluation['evaluation_id']}")
    
    def test_get_evaluations(self, admin_headers):
        """GET /api/performance/evaluations returns evaluations list"""
        response = requests.get(f"{BASE_URL}/api/performance/evaluations", headers=admin_headers)
        assert response.status_code == 200
        
        evaluations = response.json()
        assert isinstance(evaluations, list)
        print(f"✓ GET /api/performance/evaluations returned {len(evaluations)} evaluations")
    
    def test_filter_evaluations_by_cycle(self, admin_headers):
        """GET /api/performance/evaluations?cycle=quarterly filters by cycle"""
        response = requests.get(
            f"{BASE_URL}/api/performance/evaluations?cycle=quarterly",
            headers=admin_headers
        )
        assert response.status_code == 200
        evaluations = response.json()
        assert all(e.get("cycle") == "quarterly" for e in evaluations if "cycle" in e)
        print(f"✓ Evaluations filtered by cycle=quarterly: {len(evaluations)} results")


class TestCompanyDashboard:
    """Test Company Dashboard endpoint (Admin only)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_company_dashboard_returns_department_summaries(self, admin_headers):
        """GET /api/performance/company-dashboard returns department summaries and totals"""
        response = requests.get(
            f"{BASE_URL}/api/performance/company-dashboard?period=monthly",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        dashboard = response.json()
        assert "period" in dashboard, "Dashboard should have period"
        assert "from_date" in dashboard, "Dashboard should have from_date"
        assert "to_date" in dashboard, "Dashboard should have to_date"
        assert "total_employees" in dashboard, "Dashboard should have total_employees"
        assert "total_mis_entries" in dashboard, "Dashboard should have total_mis_entries"
        assert "department_summaries" in dashboard, "Dashboard should have department_summaries"
        
        # Check department summary structure
        if dashboard["department_summaries"]:
            dept = dashboard["department_summaries"][0]
            assert "department_id" in dept, "Dept summary should have department_id"
            assert "department_name" in dept, "Dept summary should have department_name"
            assert "employee_count" in dept, "Dept summary should have employee_count"
            assert "mis_entries" in dept, "Dept summary should have mis_entries"
            assert "mis_compliance" in dept, "Dept summary should have mis_compliance"
        
        print(f"✓ GET /api/performance/company-dashboard returned dashboard")
        print(f"  Total employees: {dashboard['total_employees']}")
        print(f"  Total MIS entries: {dashboard['total_mis_entries']}")
        print(f"  Departments: {len(dashboard['department_summaries'])}")
    
    def test_company_dashboard_non_admin_forbidden(self):
        """GET /api/performance/company-dashboard returns 403 for non-admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ACCOUNTS_USER_EMAIL, "password": ACCOUNTS_USER_PASSWORD
        })
        token = login_response.json().get("access_token") or login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.get(
            f"{BASE_URL}/api/performance/company-dashboard",
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ GET /api/performance/company-dashboard correctly returns 403 for non-admin")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return response.json().get("access_token") or response.json().get("token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_cleanup_test_kpis(self, admin_headers):
        """Delete KPIs created during testing"""
        response = requests.get(f"{BASE_URL}/api/performance/kpi-definitions", headers=admin_headers)
        kpis = response.json()
        
        deleted_count = 0
        for kpi in kpis:
            if kpi.get("name", "").startswith("TEST_"):
                del_response = requests.delete(
                    f"{BASE_URL}/api/performance/kpi-definitions/{kpi['kpi_id']}",
                    headers=admin_headers
                )
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test KPIs")
    
    def test_cleanup_test_kras(self, admin_headers):
        """Delete KRAs created during testing"""
        response = requests.get(f"{BASE_URL}/api/performance/kra-definitions", headers=admin_headers)
        kras = response.json()
        
        deleted_count = 0
        for kra in kras:
            if kra.get("name", "").startswith("TEST_"):
                del_response = requests.delete(
                    f"{BASE_URL}/api/performance/kra-definitions/{kra['kra_id']}",
                    headers=admin_headers
                )
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test KRAs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
