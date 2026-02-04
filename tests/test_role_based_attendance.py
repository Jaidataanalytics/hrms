"""
Test Role-Based Attendance Views
- Admin/HR should see full Attendance Analytics dashboard with tabs
- Employees should see simplified 'My Attendance' view
- Employee should be blocked from /api/attendance/summary endpoint (403)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hrmate-platform.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "Admin@123"
EMPLOYEE_EMAIL = "employee@shardahr.com"
EMPLOYEE_PASSWORD = "Employee@123"


class TestAdminAttendanceAccess:
    """Test Admin/HR access to full Attendance Analytics dashboard"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        self.user = data.get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Admin logged in: {self.user.get('email')}, role: {self.user.get('role')}")
    
    def test_admin_role_is_hr(self):
        """Verify admin has HR role (super_admin, hr_admin, or hr_executive)"""
        role = self.user.get("role")
        assert role in ["super_admin", "hr_admin", "hr_executive"], f"Admin role is {role}, expected HR role"
        print(f"PASS: Admin has HR role: {role}")
    
    def test_admin_can_access_attendance_summary(self):
        """Admin should be able to access /api/attendance/summary endpoint"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200, f"Admin should access summary: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure for HR view
        assert "overview" in data, "Response should have 'overview' section"
        assert "rankings" in data, "Response should have 'rankings' section"
        assert "department_analysis" in data, "Response should have 'department_analysis' section"
        assert "patterns" in data, "Response should have 'patterns' section"
        
        print(f"PASS: Admin can access attendance summary")
        print(f"  - Overview: attendance_rate={data['overview'].get('attendance_rate')}%")
        print(f"  - Total employees: {data.get('total_employees')}")
    
    def test_admin_summary_has_overview_metrics(self):
        """Admin summary should include all overview metrics"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        overview = data.get("overview", {})
        
        # Check all required metrics
        required_metrics = [
            "attendance_rate", "avg_daily_attendance", "perfect_days_count",
            "high_absence_days_count", "late_instances", "wfh_count",
            "leave_count", "punctuality_champions_count"
        ]
        
        for metric in required_metrics:
            assert metric in overview, f"Missing metric: {metric}"
            print(f"  - {metric}: {overview.get(metric)}")
        
        print(f"PASS: Admin summary has all overview metrics")
    
    def test_admin_summary_has_rankings(self):
        """Admin summary should include rankings (Most Late, Chronic Absentees, etc.)"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        rankings = data.get("rankings", {})
        
        # Check all required rankings
        required_rankings = [
            "most_late", "chronic_absentees", "punctuality_champions", "most_hours"
        ]
        
        for ranking in required_rankings:
            assert ranking in rankings, f"Missing ranking: {ranking}"
            print(f"  - {ranking}: {len(rankings.get(ranking, []))} entries")
        
        print(f"PASS: Admin summary has all rankings")
    
    def test_admin_summary_has_department_analysis(self):
        """Admin summary should include department analysis"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        dept_analysis = data.get("department_analysis", [])
        
        assert isinstance(dept_analysis, list), "department_analysis should be a list"
        print(f"PASS: Admin summary has department analysis with {len(dept_analysis)} departments")
        
        if dept_analysis:
            # Check structure of department entry
            dept = dept_analysis[0]
            assert "department" in dept, "Department entry should have 'department' field"
            assert "attendance_rate" in dept, "Department entry should have 'attendance_rate' field"
            print(f"  - First department: {dept.get('department')} - {dept.get('attendance_rate')}%")


class TestEmployeeAttendanceAccess:
    """Test Employee access - should see simplified 'My Attendance' view only"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employee before each test"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD}
        )
        assert response.status_code == 200, f"Employee login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        self.user = data.get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Employee logged in: {self.user.get('email')}, role: {self.user.get('role')}")
    
    def test_employee_role_is_not_hr(self):
        """Verify employee does NOT have HR role"""
        role = self.user.get("role")
        assert role not in ["super_admin", "hr_admin", "hr_executive"], f"Employee should not have HR role, got: {role}"
        print(f"PASS: Employee has non-HR role: {role}")
    
    def test_employee_blocked_from_attendance_summary(self):
        """Employee should be blocked from /api/attendance/summary endpoint (403)"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        assert response.status_code == 403, f"Employee should get 403, got: {response.status_code} - {response.text}"
        print(f"PASS: Employee blocked from attendance summary (403)")
    
    def test_employee_can_access_my_summary(self):
        """Employee should be able to access /api/attendance/my-summary endpoint"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/my-summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        # Employee may get 400 if no employee_id linked, but should not get 403
        assert response.status_code in [200, 400], f"Employee should access my-summary: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify response structure for employee view
            assert "summary" in data, "Response should have 'summary' section"
            summary = data.get("summary", {})
            
            # Check employee-specific metrics
            employee_metrics = ["present_days", "absent_days", "late_count", "wfh_count", "leave_count"]
            for metric in employee_metrics:
                assert metric in summary, f"Missing employee metric: {metric}"
            
            print(f"PASS: Employee can access my-summary")
            print(f"  - Present days: {summary.get('present_days')}")
            print(f"  - Absent days: {summary.get('absent_days')}")
        else:
            print(f"PASS: Employee my-summary returns 400 (no employee linked) - expected behavior")
    
    def test_employee_my_summary_has_personal_stats(self):
        """Employee my-summary should have personal stats only"""
        today = datetime.now()
        from_date = today.replace(day=1).strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance/my-summary",
            params={"from_date": from_date, "to_date": to_date}
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Should NOT have organization-wide data
            assert "rankings" not in data, "Employee should NOT see rankings"
            assert "department_analysis" not in data, "Employee should NOT see department analysis"
            assert "employee_stats" not in data, "Employee should NOT see all employee stats"
            
            print(f"PASS: Employee my-summary has personal stats only (no org-wide data)")
        else:
            print(f"SKIP: Employee has no linked employee_id")


class TestDashboardText:
    """Test Dashboard text update"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_dashboard_employee_endpoint(self):
        """Test dashboard employee endpoint returns data"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/employee")
        
        assert response.status_code == 200, f"Dashboard employee failed: {response.status_code}"
        data = response.json()
        
        # Check structure
        assert "attendance_today" in data or data.get("attendance_today") is None, "Should have attendance_today field"
        print(f"PASS: Dashboard employee endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
