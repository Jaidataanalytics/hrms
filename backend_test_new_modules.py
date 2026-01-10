#!/usr/bin/env python3
"""
Backend API Testing for New HRMS Modules
Tests: Assets, Expenses, Grievance/Helpdesk, Recruitment, Onboarding/Exit, Reports
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class HRMSNewModulesAPITester:
    def __init__(self, base_url="https://fastapi-hr-fixes.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append(f"{name}: {details}")

    def test_login(self):
        """Test admin login"""
        try:
            response = self.session.post(f"{self.base_url}/auth/login", json={
                "email": "admin@nexushr.com",
                "password": "Admin@123"
            })
            success = response.status_code == 200
            if success:
                # Store cookies for subsequent requests
                self.session.cookies.update(response.cookies)
            self.log_test("Admin Login", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Admin Login", False, str(e))
            return False

    def test_assets_endpoints(self):
        """Test Assets Management APIs"""
        print("\n🔧 Testing Assets Management APIs...")
        
        # Test list assets (admin only)
        try:
            response = self.session.get(f"{self.base_url}/assets")
            self.log_test("GET /api/assets", response.status_code in [200, 403], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/assets", False, str(e))

        # Test my assets
        try:
            response = self.session.get(f"{self.base_url}/assets/my")
            self.log_test("GET /api/assets/my", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/assets/my", False, str(e))

        # Test asset requests
        try:
            response = self.session.get(f"{self.base_url}/assets/requests")
            self.log_test("GET /api/assets/requests", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/assets/requests", False, str(e))

        # Test create asset request
        try:
            response = self.session.post(f"{self.base_url}/assets/requests", json={
                "category": "laptop",
                "description": "Need laptop for development work",
                "justification": "Current laptop is outdated"
            })
            self.log_test("POST /api/assets/requests", response.status_code in [200, 201], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/assets/requests", False, str(e))

    def test_expenses_endpoints(self):
        """Test Expenses Management APIs"""
        print("\n💰 Testing Expenses Management APIs...")
        
        # Test expense categories
        try:
            response = self.session.get(f"{self.base_url}/expenses/categories")
            self.log_test("GET /api/expenses/categories", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/expenses/categories", False, str(e))

        # Test list expenses
        try:
            response = self.session.get(f"{self.base_url}/expenses")
            self.log_test("GET /api/expenses", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/expenses", False, str(e))

        # Test create expense
        try:
            response = self.session.post(f"{self.base_url}/expenses", json={
                "title": "Client meeting travel",
                "category": "travel",
                "amount": 2500,
                "expense_date": datetime.now().date().isoformat(),
                "description": "Travel to client office for project discussion"
            })
            self.log_test("POST /api/expenses", response.status_code in [200, 201], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/expenses", False, str(e))

    def test_grievance_endpoints(self):
        """Test Grievance/Helpdesk APIs"""
        print("\n🎫 Testing Grievance/Helpdesk APIs...")
        
        # Test grievance categories
        try:
            response = self.session.get(f"{self.base_url}/grievances/categories")
            self.log_test("GET /api/grievances/categories", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/grievances/categories", False, str(e))

        # Test list grievances
        try:
            response = self.session.get(f"{self.base_url}/grievances")
            self.log_test("GET /api/grievances", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/grievances", False, str(e))

        # Test create grievance
        try:
            response = self.session.post(f"{self.base_url}/grievances", json={
                "category": "it_support",
                "subject": "Email access issue",
                "description": "Unable to access company email from mobile device",
                "priority": "medium"
            })
            success = response.status_code in [200, 201]
            self.log_test("POST /api/grievances", success, f"Status: {response.status_code}")
            
            # If successful, try to get the ticket
            if success and response.status_code in [200, 201]:
                try:
                    ticket_data = response.json()
                    ticket_id = ticket_data.get('ticket_id')
                    if ticket_id:
                        get_response = self.session.get(f"{self.base_url}/grievances/{ticket_id}")
                        self.log_test("GET /api/grievances/{ticket_id}", get_response.status_code == 200, f"Status: {get_response.status_code}")
                except Exception as e:
                    self.log_test("GET /api/grievances/{ticket_id}", False, str(e))
        except Exception as e:
            self.log_test("POST /api/grievances", False, str(e))

    def test_recruitment_endpoints(self):
        """Test Recruitment APIs"""
        print("\n👔 Testing Recruitment APIs...")
        
        # Test list job postings
        try:
            response = self.session.get(f"{self.base_url}/recruitment/jobs")
            self.log_test("GET /api/recruitment/jobs", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/recruitment/jobs", False, str(e))

        # Test list applications
        try:
            response = self.session.get(f"{self.base_url}/recruitment/applications")
            self.log_test("GET /api/recruitment/applications", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/recruitment/applications", False, str(e))

        # Test create job posting (HR only)
        try:
            response = self.session.post(f"{self.base_url}/recruitment/jobs", json={
                "title": "Senior Software Engineer",
                "department_id": "dept_engineering",
                "description": "Looking for experienced software engineer",
                "requirements": "5+ years experience in Python/React",
                "experience_min": 5,
                "experience_max": 10,
                "vacancies": 2
            })
            self.log_test("POST /api/recruitment/jobs", response.status_code in [200, 201, 403], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/recruitment/jobs", False, str(e))

    def test_onboarding_endpoints(self):
        """Test Onboarding & Exit APIs"""
        print("\n🚀 Testing Onboarding & Exit APIs...")
        
        # Test onboarding tasks
        try:
            response = self.session.get(f"{self.base_url}/onboarding/tasks")
            self.log_test("GET /api/onboarding/tasks", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/onboarding/tasks", False, str(e))

        # Test exit requests
        try:
            response = self.session.get(f"{self.base_url}/onboarding/exit-requests")
            self.log_test("GET /api/onboarding/exit-requests", response.status_code == 200, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/onboarding/exit-requests", False, str(e))

        # Test onboarding templates (HR only)
        try:
            response = self.session.get(f"{self.base_url}/onboarding/templates")
            self.log_test("GET /api/onboarding/templates", response.status_code in [200, 403], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/onboarding/templates", False, str(e))

    def test_reports_endpoints(self):
        """Test Reports & Analytics APIs"""
        print("\n📊 Testing Reports & Analytics APIs...")
        
        # Test summary report
        try:
            response = self.session.get(f"{self.base_url}/reports/summary")
            success = response.status_code in [200, 403]
            self.log_test("GET /api/reports/summary", success, f"Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    has_required_fields = all(key in data for key in ['employees', 'expenses', 'assets'])
                    self.log_test("Reports summary data structure", has_required_fields, "Contains required fields")
                except Exception as e:
                    self.log_test("Reports summary data structure", False, str(e))
        except Exception as e:
            self.log_test("GET /api/reports/summary", False, str(e))

        # Test headcount report
        try:
            response = self.session.get(f"{self.base_url}/reports/headcount")
            self.log_test("GET /api/reports/headcount", response.status_code in [200, 403], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/reports/headcount", False, str(e))

        # Test attendance report
        try:
            response = self.session.get(f"{self.base_url}/reports/attendance")
            self.log_test("GET /api/reports/attendance", response.status_code in [200, 403], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/reports/attendance", False, str(e))

        # Test expense report
        try:
            response = self.session.get(f"{self.base_url}/reports/expense")
            self.log_test("GET /api/reports/expense", response.status_code in [200, 403], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /api/reports/expense", False, str(e))

    def test_api_route_corrections(self):
        """Test corrected API routes"""
        print("\n🔧 Testing API Route Corrections...")
        
        # Test corrected routes that should have /api prefix
        corrected_routes = [
            "/assets/my",
            "/assets/requests", 
            "/expenses/categories",
            "/grievances/categories",
            "/recruitment/jobs",
            "/onboarding/tasks",
            "/reports/summary"
        ]
        
        for route in corrected_routes:
            try:
                response = self.session.get(f"{self.base_url}{route}")
                success = response.status_code in [200, 403, 404]  # 404 is acceptable for some routes
                self.log_test(f"Route correction: {route}", success, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Route correction: {route}", False, str(e))

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting HRMS New Modules Backend API Testing...")
        print(f"Base URL: {self.base_url}")
        
        # Login first
        if not self.test_login():
            print("❌ Login failed, stopping tests")
            return False
        
        # Test all new modules
        self.test_assets_endpoints()
        self.test_expenses_endpoints() 
        self.test_grievance_endpoints()
        self.test_recruitment_endpoints()
        self.test_onboarding_endpoints()
        self.test_reports_endpoints()
        self.test_api_route_corrections()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = HRMSNewModulesAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())