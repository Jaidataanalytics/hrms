"""
Test Achievement Tracker Feature & Production Employee Seed Data
Tests new features:
- POST /api/performance/achievements - Submit achievement
- GET /api/performance/achievements - List achievements
- GET /api/performance/achievements/pending - Pending endorsements
- PUT /api/performance/achievements/{id}/endorse - Endorse achievement
- PUT /api/performance/achievements/{id}/reject - Reject achievement
- Seed data for 5 new production employees with daily + monthly MIS templates
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestAchievementTracker:
    """Achievement Tracker API Tests"""
    
    token = None
    test_achievement_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        if not TestAchievementTracker.token:
            login_resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "admin@shardahr.com", "password": "password"}
            )
            if login_resp.status_code == 200:
                data = login_resp.json()
                TestAchievementTracker.token = data.get("access_token")
            else:
                pytest.skip("Login failed - cannot run authenticated tests")
    
    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestAchievementTracker.token}"
        }
    
    # ===========================================
    # Achievement Submission Tests
    # ===========================================
    
    def test_01_submit_achievement_success(self):
        """Test POST /api/performance/achievements creates new achievement"""
        payload = {
            "title": f"TEST_Automated QC System_{uuid.uuid4().hex[:6]}",
            "category": "Innovation",
            "description": "Developed automated quality check system reducing manual inspection time by 40%",
            "impact": "High"
        }
        resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers(),
            json=payload
        )
        print(f"Submit Achievement Response: {resp.status_code} - {resp.text[:500]}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Validate response structure
        assert "achievement_id" in data, "Missing achievement_id in response"
        assert data["achievement_id"].startswith("ACH-"), f"achievement_id should start with ACH-, got {data['achievement_id']}"
        assert data["status"] == "pending", f"Expected status 'pending', got {data.get('status')}"
        assert data["title"] == payload["title"], "Title mismatch"
        assert data["category"] == "Innovation", "Category mismatch"
        assert data["impact"] == "High", "Impact mismatch"
        
        # Store for later tests
        TestAchievementTracker.test_achievement_id = data["achievement_id"]
        print(f"Created achievement: {data['achievement_id']}")
    
    def test_02_submit_achievement_missing_title(self):
        """Test POST /api/performance/achievements returns 400 for missing title"""
        payload = {
            "category": "Achievement",
            "description": "Missing title",
            "impact": "Medium"
        }
        resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers(),
            json=payload
        )
        print(f"Missing title response: {resp.status_code}")
        assert resp.status_code == 400, f"Expected 400 for missing title, got {resp.status_code}"
    
    def test_03_submit_achievement_empty_title(self):
        """Test POST /api/performance/achievements returns 400 for empty title"""
        payload = {
            "title": "   ",
            "category": "Achievement",
            "impact": "Medium"
        }
        resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers(),
            json=payload
        )
        print(f"Empty title response: {resp.status_code}")
        assert resp.status_code == 400, f"Expected 400 for empty title, got {resp.status_code}"
    
    # ===========================================
    # Achievement List Tests
    # ===========================================
    
    def test_04_get_achievements_list(self):
        """Test GET /api/performance/achievements returns list"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers()
        )
        print(f"Achievements list: {resp.status_code} - count: {len(resp.json()) if resp.ok else 'N/A'}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if our test achievement is in the list
        if TestAchievementTracker.test_achievement_id:
            found = any(a["achievement_id"] == TestAchievementTracker.test_achievement_id for a in data)
            assert found, f"Test achievement {TestAchievementTracker.test_achievement_id} not found in list"
    
    def test_05_get_pending_endorsements(self):
        """Test GET /api/performance/achievements/pending returns pending achievements"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/achievements/pending",
            headers=self.get_headers()
        )
        print(f"Pending endorsements: {resp.status_code} - count: {len(resp.json()) if resp.ok else 'N/A'}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All items should have status=pending
        for item in data:
            assert item.get("status") == "pending", f"Unexpected status in pending list: {item.get('status')}"
    
    # ===========================================
    # Endorse & Reject Tests
    # ===========================================
    
    def test_06_endorse_achievement(self):
        """Test PUT /api/performance/achievements/{id}/endorse endorses successfully"""
        # Create a new achievement to endorse
        create_resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers(),
            json={
                "title": f"TEST_Endorse_Test_{uuid.uuid4().hex[:6]}",
                "category": "Improvement",
                "description": "Achievement to test endorsement",
                "impact": "Medium"
            }
        )
        assert create_resp.status_code == 200
        ach_id = create_resp.json()["achievement_id"]
        
        # Endorse it
        resp = requests.put(
            f"{BASE_URL}/api/performance/achievements/{ach_id}/endorse",
            headers=self.get_headers(),
            json={"remarks": "Well done on this improvement!"}
        )
        print(f"Endorse response: {resp.status_code} - {resp.text}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "message" in data, "Missing message in response"
        assert "endorsed" in data["message"].lower(), f"Unexpected message: {data['message']}"
    
    def test_07_endorse_nonexistent_achievement(self):
        """Test PUT /api/performance/achievements/{id}/endorse returns 404 for non-existent"""
        resp = requests.put(
            f"{BASE_URL}/api/performance/achievements/ACH-NONEXISTENT/endorse",
            headers=self.get_headers(),
            json={"remarks": "Test"}
        )
        print(f"Endorse nonexistent: {resp.status_code}")
        assert resp.status_code == 404, f"Expected 404 for non-existent achievement, got {resp.status_code}"
    
    def test_08_reject_achievement(self):
        """Test PUT /api/performance/achievements/{id}/reject rejects successfully"""
        # Create a new achievement to reject
        create_resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers(),
            json={
                "title": f"TEST_Reject_Test_{uuid.uuid4().hex[:6]}",
                "category": "Other",
                "description": "Achievement to test rejection",
                "impact": "Low"
            }
        )
        assert create_resp.status_code == 200
        ach_id = create_resp.json()["achievement_id"]
        
        # Reject it
        resp = requests.put(
            f"{BASE_URL}/api/performance/achievements/{ach_id}/reject",
            headers=self.get_headers(),
            json={"reason": "Insufficient evidence provided"}
        )
        print(f"Reject response: {resp.status_code} - {resp.text}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "message" in data, "Missing message in response"
        assert "rejected" in data["message"].lower(), f"Unexpected message: {data['message']}"
    
    def test_09_reject_nonexistent_achievement(self):
        """Test PUT /api/performance/achievements/{id}/reject returns 404 for non-existent"""
        resp = requests.put(
            f"{BASE_URL}/api/performance/achievements/ACH-NONEXISTENT/reject",
            headers=self.get_headers(),
            json={"reason": "Test rejection"}
        )
        print(f"Reject nonexistent: {resp.status_code}")
        assert resp.status_code == 404, f"Expected 404 for non-existent achievement, got {resp.status_code}"
    
    # ===========================================
    # Verified Achievement Status
    # ===========================================
    
    def test_10_endorsed_achievement_status_persists(self):
        """Test that endorsed status persists in achievements list"""
        # Create and endorse
        create_resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers(),
            json={
                "title": f"TEST_Status_Check_{uuid.uuid4().hex[:6]}",
                "category": "Quality",
                "impact": "High"
            }
        )
        assert create_resp.status_code == 200
        ach_id = create_resp.json()["achievement_id"]
        
        # Endorse
        endorse_resp = requests.put(
            f"{BASE_URL}/api/performance/achievements/{ach_id}/endorse",
            headers=self.get_headers(),
            json={"remarks": "Approved"}
        )
        assert endorse_resp.status_code == 200
        
        # Verify in list
        list_resp = requests.get(
            f"{BASE_URL}/api/performance/achievements",
            headers=self.get_headers()
        )
        assert list_resp.status_code == 200
        achievements = list_resp.json()
        
        found = next((a for a in achievements if a["achievement_id"] == ach_id), None)
        assert found is not None, f"Achievement {ach_id} not found in list"
        assert found["status"] == "endorsed", f"Expected status 'endorsed', got {found['status']}"
        print(f"Verified: Achievement {ach_id} has status 'endorsed'")


class TestProductionEmployeeSeedData:
    """Tests for 5 new production employee MIS templates and KPIs"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        if not TestProductionEmployeeSeedData.token:
            login_resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "admin@shardahr.com", "password": "password"}
            )
            if login_resp.status_code == 200:
                data = login_resp.json()
                TestProductionEmployeeSeedData.token = data.get("access_token")
            else:
                pytest.skip("Login failed - cannot run authenticated tests")
    
    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestProductionEmployeeSeedData.token}"
        }
    
    # ===========================================
    # Seed Data Verification Tests
    # ===========================================
    
    def test_01_seed_endpoint_returns_sufficient_templates(self):
        """Test POST /api/performance/seed-data returns 31+ templates"""
        resp = requests.post(
            f"{BASE_URL}/api/performance/seed-data",
            headers=self.get_headers()
        )
        print(f"Seed response: {resp.status_code}")
        
        # May return 200 or message about already seeded
        assert resp.status_code in [200, 201], f"Unexpected status: {resp.status_code}"
        
        # Verify templates count
        templates_resp = requests.get(
            f"{BASE_URL}/api/performance/mis-templates",
            headers=self.get_headers()
        )
        assert templates_resp.status_code == 200
        templates = templates_resp.json()
        print(f"Total templates: {len(templates)}")
        assert len(templates) >= 31, f"Expected 31+ templates, got {len(templates)}"
    
    def test_02_seed_endpoint_returns_sufficient_kpis(self):
        """Test seed creates 136+ KPI definitions"""
        kpi_resp = requests.get(
            f"{BASE_URL}/api/performance/all-kpi-definitions",
            headers=self.get_headers()
        )
        assert kpi_resp.status_code == 200
        kpis = kpi_resp.json()
        print(f"Total KPIs: {len(kpis)}")
        assert len(kpis) >= 136, f"Expected 136+ KPIs, got {len(kpis)}"
    
    # ===========================================
    # Ashish Banerjee (EMPC216D32A) - Powder Coating
    # ===========================================
    
    def test_03_ashish_banerjee_template_exists(self):
        """Test GET /api/performance/mis-templates/employee/EMPC216D32A returns daily MIS template"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/EMPC216D32A",
            headers=self.get_headers()
        )
        print(f"Ashish template response: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data is not None, "Template should exist for Ashish Banerjee"
        assert data.get("employee_id") == "EMPC216D32A", f"Wrong employee_id: {data.get('employee_id')}"
        assert "Ashish" in data.get("employee_name", ""), f"Name should contain 'Ashish': {data.get('employee_name')}"
        
        # Verify it's daily frequency
        assert data.get("frequency") == "daily", f"Expected daily frequency, got {data.get('frequency')}"
        
        # Check fields
        fields = data.get("fields", [])
        field_keys = [f.get("key") for f in fields]
        assert "units_painted" in field_keys, "Missing 'units_painted' field"
        assert "rework_pieces" in field_keys, "Missing 'rework_pieces' field"
        print(f"Ashish Banerjee template verified: {len(fields)} fields, frequency={data.get('frequency')}")
    
    # ===========================================
    # Vicky Kumar (EMP6DB371FD) - Planning
    # ===========================================
    
    def test_04_vicky_kumar_template_exists(self):
        """Test Vicky Kumar daily MIS template exists"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/EMP6DB371FD",
            headers=self.get_headers()
        )
        print(f"Vicky template response: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert data is not None, "Template should exist for Vicky Kumar"
        assert "Vicky" in data.get("employee_name", ""), f"Name mismatch: {data.get('employee_name')}"
        
        fields = data.get("fields", [])
        field_keys = [f.get("key") for f in fields]
        assert "dg_sets_dispatched" in field_keys, "Missing 'dg_sets_dispatched' field"
        print(f"Vicky Kumar template verified: {len(fields)} fields")
    
    # ===========================================
    # Vishal Yadav (EMP337B108D) - DG Production
    # ===========================================
    
    def test_05_vishal_yadav_template_exists(self):
        """Test Vishal Yadav daily MIS template exists"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/EMP337B108D",
            headers=self.get_headers()
        )
        print(f"Vishal template response: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert data is not None, "Template should exist for Vishal Yadav"
        assert "Vishal" in data.get("employee_name", ""), f"Name mismatch: {data.get('employee_name')}"
        
        fields = data.get("fields", [])
        field_keys = [f.get("key") for f in fields]
        assert "dg_sets_produced" in field_keys, "Missing 'dg_sets_produced' field"
        print(f"Vishal Yadav template verified: {len(fields)} fields")
    
    # ===========================================
    # Rahul Kumar (EMP24427A32) - Canopy Cutting
    # ===========================================
    
    def test_06_rahul_kumar_template_exists(self):
        """Test GET /api/performance/mis-templates/employee/EMP24427A32 returns Rahul Kumar daily MIS"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/EMP24427A32",
            headers=self.get_headers()
        )
        print(f"Rahul template response: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert data is not None, "Template should exist for Rahul Kumar"
        assert "Rahul" in data.get("employee_name", ""), f"Name mismatch: {data.get('employee_name')}"
        
        fields = data.get("fields", [])
        field_keys = [f.get("key") for f in fields]
        assert "pieces_cut_punched" in field_keys, "Missing 'pieces_cut_punched' field"
        print(f"Rahul Kumar template verified: {len(fields)} fields")
    
    # ===========================================
    # Surendra Bediya (EMP80FE0506) - Baseframe
    # ===========================================
    
    def test_07_surendra_bediya_template_exists(self):
        """Test Surendra Bediya daily MIS template exists"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/mis-templates/employee/EMP80FE0506",
            headers=self.get_headers()
        )
        print(f"Surendra template response: {resp.status_code}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert data is not None, "Template should exist for Surendra Bediya"
        assert "Surendra" in data.get("employee_name", ""), f"Name mismatch: {data.get('employee_name')}"
        
        fields = data.get("fields", [])
        field_keys = [f.get("key") for f in fields]
        assert "baseframes_completed" in field_keys, "Missing 'baseframes_completed' field"
        print(f"Surendra Bediya template verified: {len(fields)} fields")
    
    # ===========================================
    # KPI Definitions for Production Employees
    # ===========================================
    
    def test_08_ashish_banerjee_kpis_exist(self):
        """Test Ashish Banerjee has KPI definitions"""
        resp = requests.get(
            f"{BASE_URL}/api/performance/kpi-definitions?employee_id=EMPC216D32A",
            headers=self.get_headers()
        )
        assert resp.status_code == 200
        kpis = resp.json()
        
        print(f"Ashish Banerjee KPIs: {len(kpis)}")
        assert len(kpis) >= 4, f"Expected 4+ KPIs for Ashish, got {len(kpis)}"
        
        kpi_names = [k["name"] for k in kpis]
        assert any("Production" in n for n in kpi_names), "Missing Production Output KPI"
    
    def test_09_all_production_employees_have_kpis(self):
        """Test all 5 new production employees have KPI definitions"""
        employee_ids = ["EMPC216D32A", "EMP6DB371FD", "EMP337B108D", "EMP24427A32", "EMP80FE0506"]
        
        for emp_id in employee_ids:
            resp = requests.get(
                f"{BASE_URL}/api/performance/kpi-definitions?employee_id={emp_id}",
                headers=self.get_headers()
            )
            assert resp.status_code == 200, f"Failed to get KPIs for {emp_id}"
            kpis = resp.json()
            assert len(kpis) >= 4, f"Employee {emp_id} should have 4+ KPIs, got {len(kpis)}"
            print(f"Employee {emp_id} has {len(kpis)} KPIs")


class TestAchievementCategories:
    """Test achievement category and impact validation"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        if not TestAchievementCategories.token:
            login_resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "admin@shardahr.com", "password": "password"}
            )
            if login_resp.status_code == 200:
                TestAchievementCategories.token = login_resp.json().get("access_token")
            else:
                pytest.skip("Login failed")
    
    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TestAchievementCategories.token}"
        }
    
    def test_all_categories_accepted(self):
        """Test all valid categories are accepted"""
        categories = ["Innovation", "Achievement", "Improvement", "IT", "Planning", "Training", "Quality", "Other"]
        
        for cat in categories:
            resp = requests.post(
                f"{BASE_URL}/api/performance/achievements",
                headers=self.get_headers(),
                json={
                    "title": f"TEST_Category_{cat}_{uuid.uuid4().hex[:4]}",
                    "category": cat,
                    "impact": "Medium"
                }
            )
            assert resp.status_code == 200, f"Category '{cat}' should be accepted, got {resp.status_code}"
            print(f"Category '{cat}' accepted: {resp.json().get('achievement_id')}")
    
    def test_all_impact_levels_accepted(self):
        """Test all valid impact levels are accepted"""
        impacts = ["High", "Medium", "Low"]
        
        for impact in impacts:
            resp = requests.post(
                f"{BASE_URL}/api/performance/achievements",
                headers=self.get_headers(),
                json={
                    "title": f"TEST_Impact_{impact}_{uuid.uuid4().hex[:4]}",
                    "category": "Achievement",
                    "impact": impact
                }
            )
            assert resp.status_code == 200, f"Impact '{impact}' should be accepted, got {resp.status_code}"
            print(f"Impact '{impact}' accepted: {resp.json().get('achievement_id')}")


class TestUnauthorizedAccess:
    """Test unauthorized access to achievement endpoints"""
    
    def test_achievements_without_auth(self):
        """Test GET /api/performance/achievements without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/performance/achievements")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
    
    def test_submit_achievement_without_auth(self):
        """Test POST /api/performance/achievements without auth returns 401"""
        resp = requests.post(
            f"{BASE_URL}/api/performance/achievements",
            json={"title": "Test", "category": "Other"}
        )
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
    
    def test_pending_endorsements_without_auth(self):
        """Test GET /api/performance/achievements/pending without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/performance/achievements/pending")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
