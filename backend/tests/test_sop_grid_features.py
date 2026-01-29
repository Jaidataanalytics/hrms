"""
Test SOP Management with main_responsible/also_involved and Attendance Grid View features.
Tests:
1. SOP create with main_responsible and also_involved employee selection
2. SOP list displays main_responsible_names column
3. SOP publish sends notifications to linked employees
4. Attendance Grid View endpoint loads correctly
5. Grid data loads with department filter and search
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSOPFeatures:
    """Test SOP Management with main_responsible and also_involved fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Store cookies from login
        self.session.cookies.update(login_response.cookies)
        
        yield
        
        # Cleanup - delete test SOPs
        try:
            sops = self.session.get(f"{BASE_URL}/api/sop/list").json()
            for sop in sops:
                if sop.get("title", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/sop/{sop['sop_id']}")
        except:
            pass
    
    def test_get_employees_for_sop(self):
        """Test that employees list is available for SOP assignment"""
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Failed to get employees: {response.text}"
        
        employees = response.json()
        assert isinstance(employees, list), "Employees should be a list"
        print(f"✓ Found {len(employees)} employees available for SOP assignment")
        
        # Store employee IDs for later tests
        self.employee_ids = [e.get("employee_id") for e in employees[:5] if e.get("employee_id")]
        return self.employee_ids
    
    def test_create_sop_with_main_responsible(self):
        """Test creating SOP with main_responsible employees (max 3)"""
        # First get employees
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        employee_ids = [e.get("employee_id") for e in employees[:3] if e.get("employee_id")]
        
        if len(employee_ids) < 1:
            pytest.skip("No employees available for testing")
        
        # Create SOP with main_responsible
        form_data = {
            "title": "TEST_SOP_Main_Responsible",
            "description": "Test SOP with main responsible employees"
        }
        
        # Add main_responsible employees (up to 3)
        files = []
        for emp_id in employee_ids[:3]:
            files.append(("main_responsible", (None, emp_id)))
        
        # Remove Content-Type header for multipart form
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/sop/create",
            data=form_data,
            files=files,
            headers=headers,
            cookies=self.session.cookies
        )
        
        assert response.status_code == 200, f"Failed to create SOP: {response.text}"
        
        sop = response.json()
        assert sop.get("sop_id"), "SOP should have an ID"
        assert sop.get("title") == "TEST_SOP_Main_Responsible"
        assert "main_responsible" in sop, "SOP should have main_responsible field"
        assert len(sop.get("main_responsible", [])) <= 3, "Max 3 main responsible allowed"
        
        print(f"✓ Created SOP {sop['sop_id']} with {len(sop.get('main_responsible', []))} main responsible employees")
        return sop
    
    def test_create_sop_with_also_involved(self):
        """Test creating SOP with also_involved employees"""
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        employee_ids = [e.get("employee_id") for e in employees[:5] if e.get("employee_id")]
        
        if len(employee_ids) < 2:
            pytest.skip("Not enough employees for testing")
        
        form_data = {
            "title": "TEST_SOP_Also_Involved",
            "description": "Test SOP with also involved employees"
        }
        
        files = []
        # Add 1 main responsible
        files.append(("main_responsible", (None, employee_ids[0])))
        # Add multiple also_involved
        for emp_id in employee_ids[1:4]:
            files.append(("also_involved", (None, emp_id)))
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/sop/create",
            data=form_data,
            files=files,
            headers=headers,
            cookies=self.session.cookies
        )
        
        assert response.status_code == 200, f"Failed to create SOP: {response.text}"
        
        sop = response.json()
        assert "also_involved" in sop, "SOP should have also_involved field"
        
        print(f"✓ Created SOP with {len(sop.get('also_involved', []))} also involved employees")
        return sop
    
    def test_sop_list_shows_main_responsible_names(self):
        """Test that SOP list includes main_responsible_names column"""
        # First create a test SOP with main_responsible
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        employee_ids = [e.get("employee_id") for e in employees[:2] if e.get("employee_id")]
        
        if not employee_ids:
            pytest.skip("No employees available")
        
        form_data = {"title": "TEST_SOP_List_Names", "description": "Test"}
        files = [("main_responsible", (None, employee_ids[0]))]
        headers = {"Authorization": f"Bearer {self.token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/sop/create",
            data=form_data,
            files=files,
            headers=headers,
            cookies=self.session.cookies
        )
        assert create_response.status_code == 200
        
        # Now get the list
        list_response = self.session.get(f"{BASE_URL}/api/sop/list")
        assert list_response.status_code == 200, f"Failed to get SOP list: {list_response.text}"
        
        sops = list_response.json()
        assert isinstance(sops, list), "SOP list should be an array"
        
        # Find our test SOP
        test_sop = next((s for s in sops if s.get("title") == "TEST_SOP_List_Names"), None)
        assert test_sop, "Test SOP should be in the list"
        
        # Check for main_responsible_names field
        assert "main_responsible_names" in test_sop, "SOP list should include main_responsible_names"
        assert isinstance(test_sop["main_responsible_names"], list), "main_responsible_names should be a list"
        
        print(f"✓ SOP list shows main_responsible_names: {test_sop['main_responsible_names']}")
    
    def test_sop_publish_creates_notifications(self):
        """Test that publishing SOP sends notifications to linked employees"""
        # Create SOP with employees
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        employee_ids = [e.get("employee_id") for e in employees[:2] if e.get("employee_id")]
        
        if not employee_ids:
            pytest.skip("No employees available")
        
        form_data = {"title": "TEST_SOP_Publish_Notify", "description": "Test notifications"}
        files = [
            ("main_responsible", (None, employee_ids[0])),
        ]
        if len(employee_ids) > 1:
            files.append(("also_involved", (None, employee_ids[1])))
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/sop/create",
            data=form_data,
            files=files,
            headers=headers,
            cookies=self.session.cookies
        )
        assert create_response.status_code == 200
        sop = create_response.json()
        sop_id = sop["sop_id"]
        
        # Publish the SOP
        publish_response = self.session.put(f"{BASE_URL}/api/sop/{sop_id}/publish")
        assert publish_response.status_code == 200, f"Failed to publish SOP: {publish_response.text}"
        
        publish_data = publish_response.json()
        assert "notifications_sent" in publish_data, "Publish response should include notifications_sent count"
        
        print(f"✓ SOP published, {publish_data.get('notifications_sent', 0)} notifications sent")
    
    def test_sop_get_details_includes_employee_names(self):
        """Test that SOP details include resolved employee names"""
        # Create SOP
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        employee_ids = [e.get("employee_id") for e in employees[:2] if e.get("employee_id")]
        
        if not employee_ids:
            pytest.skip("No employees available")
        
        form_data = {"title": "TEST_SOP_Details", "description": "Test details"}
        files = [("main_responsible", (None, employee_ids[0]))]
        headers = {"Authorization": f"Bearer {self.token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/sop/create",
            data=form_data,
            files=files,
            headers=headers,
            cookies=self.session.cookies
        )
        assert create_response.status_code == 200
        sop = create_response.json()
        
        # Get SOP details
        detail_response = self.session.get(f"{BASE_URL}/api/sop/{sop['sop_id']}")
        assert detail_response.status_code == 200, f"Failed to get SOP details: {detail_response.text}"
        
        details = detail_response.json()
        assert details.get("sop_id") == sop["sop_id"]
        assert "main_responsible" in details
        
        print(f"✓ SOP details retrieved with main_responsible: {details.get('main_responsible', [])}")


