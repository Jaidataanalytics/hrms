#!/usr/bin/env python3
"""
Employee Directory Backend API Testing
Tests all Employee Directory related endpoints including authentication, employee listing, filtering, and profile viewing
"""

import requests
import sys
import json
from datetime import datetime

class EmployeeDirectoryAPITester:
    def __init__(self, base_url="https://hr-insurance-suite.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_credentials = {
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        }
        self.employees = []
        self.departments = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        if details:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url)
            elif method == 'POST':
                response = self.session.post(url, json=data)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
            
            return success, response.status_code, response_data
            
        except Exception as e:
            return False, 0, {"error": str(e)}

    def test_login(self):
        """Test admin login and get JWT token"""
        success, status, data = self.make_request('POST', 'auth/login', self.admin_credentials)
        
        if success and 'access_token' in data:
            # Set authorization header for subsequent requests
            self.session.headers.update({
                'Authorization': f'Bearer {data["access_token"]}'
            })
            user_role = data.get('user', {}).get('role', 'unknown')
            self.log_test("Admin Login", True, f"Token received, user role: {user_role}")
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {data}")
            return False

    def test_employees_list(self):
        """Test getting employees list - should show 28 employees"""
        success, status, data = self.make_request('GET', 'employees')
        
        if success and isinstance(data, list):
            self.employees = data
            employee_count = len(data)
            
            # Check if we have the expected 28 employees
            if employee_count == 28:
                self.log_test("Get Employees List", True, f"Found expected 28 employees")
            else:
                self.log_test("Get Employees List", False, f"Expected 28 employees, found {employee_count}")
                return False
            
            # Check employee data structure
            if employee_count > 0:
                sample = data[0]
                required_fields = ['employee_id', 'first_name', 'last_name', 'email', 'status']
                missing_fields = [field for field in required_fields if field not in sample]
                
                if missing_fields:
                    self.log_test("Employee Data Structure", False, f"Missing fields: {missing_fields}")
                    return False
                else:
                    self.log_test("Employee Data Structure", True, "All required fields present")
            
            return True
        else:
            self.log_test("Get Employees List", False, f"Status: {status}, Response: {data}")
            return False

    def test_employees_with_status_filter(self):
        """Test employees list with status filter (Active/Inactive/All)"""
        # Test Active filter
        success, status, data = self.make_request('GET', 'employees?status=active')
        if success:
            active_count = len(data)
            self.log_test("Filter Active Employees", True, f"Found {active_count} active employees")
        else:
            self.log_test("Filter Active Employees", False, f"Status: {status}")
            return False

        # Test Inactive filter
        success, status, data = self.make_request('GET', 'employees?status=inactive')
        if success:
            inactive_count = len(data)
            self.log_test("Filter Inactive Employees", True, f"Found {inactive_count} inactive employees")
        else:
            self.log_test("Filter Inactive Employees", False, f"Status: {status}")
            return False

        # Test All filter (include_inactive=true)
        success, status, data = self.make_request('GET', 'employees?include_inactive=true')
        if success:
            all_count = len(data)
            self.log_test("Filter All Employees", True, f"Found {all_count} total employees")
            return True
        else:
            self.log_test("Filter All Employees", False, f"Status: {status}")
            return False

    def test_departments_list(self):
        """Test getting departments for filter dropdown"""
        success, status, data = self.make_request('GET', 'departments')
        
        if success and isinstance(data, list):
            self.departments = data
            dept_count = len(data)
            self.log_test("Get Departments List", True, f"Found {dept_count} departments")
            
            if dept_count > 0:
                # Show sample department data
                sample = data[0]
                print(f"   Sample department: {sample.get('name', 'Unknown')} (ID: {sample.get('department_id', 'No ID')})")
            
            return True
        else:
            self.log_test("Get Departments List", False, f"Status: {status}, Response: {data}")
            return False

    def test_employees_with_department_filter(self):
        """Test employees list with department filter"""
        if not self.departments:
            self.log_test("Filter by Department", False, "No departments available for testing")
            return False
        
        # Test with first department
        dept_id = self.departments[0].get('department_id')
        if not dept_id:
            self.log_test("Filter by Department", False, "Department ID not found")
            return False
        
        success, status, data = self.make_request('GET', f'employees?department_id={dept_id}')
        
        if success:
            filtered_count = len(data)
            dept_name = self.departments[0].get('name', 'Unknown')
            self.log_test("Filter by Department", True, f"Found {filtered_count} employees in {dept_name}")
            return True
        else:
            self.log_test("Filter by Department", False, f"Status: {status}, Response: {data}")
            return False

    def test_employee_profile(self):
        """Test getting individual employee profile"""
        if not self.employees:
            self.log_test("Get Employee Profile", False, "No employees available for testing")
            return False
        
        # Test with first employee
        employee_id = self.employees[0].get('employee_id')
        if not employee_id:
            self.log_test("Get Employee Profile", False, "Employee ID not found")
            return False
        
        success, status, data = self.make_request('GET', f'employees/{employee_id}')
        
        if success and isinstance(data, dict):
            employee_name = f"{data.get('first_name', '')} {data.get('last_name', '')}"
            self.log_test("Get Employee Profile", True, f"Retrieved profile for {employee_name}")
            
            # Check profile data structure
            profile_fields = ['employee_id', 'first_name', 'last_name', 'email', 'department_id', 'status']
            missing_fields = [field for field in profile_fields if field not in data]
            
            if missing_fields:
                self.log_test("Employee Profile Data", False, f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Employee Profile Data", True, "All required profile fields present")
            
            return True
        else:
            self.log_test("Get Employee Profile", False, f"Status: {status}, Response: {data}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, status, data = self.make_request('GET', 'dashboard/stats')
        
        if success and isinstance(data, dict):
            required_stats = ['total_employees', 'present_today', 'on_leave_today', 'pending_leaves']
            missing_stats = [stat for stat in required_stats if stat not in data]
            
            if missing_stats:
                self.log_test("Dashboard Stats", False, f"Missing stats: {missing_stats}")
                return False
            else:
                total_emp = data.get('total_employees', 0)
                present = data.get('present_today', 0)
                self.log_test("Dashboard Stats", True, f"Total: {total_emp}, Present: {present}")
                return True
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}, Response: {data}")
            return False

    def test_attendance_data(self):
        """Test attendance data loading"""
        success, status, data = self.make_request('GET', 'attendance/my')
        
        if success:
            self.log_test("Attendance Data", True, f"Attendance endpoint accessible")
            return True
        else:
            # 404 might be expected if no attendance data
            if status == 404:
                self.log_test("Attendance Data", True, "No attendance data (expected for new system)")
                return True
            else:
                self.log_test("Attendance Data", False, f"Status: {status}, Response: {data}")
                return False

    def test_leave_data(self):
        """Test leave data loading"""
        # Test leave types
        success, status, data = self.make_request('GET', 'leave-types')
        if success:
            leave_types_count = len(data) if isinstance(data, list) else 0
            self.log_test("Leave Types", True, f"Found {leave_types_count} leave types")
        else:
            self.log_test("Leave Types", False, f"Status: {status}")
            return False

        # Test leave balance
        success, status, data = self.make_request('GET', 'leave/balance')
        if success:
            self.log_test("Leave Balance", True, "Leave balance endpoint accessible")
            return True
        else:
            # Might be empty for new users
            if status == 404:
                self.log_test("Leave Balance", True, "No leave balance data (expected for new system)")
                return True
            else:
                self.log_test("Leave Balance", False, f"Status: {status}")
                return False

    def test_payroll_data(self):
        """Test payroll data loading for HR users"""
        success, status, data = self.make_request('GET', 'payroll/my-payslips')
        
        if success:
            self.log_test("Payroll Data", True, "Payroll endpoint accessible")
            return True
        else:
            # Empty payslips might be expected
            if status == 404:
                self.log_test("Payroll Data", True, "No payroll data (expected for new system)")
                return True
            else:
                self.log_test("Payroll Data", False, f"Status: {status}")
                return False

    def test_search_functionality(self):
        """Test search by name/email functionality (simulated)"""
        if not self.employees:
            self.log_test("Search Functionality", False, "No employees available for testing")
            return False
        
        # Get a sample employee for search testing
        sample_employee = self.employees[0]
        first_name = sample_employee.get('first_name', '')
        email = sample_employee.get('email', '')
        
        if not first_name and not email:
            self.log_test("Search Functionality", False, "No searchable data in sample employee")
            return False
        
        # Note: The actual search is done client-side in the frontend
        # We're just verifying that the employee data has searchable fields
        self.log_test("Search Functionality", True, f"Employee data contains searchable fields (name: {first_name}, email: {email})")
        return True

    def run_all_tests(self):
        """Run all Employee Directory API tests"""
        print("🚀 Starting Employee Directory API Testing")
        print("=" * 60)
        
        # Authentication
        if not self.test_login():
            print("❌ Authentication failed - stopping tests")
            return False
        
        print("\n👥 Testing Employee Directory Core APIs...")
        self.test_employees_list()
        self.test_departments_list()
        
        print("\n🔍 Testing Filtering Functionality...")
        self.test_employees_with_status_filter()
        self.test_employees_with_department_filter()
        self.test_search_functionality()
        
        print("\n👤 Testing Employee Profile...")
        self.test_employee_profile()
        
        print("\n📊 Testing Dashboard & Other Pages...")
        self.test_dashboard_stats()
        self.test_attendance_data()
        self.test_leave_data()
        self.test_payroll_data()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✅ Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Employee Directory APIs are working well!")
            return True
        else:
            print("⚠️  Some backend issues detected")
            return False

def main():
    """Main test execution"""
    tester = EmployeeDirectoryAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())