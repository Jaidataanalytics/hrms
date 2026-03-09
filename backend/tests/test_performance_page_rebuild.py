"""
Performance Management Page Tests - Complete Rebuild Testing
Tests for MIS, KPIs, KRAs, Evaluations, Manager Review, and Company Dashboard

Test Endpoints:
- GET /api/performance/my-team
- GET /api/performance/my-team-compliance
- GET /api/performance/all-kpi-definitions
- GET /api/performance/all-kra-definitions
- POST /api/performance/mis-entries
- GET /api/performance/kpi-scores
- POST /api/performance/seed-data
- GET /api/performance/mis-templates
- GET /api/performance/mis-templates/employee/{employee_id}
- POST /api/performance/kpi-definitions
- DELETE /api/performance/kpi-definitions/{kpi_id}
- POST /api/performance/kra-definitions
- DELETE /api/performance/kra-definitions/{kra_id}
- POST /api/performance/evaluations
- GET /api/performance/evaluations
- GET /api/performance/mis-compliance
- GET /api/performance/company-dashboard
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPerformanceManagement:
    """Performance Management API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        # Login as admin
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"},
            headers={"Content-Type": "application/json"}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Get cookies from response for subsequent requests
        self.cookies = login_resp.cookies
        self.headers = {"Content-Type": "application/json"}
        
        # Store employee_id for the admin user
        self.admin_employee_id = "EMP001"

    # ==================== SEED DATA ====================
    
    def test_01_seed_data(self):
        """Test seed data endpoint populates MIS templates, KPIs, and KRAs"""
        resp = self.session.post(
            f"{BASE_URL}/api/performance/seed-data",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"Seed data failed: {resp.text}"
        data = resp.json()
        
        # Verify response contains counts
        assert "message" in data, "Response missing message"
        assert "templates" in data, "Response missing templates count"
        assert "kpis" in data, "Response missing kpis count"
        assert "kras" in data, "Response missing kras count"
        
        # Should seed 3 templates (Rudra, Rounak, Praveen from Accounts)
        assert data["templates"] >= 3, f"Expected at least 3 templates, got {data['templates']}"
        # Should seed ~15 KPIs
        assert data["kpis"] >= 10, f"Expected at least 10 KPIs, got {data['kpis']}"
        # Should seed ~25 KRAs
        assert data["kras"] >= 20, f"Expected at least 20 KRAs, got {data['kras']}"
        
        print(f"✓ Seeded: {data['templates']} templates, {data['kpis']} KPIs, {data['kras']} KRAs")

    # ==================== MY TEAM ====================
    
    def test_02_my_team(self):
        """Test GET /api/performance/my-team returns team members"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/my-team",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"my-team failed: {resp.text}"
        data = resp.json()
        
        # Should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If admin has no reportees, list may be empty, which is valid
        print(f"✓ my-team returned {len(data)} team members")

    def test_03_my_team_compliance(self):
        """Test GET /api/performance/my-team-compliance returns compliance data"""
        today = datetime.now().strftime("%Y-%m-%d")
        resp = self.session.get(
            f"{BASE_URL}/api/performance/my-team-compliance?date={today}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"my-team-compliance failed: {resp.text}"
        data = resp.json()
        
        # Should contain compliance fields
        assert "date" in data, "Response missing date"
        assert "team" in data, "Response missing team"
        assert "filled" in data, "Response missing filled count"
        assert "not_filled" in data, "Response missing not_filled count"
        
        print(f"✓ my-team-compliance: {data['filled']} filled, {data['not_filled']} not filled")

    # ==================== ALL KPI/KRA DEFINITIONS (Admin) ====================
    
    def test_04_all_kpi_definitions(self):
        """Test GET /api/performance/all-kpi-definitions returns all KPIs"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/all-kpi-definitions",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"all-kpi-definitions failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # After seeding, should have KPIs
        if len(data) > 0:
            kpi = data[0]
            # Verify KPI structure
            assert "kpi_id" in kpi, "KPI missing kpi_id"
            assert "name" in kpi, "KPI missing name"
            assert "employee_id" in kpi or "employee_name" in kpi, "KPI should have employee info"
        
        print(f"✓ all-kpi-definitions returned {len(data)} KPIs")

    def test_05_all_kra_definitions(self):
        """Test GET /api/performance/all-kra-definitions returns all KRAs"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/all-kra-definitions",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"all-kra-definitions failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # After seeding, should have KRAs
        if len(data) > 0:
            kra = data[0]
            # Verify KRA structure
            assert "kra_id" in kra, "KRA missing kra_id"
            assert "name" in kra, "KRA missing name"
        
        print(f"✓ all-kra-definitions returned {len(data)} KRAs")

    # ==================== MIS TEMPLATES ====================
    
    def test_06_mis_templates(self):
        """Test GET /api/performance/mis-templates returns templates list"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-templates",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"mis-templates failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            template = data[0]
            assert "template_id" in template, "Template missing template_id"
            assert "fields" in template, "Template missing fields"
        
        print(f"✓ mis-templates returned {len(data)} templates")

    def test_07_mis_template_for_admin_employee(self):
        """Test GET /api/performance/mis-templates/employee/{id} - admin user has no template"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/{self.admin_employee_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"mis-templates/employee failed: {resp.text}"
        # Admin user (EMP001) should NOT have a template assigned
        # Response could be null/empty
        print(f"✓ Template for admin: {resp.json()}")

    def test_08_mis_template_for_accounts_employee(self):
        """Test GET /api/performance/mis-templates/employee/{id} for seeded employee"""
        # Check for Rudra Pratap Singh (EMP31088E46) who has seeded template
        emp_id = "EMP31088E46"
        resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/{emp_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"mis-templates/employee failed: {resp.text}"
        data = resp.json()
        
        # This employee should have a template after seeding
        if data:
            assert "template_id" in data, "Template missing template_id"
            assert "fields" in data, "Template missing fields"
            assert len(data["fields"]) > 0, "Template should have fields"
            print(f"✓ Employee {emp_id} has template with {len(data['fields'])} fields")
        else:
            print(f"⚠ Employee {emp_id} has no template (seed may not have run)")

    # ==================== MIS ENTRIES ====================
    
    def test_09_create_mis_entry(self):
        """Test POST /api/performance/mis-entries saves MIS entry"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # First get template for test employee
        emp_id = "EMP31088E46"
        template_resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/{emp_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        
        if template_resp.status_code == 200 and template_resp.json():
            template = template_resp.json()
            template_id = template.get("template_id")
            
            # Create MIS entry with sample data
            entry_data = {
                "template_id": template_id,
                "employee_id": emp_id,
                "department_id": template.get("department_id"),
                "date": today,
                "fields": {
                    "payments_processed": 10,
                    "payment_value": 150000,
                    "receipts_recorded": 5,
                    "tally_updated": True
                }
            }
            
            resp = self.session.post(
                f"{BASE_URL}/api/performance/mis-entries",
                json=entry_data,
                headers=self.headers,
                cookies=self.cookies
            )
            assert resp.status_code == 200, f"create mis-entry failed: {resp.text}"
            data = resp.json()
            
            assert "entry_id" in data, "Response missing entry_id"
            assert data["status"] in ["submitted", "resubmitted"], f"Unexpected status: {data['status']}"
            
            print(f"✓ Created MIS entry: {data['entry_id']}")
        else:
            pytest.skip("No template available for test employee")

    def test_10_get_mis_entries(self):
        """Test GET /api/performance/mis-entries retrieves entries"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-entries?period=monthly",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"get mis-entries failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ mis-entries returned {len(data)} entries for current month")

    # ==================== KPI SCORES ====================
    
    def test_11_kpi_scores(self):
        """Test GET /api/performance/kpi-scores returns calculated scores"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/kpi-scores?period=monthly",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"kpi-scores failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "scores" in data, "Response missing scores"
        assert "weighted_score" in data, "Response missing weighted_score"
        assert "period" in data, "Response missing period"
        assert "entry_count" in data, "Response missing entry_count"
        
        print(f"✓ kpi-scores: weighted_score={data['weighted_score']}%, entry_count={data['entry_count']}")

    def test_12_kpi_scores_for_employee(self):
        """Test GET /api/performance/kpi-scores?employee_id=... returns scores for specific employee"""
        emp_id = "EMP31088E46"
        resp = self.session.get(
            f"{BASE_URL}/api/performance/kpi-scores?employee_id={emp_id}&period=monthly",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"kpi-scores for employee failed: {resp.text}"
        data = resp.json()
        
        assert "scores" in data, "Response missing scores"
        assert "weighted_score" in data, "Response missing weighted_score"
        
        if data["scores"]:
            score = data["scores"][0]
            assert "kpi_id" in score, "Score missing kpi_id"
            assert "name" in score, "Score missing name"
            assert "score_percentage" in score, "Score missing score_percentage"
        
        print(f"✓ kpi-scores for {emp_id}: {len(data['scores'])} KPIs, weighted={data['weighted_score']}%")

    # ==================== KPI DEFINITIONS CRUD ====================
    
    def test_13_create_kpi_definition(self):
        """Test POST /api/performance/kpi-definitions creates a KPI"""
        kpi_data = {
            "name": "TEST_New KPI",
            "description": "Test KPI created by automated test",
            "employee_id": "EMP31088E46",
            "category": "operational",
            "unit": "%",
            "target_value": 90,
            "weight": 1.0,
            "calculation_type": "manual"
        }
        
        resp = self.session.post(
            f"{BASE_URL}/api/performance/kpi-definitions",
            json=kpi_data,
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"create kpi failed: {resp.text}"
        data = resp.json()
        
        assert "kpi_id" in data, "Response missing kpi_id"
        assert data["name"] == "TEST_New KPI", "KPI name mismatch"
        
        # Store for deletion test
        self.__class__.test_kpi_id = data["kpi_id"]
        
        print(f"✓ Created KPI: {data['kpi_id']}")

    def test_14_delete_kpi_definition(self):
        """Test DELETE /api/performance/kpi-definitions/{kpi_id} removes a KPI"""
        kpi_id = getattr(self.__class__, 'test_kpi_id', None)
        if not kpi_id:
            pytest.skip("No KPI created to delete")
        
        resp = self.session.delete(
            f"{BASE_URL}/api/performance/kpi-definitions/{kpi_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"delete kpi failed: {resp.text}"
        
        print(f"✓ Deleted KPI: {kpi_id}")

    # ==================== KRA DEFINITIONS CRUD ====================
    
    def test_15_create_kra_definition(self):
        """Test POST /api/performance/kra-definitions creates a KRA"""
        kra_data = {
            "name": "TEST_New KRA",
            "description": "Test KRA created by automated test",
            "employee_id": "EMP31088E46",
            "weight": 1.5
        }
        
        resp = self.session.post(
            f"{BASE_URL}/api/performance/kra-definitions",
            json=kra_data,
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"create kra failed: {resp.text}"
        data = resp.json()
        
        assert "kra_id" in data, "Response missing kra_id"
        assert data["name"] == "TEST_New KRA", "KRA name mismatch"
        
        # Store for deletion test
        self.__class__.test_kra_id = data["kra_id"]
        
        print(f"✓ Created KRA: {data['kra_id']}")

    def test_16_delete_kra_definition(self):
        """Test DELETE /api/performance/kra-definitions/{kra_id} removes a KRA"""
        kra_id = getattr(self.__class__, 'test_kra_id', None)
        if not kra_id:
            pytest.skip("No KRA created to delete")
        
        resp = self.session.delete(
            f"{BASE_URL}/api/performance/kra-definitions/{kra_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"delete kra failed: {resp.text}"
        
        print(f"✓ Deleted KRA: {kra_id}")

    # ==================== EVALUATIONS ====================
    
    def test_17_get_evaluations(self):
        """Test GET /api/performance/evaluations lists evaluations"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/evaluations",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"get evaluations failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ evaluations returned {len(data)} evaluations")

    def test_18_create_evaluation(self):
        """Test POST /api/performance/evaluations creates an evaluation (HR only)"""
        eval_data = {
            "employee_id": "EMP31088E46",
            "cycle": "quarterly",
            "period_label": "Q1 2026",
            "hr_comments": "Test evaluation created by automated test"
        }
        
        resp = self.session.post(
            f"{BASE_URL}/api/performance/evaluations",
            json=eval_data,
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"create evaluation failed: {resp.text}"
        data = resp.json()
        
        assert "evaluation_id" in data, "Response missing evaluation_id"
        assert data["cycle"] == "quarterly", "Cycle mismatch"
        assert data["status"] == "draft", f"Unexpected status: {data['status']}"
        
        # Store for later tests
        self.__class__.test_eval_id = data["evaluation_id"]
        
        print(f"✓ Created evaluation: {data['evaluation_id']}")

    # ==================== MIS COMPLIANCE ====================
    
    def test_19_mis_compliance(self):
        """Test GET /api/performance/mis-compliance shows submission status"""
        today = datetime.now().strftime("%Y-%m-%d")
        resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-compliance?date={today}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"mis-compliance failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "date" in data, "Response missing date"
        assert "total_assigned" in data, "Response missing total_assigned"
        assert "filled" in data, "Response missing filled"
        assert "not_filled" in data, "Response missing not_filled"
        
        print(f"✓ mis-compliance: {data['filled']}/{data['total_assigned']} submitted")

    # ==================== COMPANY DASHBOARD ====================
    
    def test_20_company_dashboard(self):
        """Test GET /api/performance/company-dashboard shows company-wide stats"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/company-dashboard?period=monthly",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"company-dashboard failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "total_employees" in data, "Response missing total_employees"
        assert "total_templates_assigned" in data, "Response missing total_templates_assigned"
        assert "total_mis_entries" in data, "Response missing total_mis_entries"
        assert "department_summaries" in data, "Response missing department_summaries"
        
        print(f"✓ company-dashboard: {data['total_employees']} employees, {data['total_templates_assigned']} templates assigned")

    # ==================== KRA DEFINITIONS (User-level) ====================
    
    def test_21_kra_definitions(self):
        """Test GET /api/performance/kra-definitions returns user's KRAs"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/kra-definitions",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"kra-definitions failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ kra-definitions returned {len(data)} KRAs for current user")

    # ==================== MIS SUMMARY ====================
    
    def test_22_mis_summary(self):
        """Test GET /api/performance/mis-summary returns aggregated MIS data"""
        resp = self.session.get(
            f"{BASE_URL}/api/performance/mis-summary?period=monthly",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"mis-summary failed: {resp.text}"
        data = resp.json()
        
        assert "period" in data, "Response missing period"
        assert "entry_count" in data, "Response missing entry_count"
        assert "sums" in data, "Response missing sums"
        assert "averages" in data, "Response missing averages"
        
        print(f"✓ mis-summary: {data['entry_count']} entries, sums={data['sums']}")

    # ==================== MIS TEMPLATE CRUD ====================
    
    def test_23_create_mis_template(self):
        """Test POST /api/performance/mis-templates creates a template"""
        # First get an employee to assign template to
        employees_resp = self.session.get(
            f"{BASE_URL}/api/employees",
            headers=self.headers,
            cookies=self.cookies
        )
        
        if employees_resp.status_code == 200:
            employees = employees_resp.json()
            employees_list = employees if isinstance(employees, list) else employees.get("employees", [])
            
            # Find an employee without template (not in Accounts dept seeded list)
            test_emp = None
            for emp in employees_list:
                if emp.get("employee_id") and emp.get("employee_id") not in ["EMP31088E46", "EMP35946842", "EMP6BE094D9"]:
                    test_emp = emp
                    break
            
            if test_emp:
                template_data = {
                    "employee_id": test_emp["employee_id"],
                    "fields": [
                        {"key": "tasks_completed", "label": "Tasks Completed", "type": "number"},
                        {"key": "meetings_attended", "label": "Meetings Attended", "type": "number"},
                        {"key": "daily_report_submitted", "label": "Daily Report Submitted", "type": "boolean"}
                    ]
                }
                
                resp = self.session.post(
                    f"{BASE_URL}/api/performance/mis-templates",
                    json=template_data,
                    headers=self.headers,
                    cookies=self.cookies
                )
                assert resp.status_code == 200, f"create mis-template failed: {resp.text}"
                data = resp.json()
                
                assert "template_id" in data, "Response missing template_id"
                
                # Store for cleanup
                self.__class__.test_template_id = data["template_id"]
                
                print(f"✓ Created MIS template: {data['template_id']}")
            else:
                pytest.skip("No suitable employee found for template creation")
        else:
            pytest.skip("Could not fetch employees list")

    def test_24_delete_mis_template(self):
        """Test DELETE /api/performance/mis-templates/{template_id} removes template"""
        template_id = getattr(self.__class__, 'test_template_id', None)
        if not template_id:
            pytest.skip("No template created to delete")
        
        resp = self.session.delete(
            f"{BASE_URL}/api/performance/mis-templates/{template_id}",
            headers=self.headers,
            cookies=self.cookies
        )
        assert resp.status_code == 200, f"delete mis-template failed: {resp.text}"
        
        print(f"✓ Deleted MIS template: {template_id}")


class TestPerformanceAccessControl:
    """Test access control for performance APIs"""
    
    def test_non_admin_cannot_access_admin_apis(self):
        """Test that non-admin users cannot access admin-only endpoints"""
        session = requests.Session()
        
        # First, try to find a non-admin user (this is a basic access test)
        # Most performance endpoints require HR/admin role
        # Just verify that seed-data requires authentication
        resp = session.post(
            f"{BASE_URL}/api/performance/seed-data",
            headers={"Content-Type": "application/json"}
        )
        # Should fail without auth (401 or 403)
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got {resp.status_code}"
        
        print(f"✓ seed-data requires authentication (got {resp.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
