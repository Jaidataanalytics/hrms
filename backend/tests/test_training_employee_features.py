"""
Test Training Programs CRUD, Enrollment Management, and Employee Activate/Deactivate/Delete features
Testing for iteration 42
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data to track for cleanup
test_data = {
    "programs": [],
    "employees": [],
    "enrollments": []
}


class TestLoginAndAuth:
    """Test authentication"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@shardahr.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data["user"]["role"] == "super_admin", f"Expected super_admin role, got {data['user']['role']}"
        print(f"✓ Admin login successful, role: {data['user']['role']}")


@pytest.fixture(scope="class")
def auth_token():
    """Get auth token for authenticated requests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@shardahr.com",
        "password": "password"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture(scope="class")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestTrainingProgramsCRUD:
    """Test Training Programs CRUD operations"""
    
    def test_list_training_programs(self, auth_headers):
        """Test listing training programs"""
        response = requests.get(f"{BASE_URL}/api/training/programs", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list programs: {response.text}"
        programs = response.json()
        assert isinstance(programs, list), "Expected list of programs"
        print(f"✓ Listed {len(programs)} training programs")
    
    def test_create_training_program(self, auth_headers):
        """Test creating a new training program"""
        program_data = {
            "name": f"TEST_Program_{uuid.uuid4().hex[:8]}",
            "description": "Test training program for automated testing",
            "category": "technical",
            "trainer": "Test Trainer",
            "start_date": "2026-02-15",
            "end_date": "2026-02-20",
            "location": "Online",
            "max_participants": 25
        }
        
        response = requests.post(f"{BASE_URL}/api/training/programs", 
                                 headers=auth_headers, json=program_data)
        assert response.status_code == 200, f"Failed to create program: {response.text}"
        created = response.json()
        assert "program_id" in created, "No program_id in response"
        assert created["name"] == program_data["name"], "Program name mismatch"
        
        # Store for cleanup and further tests
        test_data["programs"].append(created["program_id"])
        print(f"✓ Created training program: {created['program_id']}")
        return created["program_id"]
    
    def test_get_training_program_details(self, auth_headers):
        """Test getting program details with enrollments"""
        if not test_data["programs"]:
            pytest.skip("No test program created")
        
        program_id = test_data["programs"][0]
        response = requests.get(f"{BASE_URL}/api/training/programs/{program_id}", 
                               headers=auth_headers)
        assert response.status_code == 200, f"Failed to get program: {response.text}"
        program = response.json()
        assert program["program_id"] == program_id, "Program ID mismatch"
        assert "enrollments" in program, "No enrollments field in program details"
        print(f"✓ Got program details: {program['name']}, enrollments: {len(program.get('enrollments', []))}")
    
    def test_update_training_program(self, auth_headers):
        """Test updating a training program"""
        if not test_data["programs"]:
            pytest.skip("No test program created")
        
        program_id = test_data["programs"][0]
        update_data = {
            "name": f"UPDATED_Program_{uuid.uuid4().hex[:8]}",
            "description": "Updated description for testing",
            "max_participants": 50
        }
        
        response = requests.put(f"{BASE_URL}/api/training/programs/{program_id}", 
                               headers=auth_headers, json=update_data)
        assert response.status_code == 200, f"Failed to update program: {response.text}"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/training/programs/{program_id}", 
                                   headers=auth_headers)
        assert get_response.status_code == 200
        updated = get_response.json()
        assert updated["name"] == update_data["name"], "Update didn't persist"
        print(f"✓ Updated training program: {program_id}")
    
    def test_delete_training_program(self, auth_headers):
        """Test deleting a training program (soft delete)"""
        # Create a program specifically for deletion test
        program_data = {
            "name": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}",
            "description": "Program to be deleted",
            "category": "compliance"
        }
        create_response = requests.post(f"{BASE_URL}/api/training/programs", 
                                        headers=auth_headers, json=program_data)
        assert create_response.status_code == 200, f"Failed to create program: {create_response.text}"
        program_id = create_response.json()["program_id"]
        
        # Delete the program
        delete_response = requests.delete(f"{BASE_URL}/api/training/programs/{program_id}", 
                                          headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete program: {delete_response.text}"
        
        # Verify it's no longer in active list
        list_response = requests.get(f"{BASE_URL}/api/training/programs", headers=auth_headers)
        programs = list_response.json()
        program_ids = [p["program_id"] for p in programs]
        assert program_id not in program_ids, "Deleted program still in active list"
        print(f"✓ Deleted training program: {program_id}")


class TestEnrollmentManagement:
    """Test enrollment operations for training programs"""
    
    def test_enroll_employee_in_program(self, auth_headers):
        """Test enrolling an employee in a training program"""
        # First, get list of employees to enroll
        emp_response = requests.get(f"{BASE_URL}/api/employees?limit=10", headers=auth_headers)
        assert emp_response.status_code == 200, f"Failed to get employees: {emp_response.text}"
        employees = emp_response.json()
        
        if not employees:
            pytest.skip("No employees available for enrollment test")
        
        employee_id = employees[0]["employee_id"]
        
        # Create a program if none exists
        if not test_data["programs"]:
            program_data = {
                "name": f"TEST_EnrollmentProgram_{uuid.uuid4().hex[:8]}",
                "category": "technical"
            }
            create_response = requests.post(f"{BASE_URL}/api/training/programs", 
                                           headers=auth_headers, json=program_data)
            assert create_response.status_code == 200
            test_data["programs"].append(create_response.json()["program_id"])
        
        program_id = test_data["programs"][0]
        
        # Enroll employee
        enrollment_data = {
            "program_id": program_id,
            "employee_id": employee_id
        }
        response = requests.post(f"{BASE_URL}/api/training/enrollments", 
                                headers=auth_headers, json=enrollment_data)
        assert response.status_code == 200, f"Failed to enroll employee: {response.text}"
        enrollment = response.json()
        assert "enrollment_id" in enrollment, "No enrollment_id in response"
        assert enrollment["status"] == "enrolled", f"Expected enrolled status, got {enrollment['status']}"
        
        test_data["enrollments"].append(enrollment["enrollment_id"])
        print(f"✓ Enrolled employee {employee_id} in program {program_id}")
        return enrollment["enrollment_id"]
    
    def test_get_program_with_enrollments(self, auth_headers):
        """Test that program details include enrollments"""
        if not test_data["programs"]:
            pytest.skip("No test program created")
        
        program_id = test_data["programs"][0]
        response = requests.get(f"{BASE_URL}/api/training/programs/{program_id}", 
                               headers=auth_headers)
        assert response.status_code == 200
        program = response.json()
        assert "enrollments" in program, "No enrollments in program response"
        print(f"✓ Program has {len(program['enrollments'])} enrollments")
    
    def test_remove_enrollment(self, auth_headers):
        """Test removing an employee from a training program"""
        if not test_data["enrollments"]:
            # Create an enrollment first
            self.test_enroll_employee_in_program(auth_headers)
        
        if not test_data["enrollments"]:
            pytest.skip("No enrollments to remove")
        
        enrollment_id = test_data["enrollments"][0]
        
        # Remove enrollment
        response = requests.delete(f"{BASE_URL}/api/training/enrollments/{enrollment_id}", 
                                  headers=auth_headers)
        assert response.status_code == 200, f"Failed to remove enrollment: {response.text}"
        
        test_data["enrollments"].remove(enrollment_id)
        print(f"✓ Removed enrollment: {enrollment_id}")


class TestEmployeeActivateDeactivate:
    """Test employee activate/deactivate/delete operations"""
    
    def test_create_test_employee(self, auth_headers):
        """Create a test employee for activation tests"""
        employee_data = {
            "first_name": "TEST",
            "last_name": f"Employee_{uuid.uuid4().hex[:6]}",
            "email": f"test_{uuid.uuid4().hex[:6]}@test.com",
            "phone": "+91 98765 43210",
            "employment_type": "management"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", 
                                headers=auth_headers, json=employee_data)
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        employee = response.json()
        assert "employee_id" in employee, "No employee_id in response"
        
        test_data["employees"].append(employee["employee_id"])
        print(f"✓ Created test employee: {employee['employee_id']}")
        return employee["employee_id"]
    
    def test_deactivate_employee(self, auth_headers):
        """Test deactivating an employee"""
        if not test_data["employees"]:
            self.test_create_test_employee(auth_headers)
        
        employee_id = test_data["employees"][0]
        
        # Deactivate (soft delete without permanent flag)
        response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", 
                                  headers=auth_headers)
        assert response.status_code == 200, f"Failed to deactivate employee: {response.text}"
        result = response.json()
        assert "deactivated" in result.get("message", "").lower(), f"Unexpected response: {result}"
        
        # Verify employee is inactive
        get_response = requests.get(f"{BASE_URL}/api/employees/{employee_id}", 
                                   headers=auth_headers)
        if get_response.status_code == 200:
            employee = get_response.json()
            assert employee.get("status") == "inactive" or employee.get("is_active") == False, \
                f"Employee not deactivated: {employee}"
        
        print(f"✓ Deactivated employee: {employee_id}")
    
    def test_activate_employee(self, auth_headers):
        """Test activating a deactivated employee"""
        if not test_data["employees"]:
            pytest.skip("No test employees available")
        
        employee_id = test_data["employees"][0]
        
        # Activate employee
        response = requests.post(f"{BASE_URL}/api/employees/{employee_id}/activate", 
                                headers=auth_headers)
        assert response.status_code == 200, f"Failed to activate employee: {response.text}"
        result = response.json()
        assert "activated" in result.get("message", "").lower(), f"Unexpected response: {result}"
        
        # Verify employee is active
        get_response = requests.get(f"{BASE_URL}/api/employees/{employee_id}", 
                                   headers=auth_headers)
        assert get_response.status_code == 200
        employee = get_response.json()
        assert employee.get("status") == "active" and employee.get("is_active") == True, \
            f"Employee not activated: {employee}"
        
        print(f"✓ Activated employee: {employee_id}")
    
    def test_permanent_delete_employee(self, auth_headers):
        """Test permanently deleting an employee"""
        # Create a new employee specifically for permanent deletion
        employee_data = {
            "first_name": "DELETE",
            "last_name": f"Permanent_{uuid.uuid4().hex[:6]}",
            "email": f"delete_{uuid.uuid4().hex[:6]}@test.com",
            "employment_type": "management"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/employees", 
                                        headers=auth_headers, json=employee_data)
        assert create_response.status_code == 200
        employee_id = create_response.json()["employee_id"]
        
        # Permanently delete
        response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}?permanent=true", 
                                  headers=auth_headers)
        assert response.status_code == 200, f"Failed to permanently delete: {response.text}"
        
        # Verify employee no longer exists
        get_response = requests.get(f"{BASE_URL}/api/employees/{employee_id}", 
                                   headers=auth_headers)
        assert get_response.status_code == 404, f"Deleted employee still exists: {get_response.text}"
        
        print(f"✓ Permanently deleted employee: {employee_id}")
    
    def test_list_inactive_employees(self, auth_headers):
        """Test listing inactive employees via status filter"""
        # First deactivate an employee if we have one
        if test_data["employees"]:
            employee_id = test_data["employees"][0]
            # Ensure it's deactivated
            requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=auth_headers)
        
        # List inactive employees
        response = requests.get(f"{BASE_URL}/api/employees?status=inactive", 
                               headers=auth_headers)
        assert response.status_code == 200, f"Failed to list inactive employees: {response.text}"
        employees = response.json()
        
        # All returned employees should be inactive
        for emp in employees:
            assert emp.get("status") == "inactive" or emp.get("is_active") == False, \
                f"Active employee in inactive list: {emp}"
        
        print(f"✓ Listed {len(employees)} inactive employees")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, auth_headers):
        """Clean up all test data created during testing"""
        # Cleanup programs
        for program_id in test_data["programs"]:
            try:
                requests.delete(f"{BASE_URL}/api/training/programs/{program_id}", 
                               headers=auth_headers)
                print(f"  Cleaned up program: {program_id}")
            except Exception:
                pass
        
        # Cleanup employees  
        for employee_id in test_data["employees"]:
            try:
                requests.delete(f"{BASE_URL}/api/employees/{employee_id}?permanent=true", 
                               headers=auth_headers)
                print(f"  Cleaned up employee: {employee_id}")
            except Exception:
                pass
        
        print("✓ Test cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
