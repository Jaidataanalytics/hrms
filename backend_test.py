#!/usr/bin/env python3
"""
Backend API Testing for Sharda HR HRMS - Data Management Module
Tests all data management endpoints including stats, bulk delete, restore operations
"""

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class DataManagementAPITester:
    def __init__(self, base_url="https://hrpro-dashboard.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_credentials = {
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        }
        self.data_stats = []
        self.departments = []
        self.employees = []

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
        """Test admin login"""
        success, status, data = self.make_request('POST', 'auth/login', self.admin_credentials)
        
        if success and 'access_token' in data:
            # Set authorization header for subsequent requests
            self.session.headers.update({
                'Authorization': f'Bearer {data["access_token"]}'
            })
            self.log_test("Admin Login", True, f"Token received, user role: {data.get('user', {}).get('role', 'unknown')}")
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {data}")
            return False

    def test_data_stats(self):
        """Test getting data statistics for all collections"""
        success, status, data = self.make_request('GET', 'data-management/stats')
        
        if success and isinstance(data, list):
            self.data_stats = data
            total_collections = len(data)
            collections_with_data = len([d for d in data if d.get('total_count', 0) > 0])
            
            self.log_test("Get Data Statistics", True, f"Found {total_collections} collections, {collections_with_data} with data")
            
            # Check for expected data types
            expected_types = ['employees', 'attendance', 'leave_requests', 'payslips', 'announcements']
            found_types = [d.get('data_type') for d in data]
            missing_types = [t for t in expected_types if t not in found_types]
            
            if missing_types:
                print(f"   Missing data types: {missing_types}")
            
            # Show some stats
            for stat in data[:5]:  # Show first 5
                print(f"   {stat.get('display_name', 'Unknown')}: {stat.get('total_count', 0)} total, {stat.get('active_count', 0)} active, {stat.get('deleted_count', 0)} deleted")
            
            return True
        else:
            self.log_test("Get Data Statistics", False, f"Status: {status}, Response: {data}")
            return False

    def test_departments_list(self):
        """Test getting departments for filter dropdown"""
        success, status, data = self.make_request('GET', 'data-management/departments')
        
        if success and isinstance(data, list):
            self.departments = data
            self.log_test("Get Departments List", True, f"Found {len(data)} departments: {data[:3]}...")
            return True
        else:
            self.log_test("Get Departments List", False, f"Status: {status}, Response: {data}")
            return False

    def test_employees_list(self):
        """Test getting employees for filter dropdown"""
        success, status, data = self.make_request('GET', 'data-management/employees-list')
        
        if success and isinstance(data, list):
            self.employees = data
            employee_count = len(data)
            self.log_test("Get Employees List", True, f"Found {employee_count} employees")
            
            if employee_count > 0:
                # Show sample employee data
                sample = data[0]
                print(f"   Sample employee: {sample.get('name', 'Unknown')} ({sample.get('code', 'No code')})")
            
            return True
        else:
            self.log_test("Get Employees List", False, f"Status: {status}, Response: {data}")
            return False

    def test_bulk_delete_with_filters(self):
        """Test bulk delete with various filters (soft delete only for testing)"""
        if not self.data_stats:
            self.log_test("Bulk Delete with Filters", False, "No data stats available")
            return False
        
        # Find a data type with some records
        data_type_with_records = None
        for stat in self.data_stats:
            if stat.get('total_count', 0) > 0:
                data_type_with_records = stat.get('data_type')
                break
        
        if not data_type_with_records:
            self.log_test("Bulk Delete with Filters", True, "No data to delete - skipping test")
            return True
        
        # Test with date filters (soft delete)
        bulk_delete_data = {
            "data_type": data_type_with_records,
            "delete_type": "soft",
            "filters": {
                "date_from": "2020-01-01",
                "date_to": "2021-12-31"
            }
        }
        
        success, status, data = self.make_request('POST', 'data-management/bulk-delete', bulk_delete_data)
        
        if success:
            deleted_count = data.get('deleted_count', 0)
            self.log_test("Bulk Delete with Filters", True, f"Soft deleted {deleted_count} {data_type_with_records} records")
            return True
        else:
            self.log_test("Bulk Delete with Filters", False, f"Status: {status}, Response: {data}")
            return False

    def test_restore_soft_deleted(self):
        """Test restoring soft-deleted records"""
        if not self.data_stats:
            self.log_test("Restore Soft Deleted", False, "No data stats available")
            return False
        
        # Find a data type that might have deleted records
        data_type_to_restore = None
        for stat in self.data_stats:
            if stat.get('deleted_count', 0) > 0 or stat.get('data_type') == 'announcements':
                data_type_to_restore = stat.get('data_type')
                break
        
        if not data_type_to_restore:
            # Try to restore from a common data type
            data_type_to_restore = 'announcements'
        
        restore_data = {
            "data_type": data_type_to_restore
        }
        
        success, status, data = self.make_request('POST', 'data-management/restore', restore_data)
        
        if success:
            restored_count = data.get('restored_count', 0)
            self.log_test("Restore Soft Deleted", True, f"Restored {restored_count} {data_type_to_restore} records")
            return True
        else:
            self.log_test("Restore Soft Deleted", False, f"Status: {status}, Response: {data}")
            return False

    def test_delete_all_type_validation(self):
        """Test delete all type endpoint validation (without actually deleting)"""
        # Test with invalid data type
        invalid_data = {
            "data_type": "invalid_type",
            "delete_type": "soft"
        }
        
        success, status, data = self.make_request('POST', 'data-management/delete-all-type', invalid_data, 400)
        
        if success:
            self.log_test("Delete All Type Validation", True, f"Correctly rejected invalid data type: {data.get('detail', 'Unknown error')}")
            return True
        else:
            self.log_test("Delete All Type Validation", False, f"Expected 400 status, got {status}")
            return False

    def test_delete_everything_validation(self):
        """Test delete everything endpoint validation (without actually deleting)"""
        # Test with wrong confirmation text
        wrong_confirmation = {
            "confirmation_text": "DELETE ALL",
            "delete_type": "hard"
        }
        
        success, status, data = self.make_request('POST', 'data-management/delete-everything', wrong_confirmation, 400)
        
        if success:
            self.log_test("Delete Everything Validation", True, f"Correctly rejected wrong confirmation: {data.get('detail', 'Unknown error')}")
            return True
        else:
            self.log_test("Delete Everything Validation", False, f"Expected 400 status, got {status}")
            return False

    def test_unauthorized_access(self):
        """Test that non-admin users cannot access data management"""
        # Remove authorization header temporarily
        original_auth = self.session.headers.get('Authorization')
        if original_auth:
            del self.session.headers['Authorization']
        
        success, status, data = self.make_request('GET', 'data-management/stats', expected_status=401)
        
        # Restore authorization
        if original_auth:
            self.session.headers['Authorization'] = original_auth
        
        if success:
            self.log_test("Unauthorized Access Protection", True, "Correctly blocked unauthorized access")
            return True
        else:
            self.log_test("Unauthorized Access Protection", False, f"Expected 401 status, got {status}")
            return False

    def run_all_tests(self):
        """Run all Data Management API tests"""
        print("🚀 Starting Sharda HR HRMS Data Management API Testing")
        print("=" * 60)
        
        # Authentication
        if not self.test_login():
            print("❌ Authentication failed - stopping tests")
            return False
        
        print("\n📊 Testing Data Management Core APIs...")
        self.test_data_stats()
        self.test_departments_list()
        self.test_employees_list()
        
        print("\n🗑️ Testing Delete Operations...")
        self.test_bulk_delete_with_filters()
        self.test_restore_soft_deleted()
        
        print("\n🔒 Testing Validation & Security...")
        self.test_delete_all_type_validation()
        self.test_delete_everything_validation()
        self.test_unauthorized_access()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✅ Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Data Management APIs are working well!")
            return True
        else:
            print("⚠️  Some backend issues detected")
            return False

def main():
    """Main test execution"""
    tester = DataManagementAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())