#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class HRMSAPITester:
    def __init__(self, base_url="https://talentportal-7.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

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

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test login with demo credentials
        success, response = self.run_test(
            "Login with demo credentials",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@nexushr.com", "password": "Admin@123"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            
            # Test /auth/me endpoint
            self.run_test("Get current user", "GET", "auth/me", 200)
            return True
        else:
            print("❌ Failed to get authentication token")
            return False

    def test_master_data(self):
        """Test master data endpoints"""
        print("\n" + "="*50)
        print("TESTING MASTER DATA ENDPOINTS")
        print("="*50)
        
        self.run_test("Get departments", "GET", "departments", 200)
        self.run_test("Get designations", "GET", "designations", 200)
        self.run_test("Get locations", "GET", "locations", 200)
        self.run_test("Get leave types", "GET", "leave-types", 200)

    def test_employee_endpoints(self):
        """Test employee management endpoints"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE ENDPOINTS")
        print("="*50)
        
        self.run_test("List employees", "GET", "employees", 200)

    def test_attendance_endpoints(self):
        """Test attendance endpoints"""
        print("\n" + "="*50)
        print("TESTING ATTENDANCE ENDPOINTS")
        print("="*50)
        
        # Test mark attendance
        self.run_test(
            "Mark attendance IN",
            "POST",
            "attendance/mark",
            200,
            data={"punch_type": "IN", "source": "manual"}
        )
        
        self.run_test("Get my attendance", "GET", "attendance/my", 200)

    def test_leave_endpoints(self):
        """Test leave management endpoints"""
        print("\n" + "="*50)
        print("TESTING LEAVE ENDPOINTS")
        print("="*50)
        
        self.run_test("Get leave balance", "GET", "leave/balance", 200)
        self.run_test("Get my leave requests", "GET", "leave/my-requests", 200)

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n" + "="*50)
        print("TESTING DASHBOARD ENDPOINTS")
        print("="*50)
        
        self.run_test("Get dashboard stats", "GET", "dashboard/stats", 200)
        self.run_test("Get employee dashboard", "GET", "dashboard/employee", 200)

    def test_announcements_endpoints(self):
        """Test announcements endpoints"""
        print("\n" + "="*50)
        print("TESTING ANNOUNCEMENTS ENDPOINTS")
        print("="*50)
        
        self.run_test("List announcements", "GET", "announcements", 200)

    def test_notifications_endpoints(self):
        """Test notifications endpoints"""
        print("\n" + "="*50)
        print("TESTING NOTIFICATIONS ENDPOINTS")
        print("="*50)
        
        self.run_test("List notifications", "GET", "notifications", 200)
        self.run_test("Get notification count", "GET", "notifications/count", 200)

    def test_seed_data(self):
        """Test seed data endpoint"""
        print("\n" + "="*50)
        print("TESTING SEED DATA")
        print("="*50)
        
        self.run_test("Seed initial data", "POST", "seed/initial", 200)

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting HRMS API Testing...")
        print(f"Base URL: {self.base_url}")
        
        # Test health first
        self.test_health_check()
        
        # Seed data first
        self.test_seed_data()
        
        # Test authentication
        if not self.test_authentication():
            print("\n❌ Authentication failed - stopping tests")
            return False
        
        # Test all other endpoints
        self.test_master_data()
        self.test_employee_endpoints()
        self.test_attendance_endpoints()
        self.test_leave_endpoints()
        self.test_dashboard_endpoints()
        self.test_announcements_endpoints()
        self.test_notifications_endpoints()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
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
    tester = HRMSAPITester()
    
    success = tester.run_all_tests()
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())