#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ShardaHRAPITester:
    def __init__(self, base_url="https://sharda-hr-system.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_health_check(self):
        """Test health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        self.run_test("Root endpoint", "GET", "", 200)
        self.run_test("Health check", "GET", "health", 200)

    def test_authentication_sharda_hr(self):
        """Test authentication with Sharda HR credentials"""
        print("\n" + "="*50)
        print("TESTING SHARDA HR AUTHENTICATION")
        print("="*50)
        
        # Test login with Sharda HR admin credentials
        success, response = self.run_test(
            "Login with admin@shardahr.com",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            
            # Verify user details contain Sharda HR info
            user_data = response.get('user', {})
            print(f"   User: {user_data.get('name')} ({user_data.get('email')})")
            print(f"   Role: {user_data.get('role')}")
            
            # Test /auth/me endpoint
            self.run_test("Get current user", "GET", "auth/me", 200)
            return True
        else:
            print("❌ Failed to get authentication token")
            return False

    def test_hr_admin_authentication(self):
        """Test HR Admin authentication"""
        print("\n" + "="*50)
        print("TESTING HR ADMIN AUTHENTICATION")
        print("="*50)
        
        # Test login with HR Admin credentials
        success, response = self.run_test(
            "Login with hr.admin@shardahr.com",
            "POST",
            "auth/login",
            200,
            data={"email": "hr.admin@shardahr.com", "password": "HrAdmin@123"}
        )
        
        if success and 'access_token' in response:
            print("✅ HR Admin login successful")
            user_data = response.get('user', {})
            print(f"   User: {user_data.get('name')} ({user_data.get('email')})")
            print(f"   Role: {user_data.get('role')}")
            return True
        else:
            print("❌ HR Admin login failed")
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n" + "="*50)
        print("TESTING DASHBOARD STATISTICS")
        print("="*50)
        
        success, response = self.run_test("Get dashboard stats", "GET", "dashboard/stats", 200)
        
        if success:
            stats = response
            print(f"   Total Employees: {stats.get('total_employees', 0)}")
            print(f"   Present Today: {stats.get('present_today', 0)}")
            print(f"   On Leave Today: {stats.get('on_leave_today', 0)}")
            print(f"   Pending Leaves: {stats.get('pending_leaves', 0)}")
            print(f"   Attendance %: {stats.get('attendance_percentage', 0)}%")
            
            # Verify we have meaningful data
            if stats.get('total_employees', 0) > 0:
                print("✅ Dashboard has employee data")
            else:
                print("⚠️  No employee data found")

    def test_user_management_endpoints(self):
        """Test User Management endpoints"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT ENDPOINTS")
        print("="*50)
        
        # Test list users
        success, response = self.run_test("List users", "GET", "users", 200)
        if success:
            users = response.get('users', [])
            print(f"   Found {len(users)} users")
            
            # Check if we have admin users
            admin_users = [u for u in users if u.get('role') in ['super_admin', 'hr_admin']]
            print(f"   Admin users: {len(admin_users)}")
        
        # Test get roles list
        success, response = self.run_test("Get roles list", "GET", "users/roles/list", 200)
        if success:
            roles = response if isinstance(response, list) else []
            print(f"   Available roles: {len(roles)}")
            for role in roles[:5]:  # Show first 5 roles
                print(f"     - {role.get('name')} ({role.get('role_id')})")

    def test_user_management_crud(self):
        """Test User Management CRUD operations"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT CRUD")
        print("="*50)
        
        # Test create user
        test_user_data = {
            "name": "Test User Sharda",
            "email": f"test.user.{datetime.now().strftime('%H%M%S')}@shardahr.com",
            "password": "TestPass@123",
            "role": "employee"
        }
        
        success, response = self.run_test(
            "Create new user",
            "POST",
            "users",
            200,
            data=test_user_data
        )
        
        if success:
            self.created_user_id = response.get('user_id')
            print(f"   Created user ID: {self.created_user_id}")
            
            # Test get specific user
            if self.created_user_id:
                self.run_test(
                    "Get created user",
                    "GET",
                    f"users/{self.created_user_id}",
                    200
                )
                
                # Test update user
                update_data = {
                    "name": "Updated Test User Sharda",
                    "email": test_user_data["email"],
                    "role": "hr_executive"
                }
                
                self.run_test(
                    "Update user",
                    "PUT",
                    f"users/{self.created_user_id}",
                    200,
                    data=update_data
                )
                
                # Test reset password
                self.run_test(
                    "Reset user password",
                    "PUT",
                    f"users/{self.created_user_id}/reset-password",
                    200,
                    data={"new_password": "NewPass@123"}
                )
                
                # Test deactivate user
                self.run_test(
                    "Deactivate user",
                    "PUT",
                    f"users/{self.created_user_id}/deactivate",
                    200
                )
                
                # Test activate user
                self.run_test(
                    "Activate user",
                    "PUT",
                    f"users/{self.created_user_id}/activate",
                    200
                )

    def test_user_management_filters(self):
        """Test User Management filters"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT FILTERS")
        print("="*50)
        
        # Test role filter
        self.run_test("Filter by role - super_admin", "GET", "users?role=super_admin", 200)
        self.run_test("Filter by role - employee", "GET", "users?role=employee", 200)
        
        # Test status filter
        self.run_test("Filter by status - active", "GET", "users?status=active", 200)
        self.run_test("Filter by status - inactive", "GET", "users?status=inactive", 200)
        
        # Test search
        self.run_test("Search users - admin", "GET", "users?search=admin", 200)

    def test_employee_data_seeding(self):
        """Test if employee data is properly seeded"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE DATA SEEDING")
        print("="*50)
        
        success, response = self.run_test("List employees", "GET", "employees", 200)
        if success:
            employees = response if isinstance(response, list) else []
            print(f"   Total employees: {len(employees)}")
            
            if len(employees) > 0:
                print("✅ Employee data is seeded")
                # Show sample employee data
                sample_emp = employees[0]
                print(f"   Sample: {sample_emp.get('first_name')} {sample_emp.get('last_name')}")
                print(f"   Department: {sample_emp.get('department_id')}")
                print(f"   Status: {sample_emp.get('status')}")
            else:
                print("⚠️  No employee data found")

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        if self.created_user_id:
            success, response = self.run_test(
                "Delete test user",
                "DELETE",
                f"users/{self.created_user_id}",
                200
            )
            if success:
                print("✅ Test user cleaned up")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Sharda HR API Testing...")
        print(f"Base URL: {self.base_url}")
        
        # Test health first
        self.test_health_check()
        
        # Test authentication with Sharda HR credentials
        if not self.test_authentication_sharda_hr():
            print("\n❌ Sharda HR Authentication failed - stopping tests")
            return False
        
        # Test HR Admin authentication (but continue with super admin token)
        self.test_hr_admin_authentication()
        
        # Test dashboard stats
        self.test_dashboard_stats()
        
        # Test employee data seeding
        self.test_employee_data_seeding()
        
        # Test User Management endpoints
        self.test_user_management_endpoints()
        
        # Test User Management CRUD operations
        self.test_user_management_crud()
        
        # Test User Management filters
        self.test_user_management_filters()
        
        # Clean up test data
        self.cleanup_test_data()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("SHARDA HR TEST SUMMARY")
        print("="*60)
        print(f"📊 Tests Run: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test['test']} - {test.get('endpoint', 'N/A')}")
                if 'expected' in test:
                    print(f"      Expected: {test['expected']}, Got: {test['actual']}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = ShardaHRAPITester()
    
    success = tester.run_all_tests()
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())