#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class LabourDocsReportsAPITester:
    def __init__(self, base_url="https://bulk-import-helper.preview.emergentagent.com/api"):
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
                    elif isinstance(response_data, list) and len(response_data) > 0:
                        print(f"   Response: {len(response_data)} items returned")
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

    def test_authentication(self):
        """Test authentication with admin credentials"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test login with admin credentials
        success, response = self.run_test(
            "Login with admin@nexushr.com",
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

    def test_labour_endpoints(self):
        """Test labour management endpoints"""
        print("\n" + "="*50)
        print("TESTING LABOUR MANAGEMENT ENDPOINTS")
        print("="*50)
        
        # Test GET endpoints
        self.run_test("Get contractors list", "GET", "labour/contractors", 200)
        self.run_test("Get workers list", "GET", "labour/workers", 200)
        self.run_test("Get labour summary", "GET", "labour/summary", 200)
        self.run_test("Get attendance records", "GET", "labour/attendance", 200)
        
        # Test POST endpoints - Create contractor
        contractor_data = {
            "name": "Test Contractor",
            "company_name": "Test Company Ltd",
            "contact_person": "John Doe",
            "email": "test@company.com",
            "phone": "9876543210",
            "gst_number": "29ABCDE1234F1Z5",
            "department_id": "dept_001",
            "contract_start": "2024-01-01",
            "contract_end": "2024-12-31",
            "contract_value": 500000
        }
        
        success, contractor_response = self.run_test(
            "Create contractor",
            "POST",
            "labour/contractors",
            200,
            data=contractor_data
        )
        
        contractor_id = None
        if success and isinstance(contractor_response, dict):
            contractor_id = contractor_response.get('contractor_id')
            print(f"   Created contractor ID: {contractor_id}")
        
        # Test POST endpoints - Create worker
        worker_data = {
            "contractor_id": contractor_id or "CONT-12345678",
            "first_name": "Test",
            "last_name": "Worker",
            "phone": "9876543210",
            "aadhaar_number": "123456789012",
            "department_id": "dept_001",
            "skill_category": "skilled",
            "daily_rate": 800,
            "start_date": "2024-01-01"
        }
        
        success, worker_response = self.run_test(
            "Create contract worker",
            "POST",
            "labour/workers",
            200,
            data=worker_data
        )
        
        worker_id = None
        if success and isinstance(worker_response, dict):
            worker_id = worker_response.get('worker_id')
            print(f"   Created worker ID: {worker_id}")

    def test_documents_endpoints(self):
        """Test documents management endpoints"""
        print("\n" + "="*50)
        print("TESTING DOCUMENTS MANAGEMENT ENDPOINTS")
        print("="*50)
        
        # Test GET endpoints
        self.run_test("Get documents list", "GET", "documents", 200)
        self.run_test("Get document types", "GET", "document-types", 200)
        
        # Test POST endpoints - Upload document
        document_data = {
            "name": "Test PAN Card",
            "type": "pan_card",
            "description": "Test document upload",
            "file_url": "https://example.com/test-pan.pdf"
        }
        
        success, doc_response = self.run_test(
            "Upload document",
            "POST",
            "documents",
            200,
            data=document_data
        )
        
        document_id = None
        if success and isinstance(doc_response, dict):
            document_id = doc_response.get('document_id')
            print(f"   Created document ID: {document_id}")
            
            # Test document verification (HR only)
            if document_id:
                self.run_test(
                    "Verify document",
                    "PUT",
                    f"documents/{document_id}/verify",
                    200,
                    data={"remarks": "Document verified successfully"}
                )

    def test_expenses_endpoints(self):
        """Test expenses management endpoints"""
        print("\n" + "="*50)
        print("TESTING EXPENSES MANAGEMENT ENDPOINTS")
        print("="*50)
        
        # Test GET endpoints
        self.run_test("Get expenses list", "GET", "expenses", 200)
        self.run_test("Get expense categories", "GET", "expense-categories", 200)
        self.run_test("Get my expenses", "GET", "my-expenses", 200)
        
        # Test POST endpoints - Create expense
        expense_data = {
            "title": "Business Travel Expense",
            "category": "travel",
            "amount": 5000,
            "date": "2024-01-15",
            "description": "Travel to client site for project meeting",
            "receipt_url": "https://example.com/receipt.pdf"
        }
        
        success, expense_response = self.run_test(
            "Create expense claim",
            "POST",
            "expenses",
            200,
            data=expense_data
        )
        
        claim_id = None
        if success and isinstance(expense_response, dict):
            claim_id = expense_response.get('claim_id')
            print(f"   Created expense claim ID: {claim_id}")
            
            # Test expense approval
            if claim_id:
                self.run_test(
                    "Approve expense",
                    "PUT",
                    f"expenses/{claim_id}/approve",
                    200,
                    data={"approved_amount": 5000}
                )

    def test_assets_endpoints(self):
        """Test assets management endpoints"""
        print("\n" + "="*50)
        print("TESTING ASSETS MANAGEMENT ENDPOINTS")
        print("="*50)
        
        # Test GET endpoints
        self.run_test("Get assets list", "GET", "assets", 200)
        self.run_test("Get my assets", "GET", "my-assets", 200)
        self.run_test("Get asset requests", "GET", "asset-requests", 200)

    def test_report_builder_endpoints(self):
        """Test report builder related endpoints"""
        print("\n" + "="*50)
        print("TESTING REPORT BUILDER ENDPOINTS")
        print("="*50)
        
        # Test various report endpoints that would be used by report builder
        self.run_test("Get employees for reports", "GET", "employees", 200)
        self.run_test("Get departments for reports", "GET", "departments", 200)
        self.run_test("Get attendance reports", "GET", "reports/attendance", 200)
        self.run_test("Get leave reports", "GET", "reports/leave", 200)
        self.run_test("Get headcount reports", "GET", "reports/headcount", 200)
        self.run_test("Get expense reports", "GET", "reports/expense", 200)

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Labour, Documents & Reports API Testing...")
        print(f"Base URL: {self.base_url}")
        
        # Test authentication first
        if not self.test_authentication():
            print("\n❌ Authentication failed - stopping tests")
            return False
        
        # Test all modules
        self.test_labour_endpoints()
        self.test_documents_endpoints()
        self.test_expenses_endpoints()
        self.test_assets_endpoints()
        self.test_report_builder_endpoints()
        
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
    tester = LabourDocsReportsAPITester()
    
    success = tester.run_all_tests()
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())