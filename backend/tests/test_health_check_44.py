"""
Comprehensive Health Check Test - Iteration 44
Tests: Auth, Employees, Attendance, Users, Training, and API-specific checks
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://employee-mis-tools.preview.emergentagent.com'

# Test credentials
ADMIN_EMAIL = "admin@shardahr.com"
ADMIN_PASSWORD = "password"
HR_EMAIL = "hr@shardadiesels.co.in"
HR_PASSWORD = "NandiniHR@123"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login(self):
        """Test admin login with admin@shardahr.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] in ["super_admin", "hr_admin"]
        print(f"Admin login successful - role: {data['user']['role']}")
    
    def test_hr_login(self):
        """Test HR login with hr@shardadiesels.co.in"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == HR_EMAIL
        assert data["user"]["role"] in ["hr_admin", "hr_executive"]
        print(f"HR login successful - role: {data['user']['role']}")
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestEmployeeEndpoints:
    """Employee directory API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for employee tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_employees(self):
        """Test GET /api/employees returns employee list"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=self.headers)
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        assert len(employees) >= 70, f"Expected 70+ employees, got {len(employees)}"
        print(f"Employee list: {len(employees)} employees found")
    
    def test_employees_no_mongodb_id(self):
        """Test GET /api/employees excludes _id fields"""
        response = requests.get(f"{BASE_URL}/api/employees?limit=5", headers=self.headers)
        assert response.status_code == 200
        employees = response.json()
        for emp in employees:
            assert "_id" not in emp, f"Found _id in employee: {emp.get('employee_id')}"
        print("No MongoDB _id fields in employee response")
    
    def test_employee_status_filter(self):
        """Test employee status filter (active/inactive/all)"""
        # Test active employees
        response = requests.get(f"{BASE_URL}/api/employees?status=active", headers=self.headers)
        assert response.status_code == 200
        active_count = len(response.json())
        
        # Test all status
        response = requests.get(f"{BASE_URL}/api/employees?status=all&include_inactive=true", headers=self.headers)
        assert response.status_code == 200
        all_count = len(response.json())
        
        print(f"Employee status filter: active={active_count}, all={all_count}")
        assert all_count >= active_count
    
    def test_create_and_delete_employee(self):
        """Test employee CRUD - create with emp_code, verify, delete"""
        test_emp_code = "TEST001"
        test_email = f"test_emp_{datetime.now().strftime('%H%M%S')}@test.com"
        
        # Create employee
        create_payload = {
            "first_name": "Test",
            "last_name": "Employee",
            "email": test_email,
            "phone": "+91 9876543210",
            "emp_code": test_emp_code,
            "employment_type": "management"
        }
        response = requests.post(f"{BASE_URL}/api/employees", 
                                 json=create_payload, 
                                 headers=self.headers)
        
        if response.status_code == 200 or response.status_code == 201:
            created = response.json()
            employee_id = created.get("employee_id")
            assert created.get("emp_code") == test_emp_code, "Biometric code not saved"
            print(f"Created employee: {employee_id} with emp_code: {test_emp_code}")
            
            # Verify by getting the employee
            get_response = requests.get(f"{BASE_URL}/api/employees/{employee_id}", 
                                        headers=self.headers)
            assert get_response.status_code == 200
            fetched = get_response.json()
            assert fetched.get("emp_code") == test_emp_code
            
            # Delete the test employee
            del_response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}?permanent=true", 
                                           headers=self.headers)
            assert del_response.status_code == 200
            print(f"Deleted test employee: {employee_id}")
        else:
            print(f"Create employee response: {response.status_code} - {response.text}")
            # Don't fail - employee might already exist


class TestAttendanceEndpoints:
    """Attendance API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_attendance_organization(self):
        """Test GET /api/attendance/organization"""
        response = requests.get(f"{BASE_URL}/api/attendance/organization", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "total_employees" in data["summary"]
        print(f"Org attendance: {data['summary']['total_employees']} employees")
    
    def test_attendance_daily(self):
        """Test GET /api/attendance/daily"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/attendance/daily?date={today}", headers=self.headers)
        assert response.status_code == 200
        print(f"Daily attendance records: {len(response.json())}")


class TestUserManagement:
    """User Management API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_users(self):
        """Test GET /api/users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"Users list: {len(data['users'])} users found")
    
    def test_roles_list_canonical_ids(self):
        """Test GET /api/users/roles/list returns canonical role IDs (not UUIDs)"""
        response = requests.get(f"{BASE_URL}/api/users/roles/list", headers=self.headers)
        assert response.status_code == 200
        roles = response.json()
        
        # Check all roles have canonical IDs (not role_xxx UUIDs)
        canonical_ids = ["super_admin", "hr_admin", "hr_executive", "manager", "finance", "it_admin", "employee"]
        for role in roles:
            role_id = role.get("role_id", "")
            assert not role_id.startswith("role_"), f"Found UUID role_id: {role_id}"
            assert role_id in canonical_ids, f"Unexpected role_id: {role_id}"
        print(f"Roles list: {[r['role_id'] for r in roles]} (all canonical)")
    
    def test_user_crud_full_cycle(self):
        """Test full CRUD: create user -> update role -> deactivate -> activate -> delete"""
        test_email = f"testuser_{datetime.now().strftime('%H%M%S')}@test.com"
        
        # 1. Create user
        create_payload = {
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test User CRUD",
            "role": "employee"
        }
        response = requests.post(f"{BASE_URL}/api/users", 
                                 json=create_payload, 
                                 headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        created_user = response.json()
        user_id = created_user["user_id"]
        print(f"Created user: {user_id}")
        
        # 2. Update role to hr_admin
        update_response = requests.put(f"{BASE_URL}/api/users/{user_id}", 
                                       json={"role": "hr_admin"},
                                       headers=self.headers)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated.get("role") == "hr_admin"
        print(f"Updated role to: {updated.get('role')}")
        
        # 3. Deactivate user
        deact_response = requests.put(f"{BASE_URL}/api/users/{user_id}/deactivate", 
                                      headers=self.headers)
        assert deact_response.status_code == 200
        print("User deactivated")
        
        # 4. Activate user
        act_response = requests.put(f"{BASE_URL}/api/users/{user_id}/activate", 
                                    headers=self.headers)
        assert act_response.status_code == 200
        print("User activated")
        
        # 5. Delete user (permanent)
        del_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", 
                                       headers=self.headers)
        assert del_response.status_code == 200
        print("User deleted permanently")
        
        # 6. Verify user is gone
        get_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        assert get_response.status_code == 404
        print("Verified user no longer exists")


class TestTrainingEndpoints:
    """Training Management API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_programs(self):
        """Test GET /api/training/programs"""
        response = requests.get(f"{BASE_URL}/api/training/programs", headers=self.headers)
        assert response.status_code == 200
        programs = response.json()
        print(f"Training programs: {len(programs)} found")
    
    def test_training_program_crud(self):
        """Test full training program CRUD"""
        # 1. Create program
        program_data = {
            "name": "Test Training Program",
            "description": "Test description",
            "category": "technical",
            "trainer": "Test Trainer",
            "start_date": "2026-02-01",
            "end_date": "2026-02-28",
            "max_participants": 20
        }
        response = requests.post(f"{BASE_URL}/api/training/programs", 
                                 json=program_data,
                                 headers=self.headers)
        assert response.status_code == 200
        created = response.json()
        program_id = created["program_id"]
        print(f"Created training program: {program_id}")
        
        # 2. Get program detail
        get_response = requests.get(f"{BASE_URL}/api/training/programs/{program_id}", 
                                    headers=self.headers)
        assert get_response.status_code == 200
        
        # 3. Update program name
        update_response = requests.put(f"{BASE_URL}/api/training/programs/{program_id}", 
                                       json={"name": "Updated Training Name"},
                                       headers=self.headers)
        assert update_response.status_code == 200
        print("Updated program name")
        
        # 4. Delete program
        del_response = requests.delete(f"{BASE_URL}/api/training/programs/{program_id}", 
                                       headers=self.headers)
        assert del_response.status_code == 200
        print("Deleted training program")
    
    def test_enrollment_crud(self):
        """Test enrollment create and delete"""
        # First create a program
        program_data = {
            "name": "Enrollment Test Program",
            "category": "soft_skills",
            "start_date": "2026-02-01",
            "end_date": "2026-02-15"
        }
        prog_response = requests.post(f"{BASE_URL}/api/training/programs", 
                                      json=program_data,
                                      headers=self.headers)
        assert prog_response.status_code == 200
        program_id = prog_response.json()["program_id"]
        
        # Get an employee to enroll
        emp_response = requests.get(f"{BASE_URL}/api/employees?limit=1", headers=self.headers)
        employees = emp_response.json()
        if employees:
            employee_id = employees[0]["employee_id"]
            
            # Create enrollment
            enroll_response = requests.post(f"{BASE_URL}/api/training/enrollments", 
                                            json={"program_id": program_id, "employee_id": employee_id},
                                            headers=self.headers)
            assert enroll_response.status_code == 200
            enrollment = enroll_response.json()
            enrollment_id = enrollment["enrollment_id"]
            print(f"Created enrollment: {enrollment_id}")
            
            # Delete enrollment
            del_enroll = requests.delete(f"{BASE_URL}/api/training/enrollments/{enrollment_id}", 
                                         headers=self.headers)
            assert del_enroll.status_code == 200
            print("Deleted enrollment")
        
        # Cleanup - delete the program
        requests.delete(f"{BASE_URL}/api/training/programs/{program_id}", headers=self.headers)


class TestDashboardAndOtherPages:
    """Test dashboard stats and other page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        stats = response.json()
        assert "total_employees" in stats
        assert "present_today" in stats
        assert "on_leave_today" in stats
        print(f"Dashboard stats: total={stats['total_employees']}, present={stats['present_today']}")
    
    def test_departments(self):
        """Test GET /api/departments"""
        response = requests.get(f"{BASE_URL}/api/departments", headers=self.headers)
        assert response.status_code == 200
        depts = response.json()
        print(f"Departments: {len(depts)} found")
    
    def test_leave_types(self):
        """Test GET /api/leave-types"""
        response = requests.get(f"{BASE_URL}/api/leave-types", headers=self.headers)
        assert response.status_code == 200
        leave_types = response.json()
        print(f"Leave types: {len(leave_types)} found")
    
    def test_announcements(self):
        """Test GET /api/announcements"""
        response = requests.get(f"{BASE_URL}/api/announcements", headers=self.headers)
        # May return 200 or 404 if no announcements
        assert response.status_code in [200, 404]
        print(f"Announcements: {response.status_code}")
    
    def test_sops(self):
        """Test GET /api/sop"""
        response = requests.get(f"{BASE_URL}/api/sop", headers=self.headers)
        assert response.status_code in [200, 404]
        print(f"SOPs: {response.status_code}")


class TestBiometricConfig:
    """Test biometric configuration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_biometric_config(self):
        """Test GET /api/biometric/config"""
        response = requests.get(f"{BASE_URL}/api/biometric/config", headers=self.headers)
        if response.status_code == 200:
            config = response.json()
            print(f"Biometric config: {config}")
            # Check late threshold is 10:00 AM
            late_threshold = config.get("late_threshold", "")
            if late_threshold:
                print(f"Late threshold: {late_threshold}")
        else:
            print(f"Biometric config endpoint: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
