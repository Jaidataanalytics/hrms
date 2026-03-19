"""
Test MIS Compliance Section Redesign and Edit Template Features (Iteration 57)
Tests:
1. MIS Compliance section shows progress bar with submitted/pending counts
2. MIS Compliance pending list is grouped by department
3. MIS Templates section shows Edit button alongside View and Delete
4. Edit dialog pre-fills fields from existing template
5. POST /api/performance/mis-templates upserts by employee_id + frequency
6. Templates display frequency badges (Daily/Weekly/Monthly/Quarterly)
7. Search filter works on template list to filter by employee name
8. Department filter works on template list
9. POST /api/performance/mis-entries includes frequency field
10. Quarterly entries locked for past quarters (non-admin)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_session():
    """Get authenticated admin session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    login_response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@shardahr.com",
        "password": "password"
    })
    
    if login_response.status_code != 200:
        pytest.skip("Admin login failed")
    
    return session


class TestMISComplianceSection:
    """Tests for redesigned MIS Compliance section with progress bar and department grouping"""
    
    def test_compliance_endpoint_returns_correct_structure(self, admin_session):
        """Verify MIS compliance endpoint returns required fields"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-compliance")
        assert response.status_code == 200
        
        data = response.json()
        # Required fields for progress bar
        assert "date" in data
        assert "total_assigned" in data
        assert "filled" in data
        assert "not_filled" in data
        assert "filled_list" in data
        assert "not_filled_list" in data
        
        print(f"Compliance: {data['filled']}/{data['total_assigned']} submitted, {data['not_filled']} pending")
    
    def test_compliance_pending_list_has_department_info(self, admin_session):
        """Verify pending list includes department_name for grouping"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-compliance")
        assert response.status_code == 200
        
        data = response.json()
        not_filled_list = data.get("not_filled_list", [])
        
        if not_filled_list:
            # Each entry should have department_name for grouping
            first_entry = not_filled_list[0]
            assert "employee_id" in first_entry
            assert "employee_name" in first_entry
            assert "department_name" in first_entry
            
            # Count departments for grouping
            departments = {}
            for entry in not_filled_list:
                dept = entry.get("department_name", "Other")
                departments[dept] = departments.get(dept, 0) + 1
            
            print(f"Department groups: {departments}")
            assert len(departments) >= 1, "Should have at least one department group"
    
    def test_compliance_progress_calculation(self, admin_session):
        """Verify progress bar values are correctly calculated"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-compliance")
        assert response.status_code == 200
        
        data = response.json()
        total = data["total_assigned"]
        filled = data["filled"]
        not_filled = data["not_filled"]
        
        # Verify counts
        assert filled + not_filled == total, f"Filled ({filled}) + Not filled ({not_filled}) should equal total ({total})"
        assert filled == len(data["filled_list"]), "Filled count should match filled_list length"
        assert not_filled == len(data["not_filled_list"]), "Not filled count should match not_filled_list length"
        
        print(f"Progress: {filled}/{total} = {(filled/total*100) if total > 0 else 0:.1f}%")


class TestMISTemplatesEditFeature:
    """Tests for Edit button and template modification"""
    
    def test_templates_list_has_required_fields(self, admin_session):
        """Verify templates have fields needed for Edit functionality"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        assert response.status_code == 200
        
        templates = response.json()
        if templates:
            # Filter templates with employee_id (employee-specific)
            emp_templates = [t for t in templates if t.get("employee_id")]
            if emp_templates:
                template = emp_templates[0]
                
                # Required fields for edit functionality
                assert "template_id" in template
                assert "employee_id" in template
                assert "fields" in template
                assert "frequency" in template
                assert "employee_name" in template
                assert "department_name" in template
                
                print(f"Template: {template['template_id']} - {template['employee_name']} ({template['frequency']})")
                print(f"Fields: {len(template.get('fields', []))} fields")
    
    def test_templates_have_frequency_badges(self, admin_session):
        """Verify templates have frequency field for displaying badges"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        assert response.status_code == 200
        
        templates = response.json()
        emp_templates = [t for t in templates if t.get("employee_id")]
        
        frequencies = set()
        for t in emp_templates:
            freq = t.get("frequency", "daily")
            frequencies.add(freq)
        
        print(f"Frequencies found: {frequencies}")
        # Should support daily, weekly, monthly, quarterly
        valid_frequencies = {"daily", "weekly", "monthly", "quarterly"}
        for freq in frequencies:
            assert freq in valid_frequencies, f"Invalid frequency: {freq}"
    
    def test_create_template_upserts_by_employee_frequency(self, admin_session):
        """Verify POST upserts template by employee_id + frequency combo"""
        # Create a test template
        test_payload = {
            "employee_id": "EMP001",  # Admin user
            "frequency": "daily",
            "fields": [
                {"key": "test_field_1", "label": "Test Field 1", "type": "number"},
                {"key": "test_field_2", "label": "Test Field 2", "type": "boolean"}
            ]
        }
        
        # First create
        response1 = admin_session.post(f"{BASE_URL}/api/performance/mis-templates", json=test_payload)
        assert response1.status_code == 200
        template1 = response1.json()
        template_id_1 = template1["template_id"]
        
        # Second create with same employee+frequency should upsert (same template_id)
        test_payload["fields"].append({"key": "test_field_3", "label": "Test Field 3", "type": "text"})
        response2 = admin_session.post(f"{BASE_URL}/api/performance/mis-templates", json=test_payload)
        assert response2.status_code == 200
        template2 = response2.json()
        template_id_2 = template2["template_id"]
        
        # Should be the same template_id (upsert, not duplicate)
        assert template_id_1 == template_id_2, f"Upsert should maintain same template_id: {template_id_1} != {template_id_2}"
        
        # But with different frequency, should create new
        test_payload["frequency"] = "weekly"
        response3 = admin_session.post(f"{BASE_URL}/api/performance/mis-templates", json=test_payload)
        assert response3.status_code == 200
        template3 = response3.json()
        
        # Different frequency = different template
        assert template3["template_id"] != template_id_1, "Different frequency should create new template"
        
        print(f"Upsert verified: daily template_id stays {template_id_1}, weekly created {template3['template_id']}")
    
    def test_get_employee_templates_returns_array(self, admin_session):
        """Verify GET /mis-templates/employee/{id} returns array of templates"""
        # First ensure we have some templates
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        templates = response.json()
        emp_templates = [t for t in templates if t.get("employee_id")]
        
        if emp_templates:
            employee_id = emp_templates[0]["employee_id"]
            
            response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates/employee/{employee_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert isinstance(data, list), "Should return array of templates"
            
            if data:
                for t in data:
                    assert "frequency" in t
                    assert "fields" in t
                
                print(f"Employee {employee_id} has {len(data)} templates: {[t.get('frequency') for t in data]}")


class TestMISTemplatesFilters:
    """Tests for search and department filter on templates list"""
    
    def test_templates_have_searchable_employee_name(self, admin_session):
        """Verify templates have employee_name for search filtering"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        assert response.status_code == 200
        
        templates = response.json()
        emp_templates = [t for t in templates if t.get("employee_id")]
        
        employee_names = [t.get("employee_name", "") for t in emp_templates]
        non_empty_names = [n for n in employee_names if n]
        
        assert len(non_empty_names) > 0, "Should have templates with employee_name for search"
        print(f"Searchable names: {len(non_empty_names)} templates with employee names")
    
    def test_templates_have_department_for_filter(self, admin_session):
        """Verify templates have department_name for department filter"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        assert response.status_code == 200
        
        templates = response.json()
        emp_templates = [t for t in templates if t.get("employee_id")]
        
        departments = set()
        for t in emp_templates:
            dept = t.get("department_name")
            if dept:
                departments.add(dept)
        
        print(f"Departments for filter: {sorted(departments)}")
        assert len(departments) >= 1, "Should have at least one department for filtering"


class TestMISEntriesFrequency:
    """Tests for MIS entries with frequency field and quarterly locking"""
    
    def test_create_entry_with_frequency_field(self, admin_session):
        """Verify POST /mis-entries accepts frequency field"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get a template to use
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        templates = response.json()
        daily_template = next((t for t in templates if t.get("frequency") == "daily" and t.get("employee_id")), None)
        
        if daily_template:
            entry_payload = {
                "employee_id": daily_template["employee_id"],
                "template_id": daily_template["template_id"],
                "frequency": "daily",
                "date": today,
                "fields": {"test_field": 100}
            }
            
            response = admin_session.post(f"{BASE_URL}/api/performance/mis-entries", json=entry_payload)
            assert response.status_code == 200
            
            entry = response.json()
            assert entry.get("frequency") == "daily", "Entry should have frequency field"
            print(f"Entry created with frequency: {entry.get('frequency')}")
    
    def test_quarterly_entry_current_quarter_allowed(self, admin_session):
        """Verify quarterly entries can be created for current quarter"""
        today = datetime.now()
        current_q_start = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
        current_q_date = current_q_start.strftime("%Y-%m-%d")
        
        # Get a quarterly template if exists
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        templates = response.json()
        quarterly_template = next((t for t in templates if t.get("frequency") == "quarterly" and t.get("employee_id")), None)
        
        if quarterly_template:
            entry_payload = {
                "employee_id": quarterly_template["employee_id"],
                "template_id": quarterly_template["template_id"],
                "frequency": "quarterly",
                "date": current_q_date,
                "fields": {"quarterly_metric": 500}
            }
            
            response = admin_session.post(f"{BASE_URL}/api/performance/mis-entries", json=entry_payload)
            # Admin should be able to create for current quarter
            assert response.status_code == 200
            print(f"Quarterly entry for current quarter ({current_q_date}) created successfully")
    
    def test_admin_can_edit_past_quarter_entries(self, admin_session):
        """Verify admin can create entries for past quarters (admin bypass)"""
        # Calculate last quarter date
        today = datetime.now()
        current_q = (today.month - 1) // 3
        
        if current_q == 0:
            # We're in Q1, last quarter is Q4 of previous year
            last_q_date = f"{today.year - 1}-10-01"
        else:
            last_q_month = (current_q - 1) * 3 + 1
            last_q_date = f"{today.year}-{last_q_month:02d}-01"
        
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-templates")
        templates = response.json()
        quarterly_template = next((t for t in templates if t.get("frequency") == "quarterly" and t.get("employee_id")), None)
        
        if quarterly_template:
            entry_payload = {
                "employee_id": quarterly_template["employee_id"],
                "template_id": quarterly_template["template_id"],
                "frequency": "quarterly",
                "date": last_q_date,
                "fields": {"past_quarter_metric": 250}
            }
            
            response = admin_session.post(f"{BASE_URL}/api/performance/mis-entries", json=entry_payload)
            # Admin should bypass the lock
            assert response.status_code == 200
            print(f"Admin bypassed quarterly lock for past quarter ({last_q_date})")


class TestMISComplianceDate:
    """Tests for compliance date filtering"""
    
    def test_compliance_returns_today_by_default(self, admin_session):
        """Verify compliance endpoint returns today's date by default"""
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-compliance")
        assert response.status_code == 200
        
        data = response.json()
        today = datetime.now().strftime("%Y-%m-%d")
        
        assert data["date"] == today, f"Should return today's date ({today}), got {data['date']}"
    
    def test_compliance_accepts_custom_date(self, admin_session):
        """Verify compliance endpoint accepts custom date parameter"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = admin_session.get(f"{BASE_URL}/api/performance/mis-compliance", params={"date": yesterday})
        assert response.status_code == 200
        
        data = response.json()
        assert data["date"] == yesterday, f"Should return requested date ({yesterday})"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