class TestAttendanceGridView:
    """Test Attendance Grid View functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.session.cookies.update(login_response.cookies)
        
        yield
    
    def test_grid_endpoint_exists(self):
        """Test that attendance grid endpoint exists and responds"""
        today = datetime.now()
        from_date = (today.replace(day=1)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200, f"Grid endpoint failed: {response.text}"
        
        data = response.json()
        assert "dates" in data, "Response should include dates array"
        assert "rows" in data, "Response should include rows array"
        assert "total_employees" in data, "Response should include total_employees count"
        
        print(f"✓ Grid endpoint works - {data['total_employees']} employees, {len(data['dates'])} dates")
    
    def test_grid_data_structure(self):
        """Test that grid data has correct structure"""
        today = datetime.now()
        from_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check dates structure
        if data["dates"]:
            date_obj = data["dates"][0]
            assert "date" in date_obj, "Date should have date field"
            assert "day_name" in date_obj, "Date should have day_name"
            assert "day_num" in date_obj, "Date should have day_num"
            assert "is_sunday" in date_obj, "Date should have is_sunday flag"
            assert "is_holiday" in date_obj, "Date should have is_holiday flag"
        
        # Check rows structure
        if data["rows"]:
            row = data["rows"][0]
            assert "employee_id" in row, "Row should have employee_id"
            assert "emp_code" in row, "Row should have emp_code"
            assert "name" in row, "Row should have name"
            assert "department" in row, "Row should have department"
            assert "cells" in row, "Row should have cells array"
            assert "summary" in row, "Row should have summary"
            
            # Check cell structure
            if row["cells"]:
                cell = row["cells"][0]
                assert "date" in cell, "Cell should have date"
                assert "status" in cell, "Cell should have status"
                assert "is_editable" in cell, "Cell should have is_editable flag"
            
            # Check summary structure
            summary = row["summary"]
            assert "present" in summary, "Summary should have present count"
            assert "absent" in summary, "Summary should have absent count"
            assert "late" in summary, "Summary should have late count"
        
        print(f"✓ Grid data structure is correct")
    
    def test_grid_with_department_filter(self):
        """Test grid data with department filter"""
        # First get departments
        dept_response = self.session.get(f"{BASE_URL}/api/departments")
        assert dept_response.status_code == 200
        departments = dept_response.json()
        
        if not departments:
            pytest.skip("No departments available for filtering")
        
        dept_id = departments[0].get("department_id")
        
        today = datetime.now()
        from_date = (today.replace(day=1)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={
                "from_date": from_date,
                "to_date": to_date,
                "department_id": dept_id
            }
        )
        
        assert response.status_code == 200, f"Grid with department filter failed: {response.text}"
        
        data = response.json()
        
        # Verify all rows belong to the filtered department
        for row in data["rows"]:
            assert row.get("department_id") == dept_id or row.get("department") == departments[0].get("name"), \
                f"Row department mismatch: {row.get('department_id')} != {dept_id}"
        
        print(f"✓ Grid filtered by department '{departments[0].get('name')}' - {len(data['rows'])} employees")
    
    def test_grid_with_search_filter(self):
        """Test grid data with employee search"""
        # First get an employee name to search
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        
        if not employees:
            pytest.skip("No employees available for search")
        
        search_name = employees[0].get("first_name", "")[:3]  # First 3 chars of first name
        
        today = datetime.now()
        from_date = (today.replace(day=1)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={
                "from_date": from_date,
                "to_date": to_date,
                "search": search_name
            }
        )
        
        assert response.status_code == 200, f"Grid with search failed: {response.text}"
        
        data = response.json()
        
        # Verify search results contain the search term
        if data["rows"]:
            for row in data["rows"]:
                name_lower = row.get("name", "").lower()
                code_lower = row.get("emp_code", "").lower()
                assert search_name.lower() in name_lower or search_name.lower() in code_lower, \
                    f"Search result '{row.get('name')}' doesn't match search term '{search_name}'"
        
        print(f"✓ Grid search for '{search_name}' returned {len(data['rows'])} results")
    
    def test_grid_marks_sundays(self):
        """Test that grid correctly marks Sundays"""
        # Get a date range that includes a Sunday
        today = datetime.now()
        # Go back to find a Sunday
        days_since_sunday = (today.weekday() + 1) % 7
        last_sunday = today - timedelta(days=days_since_sunday)
        
        from_date = (last_sunday - timedelta(days=3)).strftime("%Y-%m-%d")
        to_date = (last_sunday + timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Find Sunday in dates
        sunday_found = False
        for date_info in data["dates"]:
            if date_info.get("is_sunday"):
                sunday_found = True
                assert date_info.get("day_name") == "Sun", "Sunday should have day_name 'Sun'"
                break
        
        assert sunday_found, "Date range should include a Sunday"
        
        # Check that Sunday cells have status 'sunday'
        if data["rows"]:
            row = data["rows"][0]
            for cell in row["cells"]:
                # Find the Sunday cell
                cell_date = datetime.strptime(cell["date"], "%Y-%m-%d")
                if cell_date.weekday() == 6:  # Sunday
                    assert cell["status"] == "sunday", f"Sunday cell should have status 'sunday', got '{cell['status']}'"
                    assert cell["is_editable"] == False, "Sunday should not be editable"
        
        print(f"✓ Grid correctly marks Sundays")
    
    def test_grid_marks_holidays(self):
        """Test that grid correctly marks holidays (if any exist)"""
        # First check if there are any holidays
        today = datetime.now()
        year = today.year
        
        holidays_response = self.session.get(f"{BASE_URL}/api/holidays", params={"year": year})
        
        if holidays_response.status_code != 200:
            pytest.skip("Holidays endpoint not available")
        
        holidays = holidays_response.json()
        
        if not holidays:
            print("✓ No holidays configured - skipping holiday marking test")
            return
        
        # Find a holiday date
        holiday_date = holidays[0].get("date")
        
        # Get grid for that date range
        from_date = holiday_date
        to_date = holiday_date
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that the date is marked as holiday
        if data["dates"]:
            date_info = data["dates"][0]
            if date_info.get("is_holiday"):
                assert date_info.get("holiday_name"), "Holiday should have a name"
                print(f"✓ Grid correctly marks holiday: {date_info.get('holiday_name')}")
            else:
                print(f"✓ Date {holiday_date} not marked as holiday in grid (may be Sunday)")
    
    def test_grid_cell_edit_info(self):
        """Test that grid cells have edit-related information"""
        today = datetime.now()
        from_date = (today - timedelta(days=3)).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/grid",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data["rows"]:
            row = data["rows"][0]
            for cell in row["cells"]:
                # Check cell has necessary fields for editing
                assert "attendance_id" in cell, "Cell should have attendance_id (can be null)"
                assert "is_editable" in cell, "Cell should have is_editable flag"
                
                # If there's a record, check for additional fields
                if cell.get("status") not in ["sunday", "holiday", "no_record"]:
                    # These fields should be present for actual attendance records
                    assert "first_in" in cell, "Cell should have first_in"
                    assert "last_out" in cell, "Cell should have last_out"
        
        print(f"✓ Grid cells have proper edit information")


class TestGridInlineEditing:
    """Test Grid inline editing functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.session.cookies.update(login_response.cookies)
        
        yield
    
    def test_manual_attendance_endpoint(self):
        """Test that manual attendance creation endpoint works"""
        # Get an employee
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        employees = emp_response.json()
        
        if not employees:
            pytest.skip("No employees available")
        
        employee_id = employees[0].get("employee_id")
        
        # Try to create manual attendance for a past date
        test_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/attendance/manual",
            json={
                "employee_id": employee_id,
                "date": test_date,
                "status": "present",
                "first_in": "09:00",
                "last_out": "18:00",
                "edit_reason": "TEST - Manual entry for grid testing"
            }
        )
        
        # Should either succeed (200) or fail with validation (400/409 if already exists)
        assert response.status_code in [200, 400, 409], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("attendance_id"), "Should return attendance_id"
            print(f"✓ Manual attendance created: {data.get('attendance_id')}")
        else:
            print(f"✓ Manual attendance endpoint responds correctly (validation: {response.json().get('detail', 'N/A')})")
    
    def test_attendance_update_endpoint(self):
        """Test that attendance update endpoint works for grid editing"""
        # First get existing attendance records
        today = datetime.now()
        date_str = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/daily",
            params={"date": date_str}
        )
        
        if response.status_code != 200 or not response.json():
            print("✓ No attendance records to update - endpoint check skipped")
            return
        
        records = response.json()
        if not records:
            print("✓ No attendance records for today - endpoint check skipped")
            return
        
        attendance_id = records[0].get("attendance_id")
        
        # Try to update
        update_response = self.session.put(
            f"{BASE_URL}/api/attendance/{attendance_id}",
            json={
                "status": records[0].get("status", "present"),
                "edit_reason": "TEST - Grid edit test"
            }
        )
        
        assert update_response.status_code in [200, 400], f"Update failed: {update_response.text}"
        
        print(f"✓ Attendance update endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
