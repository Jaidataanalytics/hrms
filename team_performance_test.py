#!/usr/bin/env python3
"""
Team Performance API Testing for Sharda HR HRMS
Tests the specific team performance endpoints for HR/Admin users
"""

import requests
import sys
import json
from datetime import datetime

class TeamPerformanceAPITester:
    def __init__(self, base_url="https://fastapi-hr-fixes.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_credentials = {
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        }
        self.employee_id = None

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
            user_role = data.get('user', {}).get('role', 'unknown')
            self.log_test("Admin Login", True, f"Token received, user role: {user_role}")
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {data}")
            return False

    def test_team_performance_endpoint(self):
        """Test /api/performance/team-performance endpoint"""
        success, status, data = self.make_request('GET', 'performance/team-performance')
        
        if success and isinstance(data, list):
            employee_count = len(data)
            self.log_test("Team Performance Endpoint", True, f"Found {employee_count} employees")
            
            if employee_count > 0:
                # Check first employee structure
                first_emp = data[0]
                required_fields = ['employee_id', 'employee_name', 'department', 'designation', 
                                 'total_kpis', 'approved_kpis', 'pending_kpis', 'average_score']
                
                missing_fields = [field for field in required_fields if field not in first_emp]
                if missing_fields:
                    print(f"   ⚠️  Missing fields in employee data: {missing_fields}")
                else:
                    print(f"   ✅ All required fields present in employee data")
                
                # Store employee ID for detailed test
                self.employee_id = first_emp.get('employee_id')
                
                # Show sample data structure
                print(f"   Sample employee: {first_emp.get('employee_name')} - {first_emp.get('department')}")
                print(f"   KPIs: Total={first_emp.get('total_kpis')}, Approved={first_emp.get('approved_kpis')}, Pending={first_emp.get('pending_kpis')}")
                print(f"   Average Score: {first_emp.get('average_score')}")
                
                # Check for employees with performance data
                employees_with_kpis = [emp for emp in data if emp.get('total_kpis', 0) > 0]
                employees_with_scores = [emp for emp in data if emp.get('average_score') is not None]
                
                print(f"   Employees with KPIs: {len(employees_with_kpis)}")
                print(f"   Employees with scores: {len(employees_with_scores)}")
            
            return True
        else:
            self.log_test("Team Performance Endpoint", False, f"Status: {status}, Response: {data}")
            return False

    def test_employee_performance_detail(self):
        """Test /api/performance/employee-performance/{employee_id} endpoint"""
        if not self.employee_id:
            self.log_test("Employee Performance Detail", False, "No employee ID available")
            return False
        
        success, status, data = self.make_request('GET', f'performance/employee-performance/{self.employee_id}')
        
        if success and isinstance(data, dict):
            # Check main sections
            required_sections = ['employee', 'statistics', 'kpis', 'goals']
            missing_sections = [section for section in required_sections if section not in data]
            
            if missing_sections:
                self.log_test("Employee Performance Detail", False, f"Missing sections: {missing_sections}")
                return False
            
            # Check employee info
            employee_info = data.get('employee', {})
            employee_fields = ['employee_id', 'name', 'department', 'designation']
            missing_emp_fields = [field for field in employee_fields if field not in employee_info]
            
            # Check statistics
            statistics = data.get('statistics', {})
            stats_fields = ['total_kpis', 'approved_kpis', 'pending_kpis', 'average_score', 
                          'highest_score', 'total_goals', 'completed_goals']
            missing_stats_fields = [field for field in stats_fields if field not in statistics]
            
            # Check data arrays
            kpis = data.get('kpis', [])
            goals = data.get('goals', [])
            score_trend = data.get('score_trend', [])
            
            self.log_test("Employee Performance Detail", True, 
                         f"Employee: {employee_info.get('name')}, "
                         f"KPIs: {len(kpis)}, Goals: {len(goals)}, "
                         f"Score trend points: {len(score_trend)}")
            
            # Detailed validation
            if missing_emp_fields:
                print(f"   ⚠️  Missing employee fields: {missing_emp_fields}")
            else:
                print(f"   ✅ Employee info complete")
            
            if missing_stats_fields:
                print(f"   ⚠️  Missing statistics fields: {missing_stats_fields}")
            else:
                print(f"   ✅ Statistics complete")
            
            # Show statistics
            print(f"   Statistics: Total KPIs={statistics.get('total_kpis')}, "
                  f"Approved={statistics.get('approved_kpis')}, "
                  f"Avg Score={statistics.get('average_score')}, "
                  f"Highest={statistics.get('highest_score')}")
            
            print(f"   Goals: Total={statistics.get('total_goals')}, "
                  f"Completed={statistics.get('completed_goals')}")
            
            # Check KPI history structure
            if kpis:
                first_kpi = kpis[0]
                kpi_fields = ['kpi_id', 'period_type', 'period_start', 'period_end', 'status', 'final_score']
                missing_kpi_fields = [field for field in kpi_fields if field not in first_kpi]
                if missing_kpi_fields:
                    print(f"   ⚠️  Missing KPI fields: {missing_kpi_fields}")
                else:
                    print(f"   ✅ KPI history structure complete")
            
            # Check goals structure
            if goals:
                first_goal = goals[0]
                goal_fields = ['goal_id', 'title', 'progress', 'status', 'target_date']
                missing_goal_fields = [field for field in goal_fields if field not in first_goal]
                if missing_goal_fields:
                    print(f"   ⚠️  Missing goal fields: {missing_goal_fields}")
                else:
                    print(f"   ✅ Goals structure complete")
            
            return True
        else:
            self.log_test("Employee Performance Detail", False, f"Status: {status}, Response: {data}")
            return False

    def test_team_performance_with_filters(self):
        """Test team performance endpoint with department filter"""
        # First get all employees to find available departments
        success, status, all_data = self.make_request('GET', 'performance/team-performance')
        
        if not success or not isinstance(all_data, list) or len(all_data) == 0:
            self.log_test("Team Performance with Filters", False, "No base data available")
            return False
        
        # Get unique departments
        departments = list(set(emp.get('department', '') for emp in all_data if emp.get('department')))
        
        if not departments:
            self.log_test("Team Performance with Filters", False, "No departments found")
            return False
        
        # Test with first department
        test_department = departments[0]
        success, status, filtered_data = self.make_request('GET', f'performance/team-performance?department={test_department}')
        
        if success and isinstance(filtered_data, list):
            # Verify all returned employees are from the requested department
            wrong_dept_employees = [emp for emp in filtered_data if emp.get('department') != test_department]
            
            if wrong_dept_employees:
                self.log_test("Team Performance with Filters", False, 
                             f"Found {len(wrong_dept_employees)} employees from wrong department")
                return False
            
            self.log_test("Team Performance with Filters", True, 
                         f"Department filter working: {len(filtered_data)} employees from {test_department}")
            
            print(f"   Available departments: {departments}")
            print(f"   Filtered by: {test_department}")
            
            return True
        else:
            self.log_test("Team Performance with Filters", False, f"Status: {status}, Response: {filtered_data}")
            return False

    def test_unauthorized_access(self):
        """Test that non-HR users cannot access team performance"""
        # Remove authorization header temporarily
        original_auth = self.session.headers.get('Authorization')
        if 'Authorization' in self.session.headers:
            del self.session.headers['Authorization']
        
        success, status, data = self.make_request('GET', 'performance/team-performance', expected_status=401)
        
        # Restore authorization
        if original_auth:
            self.session.headers['Authorization'] = original_auth
        
        if success and status == 401:
            self.log_test("Unauthorized Access Protection", True, "Correctly blocked unauthorized access")
            return True
        else:
            self.log_test("Unauthorized Access Protection", False, f"Expected 401, got {status}")
            return False

    def run_team_performance_tests(self):
        """Run all team performance specific tests"""
        print("🚀 Starting Team Performance API Testing")
        print("=" * 60)
        
        # Authentication
        if not self.test_login():
            print("❌ Authentication failed - stopping tests")
            return False
        
        print("\n👥 Testing Team Performance Features...")
        self.test_team_performance_endpoint()
        self.test_employee_performance_detail()
        self.test_team_performance_with_filters()
        self.test_unauthorized_access()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✅ Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Team Performance APIs are working well!")
            return True
        else:
            print("⚠️  Some team performance issues detected")
            return False

def main():
    """Main test execution"""
    tester = TeamPerformanceAPITester()
    success = tester.run_team_performance_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())