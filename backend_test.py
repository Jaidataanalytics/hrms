#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Sharda HR HRMS
Tests Training, Travel, Reports, and Payroll modules
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class SHardaHRMSAPITester:
    def __init__(self, base_url="https://talentportal-7.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
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
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_login(self):
        """Test admin login"""
        print("\n" + "="*50)
        print("🔐 TESTING AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@shardahr.com", "password": "Admin@123"}
        )
        
        if success:
            print(f"✅ Login successful")
            return True
        else:
            print(f"❌ Login failed - cannot proceed with authenticated tests")
            return False

    def test_training_module(self):
        """Test Training Management APIs"""
        print("\n" + "="*50)
        print("🎓 TESTING TRAINING MANAGEMENT")
        print("="*50)
        
        # Test list training programs
        success, programs = self.run_test(
            "List Training Programs",
            "GET",
            "training/programs",
            200
        )
        
        if success:
            print(f"   Found {len(programs)} training programs")
            if len(programs) >= 4:
                print("✅ Expected 4+ training programs found")
            else:
                print(f"⚠️  Expected 4+ programs, found {len(programs)}")
        
        # Test get my training
        self.run_test(
            "Get My Training",
            "GET",
            "training/my-training",
            200
        )
        
        # Test create training program (HR only)
        program_data = {
            "name": "Test Leadership Workshop",
            "description": "Test program for leadership development",
            "category": "leadership",
            "trainer": "John Doe",
            "start_date": "2025-02-01",
            "end_date": "2025-02-05",
            "location": "Conference Room A",
            "max_participants": 25
        }
        
        success, new_program = self.run_test(
            "Create Training Program",
            "POST",
            "training/programs",
            200,
            data=program_data
        )
        
        program_id = None
        if success and new_program.get("program_id"):
            program_id = new_program["program_id"]
            print(f"   Created program ID: {program_id}")
        
        # Test enrollment
        if program_id:
            enrollment_data = {
                "program_id": program_id,
                "employee_id": "emp_001"
            }
            
            self.run_test(
                "Enroll in Training Program",
                "POST",
                "training/enrollments",
                200,
                data=enrollment_data
            )
        
        # Test add certification
        cert_data = {
            "name": "Test AWS Certification",
            "issuing_body": "Amazon Web Services",
            "issue_date": "2024-12-01",
            "expiry_date": "2027-12-01",
            "credential_id": "TEST123456"
        }
        
        self.run_test(
            "Add Certification",
            "POST",
            "training/certifications",
            200,
            data=cert_data
        )

    def test_travel_module(self):
        """Test Travel Management APIs"""
        print("\n" + "="*50)
        print("✈️  TESTING TRAVEL MANAGEMENT")
        print("="*50)
        
        # Test list travel requests
        success, requests = self.run_test(
            "List Travel Requests",
            "GET",
            "travel/requests",
            200
        )
        
        if success:
            print(f"   Found {len(requests)} travel requests")
            if len(requests) >= 15:
                print("✅ Expected 15+ travel requests found")
            else:
                print(f"⚠️  Expected 15+ requests, found {len(requests)}")
        
        # Test create travel request
        travel_data = {
            "purpose": "Client Meeting - Test",
            "destination": "Mumbai, India",
            "start_date": "2025-02-15",
            "end_date": "2025-02-17",
            "travel_mode": "flight",
            "estimated_budget": 25000,
            "accommodation_required": True,
            "advance_required": True,
            "advance_amount": 10000,
            "remarks": "Important client presentation"
        }
        
        success, new_request = self.run_test(
            "Create Travel Request",
            "POST",
            "travel/requests",
            200,
            data=travel_data
        )
        
        request_id = None
        if success and new_request.get("request_id"):
            request_id = new_request["request_id"]
            print(f"   Created request ID: {request_id}")
        
        # Test approve travel request
        if request_id:
            approve_data = {
                "approved_budget": 25000,
                "remarks": "Approved for client meeting"
            }
            
            self.run_test(
                "Approve Travel Request",
                "PUT",
                f"travel/requests/{request_id}/approve",
                200,
                data=approve_data
            )
        
        # Test reject travel request (create another one first)
        success2, new_request2 = self.run_test(
            "Create Travel Request for Rejection",
            "POST",
            "travel/requests",
            200,
            data={**travel_data, "purpose": "Test Rejection Request"}
        )
        
        if success2 and new_request2.get("request_id"):
            reject_data = {"reason": "Budget constraints"}
            self.run_test(
                "Reject Travel Request",
                "PUT",
                f"travel/requests/{new_request2['request_id']}/reject",
                200,
                data=reject_data
            )

    def test_reports_module(self):
        """Test Reports & Analytics APIs"""
        print("\n" + "="*50)
        print("📊 TESTING REPORTS & ANALYTICS")
        print("="*50)
        
        # Test headcount report
        success, headcount = self.run_test(
            "Headcount Report",
            "GET",
            "reports/headcount",
            200
        )
        
        if success:
            total = headcount.get("total_headcount", 0)
            departments = len(headcount.get("by_department", []))
            print(f"   Total headcount: {total}")
            print(f"   Departments: {departments}")
        
        # Test attrition report
        current_year = datetime.now().year
        success, attrition = self.run_test(
            "Attrition Report",
            "GET",
            f"reports/attrition?year={current_year}",
            200
        )
        
        if success:
            rate = attrition.get("attrition_rate", 0)
            exits = attrition.get("total_exits", 0)
            print(f"   Attrition rate: {rate}%")
            print(f"   Total exits: {exits}")
        
        # Test payroll cost report
        success, payroll = self.run_test(
            "Payroll Cost Report",
            "GET",
            f"reports/payroll-cost?year={current_year}",
            200
        )
        
        if success:
            total_gross = payroll.get("total_gross", 0)
            employees = payroll.get("employee_count", 0)
            print(f"   Total gross salary: ₹{total_gross:,}")
            print(f"   Employee count: {employees}")
        
        # Test attendance report
        self.run_test(
            "Attendance Report",
            "GET",
            "reports/attendance",
            200
        )
        
        # Test leave report
        self.run_test(
            "Leave Report",
            "GET",
            f"reports/leave?year={current_year}",
            200
        )

    def test_payroll_module(self):
        """Test Payroll Management APIs"""
        print("\n" + "="*50)
        print("💰 TESTING PAYROLL MANAGEMENT")
        print("="*50)
        
        # Test get payroll runs
        self.run_test(
            "List Payroll Runs",
            "GET",
            "payroll/runs",
            200
        )
        
        # Test get my payslips
        self.run_test(
            "Get My Payslips",
            "GET",
            "payroll/my-payslips",
            200
        )
        
        # Test get payroll rules
        success, rules = self.run_test(
            "Get Payroll Rules",
            "GET",
            "payroll/rules",
            200
        )
        
        if success:
            print(f"   Payroll rules loaded successfully")
            if rules.get("attendance_rules"):
                print("   ✅ Attendance rules found")
            if rules.get("pf_rules"):
                print("   ✅ PF rules found")
            if rules.get("esi_rules"):
                print("   ✅ ESI rules found")
        
        # Test get all employees pay
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        self.run_test(
            "Get All Employees Pay",
            "GET",
            f"payroll/all-employees-pay?month={current_month}&year={current_year}",
            200
        )
        
        # Test create payroll run
        self.run_test(
            "Create Payroll Run",
            "POST",
            f"payroll/runs?month={current_month}&year={current_year}",
            200
        )

    def test_existing_modules(self):
        """Test existing modules to ensure they still work"""
        print("\n" + "="*50)
        print("🔄 TESTING EXISTING MODULES")
        print("="*50)
        
        # Test employees
        self.run_test(
            "List Employees",
            "GET",
            "employees",
            200
        )
        
        # Test expenses with filter
        self.run_test(
            "List Expenses",
            "GET",
            "expenses",
            200
        )
        
        # Test assets
        self.run_test(
            "List Assets",
            "GET",
            "assets",
            200
        )
        
        # Test leave requests
        self.run_test(
            "List Leave Requests",
            "GET",
            "leave",
            200
        )

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Sharda HRMS Backend API Testing")
        print(f"📍 Base URL: {self.base_url}")
        
        # Login first
        if not self.test_login():
            print("\n❌ Cannot proceed without authentication")
            return False
        
        # Test all modules
        self.test_training_module()
        self.test_travel_module()
        self.test_reports_module()
        self.test_payroll_module()
        self.test_existing_modules()
        
        # Print summary
        print("\n" + "="*60)
        print("📋 TEST SUMMARY")
        print("="*60)
        print(f"✅ Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests failed: {len(self.failed_tests)}")
        
        if self.failed_tests:
            print("\n🔍 Failed Tests:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"   {i}. {failure}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Overall Status: GOOD")
        elif success_rate >= 60:
            print("⚠️  Overall Status: NEEDS ATTENTION")
        else:
            print("🚨 Overall Status: CRITICAL ISSUES")
        
        return success_rate >= 80

def main():
    tester = SHardaHRMSAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())