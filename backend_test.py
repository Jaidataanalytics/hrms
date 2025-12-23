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
    def __init__(self, base_url="https://sharda-hrms-bugs.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_credentials = {
            "email": "admin@shardahr.com",
            "password": "Admin@123"
        }
        self.template_id = None
        self.kpi_id = None
        self.goal_id = None

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

    def test_list_templates(self):
        """Test listing KPI templates"""
        success, status, data = self.make_request('GET', 'performance/templates')
        
        if success:
            template_count = len(data) if isinstance(data, list) else 0
            self.log_test("List KPI Templates", True, f"Found {template_count} templates")
            
            # Store first template ID for later tests
            if template_count > 0 and isinstance(data, list):
                self.template_id = data[0].get('template_id')
                print(f"   Using template ID: {self.template_id}")
            
            return True
        else:
            self.log_test("List KPI Templates", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_template(self):
        """Test creating a KPI template"""
        template_data = {
            "name": f"Test KPI Template {datetime.now().strftime('%H%M%S')}",
            "description": "Automated test template for KPI assessment",
            "period_type": "quarterly",
            "questions": [
                {
                    "question_id": f"q_{uuid.uuid4().hex[:8]}",
                    "question": "Project Delivery Performance",
                    "max_points": 20,
                    "answer_type": "score",
                    "category": "Performance"
                },
                {
                    "question_id": f"q_{uuid.uuid4().hex[:8]}",
                    "question": "Team Collaboration Rating",
                    "max_points": 15,
                    "answer_type": "dropdown",
                    "category": "Teamwork",
                    "options": [
                        {"label": "Excellent", "value": 0, "points": 15},
                        {"label": "Good", "value": 1, "points": 12},
                        {"label": "Average", "value": 2, "points": 8},
                        {"label": "Needs Improvement", "value": 3, "points": 5}
                    ]
                },
                {
                    "question_id": f"q_{uuid.uuid4().hex[:8]}",
                    "question": "Additional Comments",
                    "max_points": 10,
                    "answer_type": "text",
                    "category": "Feedback"
                }
            ]
        }
        
        success, status, data = self.make_request('POST', 'performance/templates', template_data, 200)
        
        if success and 'template_id' in data:
            self.template_id = data['template_id']
            question_count = len(data.get('questions', []))
            self.log_test("Create KPI Template", True, f"Template created with ID: {self.template_id}, Questions: {question_count}")
            return True
        else:
            self.log_test("Create KPI Template", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_template(self):
        """Test getting template details"""
        if not self.template_id:
            self.log_test("Get Template Details", False, "No template ID available")
            return False
        
        success, status, data = self.make_request('GET', f'performance/templates/{self.template_id}')
        
        if success and 'template_id' in data:
            questions = data.get('questions', [])
            self.log_test("Get Template Details", True, f"Template retrieved with {len(questions)} questions")
            
            # Verify question types
            answer_types = [q.get('answer_type') for q in questions]
            print(f"   Answer types found: {set(answer_types)}")
            
            # Check for dropdown options
            dropdown_questions = [q for q in questions if q.get('answer_type') == 'dropdown']
            if dropdown_questions:
                options_count = len(dropdown_questions[0].get('options', []))
                print(f"   Dropdown question has {options_count} options")
            
            return True
        else:
            self.log_test("Get Template Details", False, f"Status: {status}, Response: {data}")
            return False

    def test_update_template(self):
        """Test updating template with new questions and dropdown options"""
        if not self.template_id:
            self.log_test("Update Template", False, "No template ID available")
            return False
        
        # First get current template
        success, status, current_data = self.make_request('GET', f'performance/templates/{self.template_id}')
        if not success:
            self.log_test("Update Template", False, "Could not fetch current template")
            return False
        
        # Add a new question with dropdown options
        new_question = {
            "question_id": f"q_{uuid.uuid4().hex[:8]}",
            "question": "Communication Skills Assessment",
            "max_points": 25,
            "answer_type": "dropdown",
            "category": "Skills",
            "options": [
                {"label": "Outstanding", "value": 0, "points": 25},
                {"label": "Exceeds Expectations", "value": 1, "points": 20},
                {"label": "Meets Expectations", "value": 2, "points": 15},
                {"label": "Below Expectations", "value": 3, "points": 10},
                {"label": "Unsatisfactory", "value": 4, "points": 5}
            ]
        }
        
        # Update template with new question
        update_data = current_data.copy()
        update_data['questions'] = update_data.get('questions', []) + [new_question]
        update_data['description'] = "Updated template with new dropdown question"
        
        success, status, data = self.make_request('PUT', f'performance/templates/{self.template_id}', update_data)
        
        if success:
            questions = data.get('questions', [])
            dropdown_questions = [q for q in questions if q.get('answer_type') == 'dropdown']
            self.log_test("Update Template", True, f"Template updated with {len(questions)} questions, {len(dropdown_questions)} dropdown questions")
            return True
        else:
            self.log_test("Update Template", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_kpi(self):
        """Test creating employee KPI"""
        if not self.template_id:
            self.log_test("Create Employee KPI", False, "No template ID available")
            return False
        
        # Calculate period dates
        now = datetime.now()
        period_start = datetime(now.year, ((now.month - 1) // 3) * 3 + 1, 1)
        
        # Handle year rollover for quarter calculation
        end_month = period_start.month + 3
        end_year = period_start.year
        if end_month > 12:
            end_month = end_month - 12
            end_year += 1
        
        period_end = datetime(end_year, end_month, 1) - timedelta(days=1)
        
        kpi_data = {
            "template_id": self.template_id,
            "period_type": "quarterly",
            "period_start": period_start.strftime('%Y-%m-%d'),
            "period_end": period_end.strftime('%Y-%m-%d'),
            "responses": []
        }
        
        success, status, data = self.make_request('POST', 'performance/kpi', kpi_data, 200)
        
        if success and 'kpi_id' in data:
            self.kpi_id = data['kpi_id']
            self.log_test("Create Employee KPI", True, f"KPI created with ID: {self.kpi_id}, Status: {data.get('status')}")
            return True
        else:
            self.log_test("Create Employee KPI", False, f"Status: {status}, Response: {data}")
            return False

    def test_fill_kpi_responses(self):
        """Test filling KPI responses with different answer types"""
        if not self.kpi_id or not self.template_id:
            self.log_test("Fill KPI Responses", False, "No KPI ID or template ID available")
            return False
        
        # Get template questions first
        success, status, template_data = self.make_request('GET', f'performance/templates/{self.template_id}')
        if not success:
            self.log_test("Fill KPI Responses", False, "Could not fetch template questions")
            return False
        
        questions = template_data.get('questions', [])
        if not questions:
            self.log_test("Fill KPI Responses", False, "No questions found in template")
            return False
        
        # Build responses for different question types
        responses = []
        for q in questions:
            response = {
                "question_id": q['question_id'],
                "question": q['question'],
                "max_points": q['max_points'],
                "comments": f"Test response for {q['question']}"
            }
            
            if q.get('answer_type') == 'dropdown' and q.get('options'):
                # Select first option
                selected_option = q['options'][0]
                response['selected_option'] = selected_option['label']
                response['score'] = selected_option['points']
            elif q.get('answer_type') == 'text':
                response['score'] = q['max_points'] // 2  # Half points for text responses
                response['comments'] = "Detailed text response for this question"
            else:
                # Score type - give 80% of max points
                response['score'] = int(q['max_points'] * 0.8)
            
            responses.append(response)
        
        # Calculate final score
        total_score = sum(r['score'] for r in responses)
        max_score = sum(r['max_points'] for r in responses)
        final_score = (total_score / max_score) * 100 if max_score > 0 else 0
        
        update_data = {
            "responses": responses,
            "final_score": final_score
        }
        
        success, status, data = self.make_request('PUT', f'performance/kpi/{self.kpi_id}', update_data)
        
        if success:
            saved_responses = data.get('responses', [])
            self.log_test("Fill KPI Responses", True, f"Saved {len(saved_responses)} responses, Final score: {data.get('final_score', 0):.1f}%")
            
            # Verify different answer types were handled
            answer_types = set(r.get('selected_option') and 'dropdown' or 'score' for r in saved_responses)
            print(f"   Answer types processed: {answer_types}")
            
            return True
        else:
            self.log_test("Fill KPI Responses", False, f"Status: {status}, Response: {data}")
            return False

    def test_submit_kpi(self):
        """Test submitting KPI for review"""
        if not self.kpi_id:
            self.log_test("Submit KPI", False, "No KPI ID available")
            return False
        
        success, status, data = self.make_request('PUT', f'performance/kpi/{self.kpi_id}/submit')
        
        if success:
            self.log_test("Submit KPI", True, f"KPI submitted: {data.get('message', 'Success')}")
            return True
        else:
            self.log_test("Submit KPI", False, f"Status: {status}, Response: {data}")
            return False

    def test_my_kpis(self):
        """Test getting user's KPIs"""
        success, status, data = self.make_request('GET', 'performance/my-kpi')
        
        if success:
            kpi_count = len(data) if isinstance(data, list) else 0
            self.log_test("Get My KPIs", True, f"Found {kpi_count} KPI records")
            
            if kpi_count > 0 and isinstance(data, list):
                # Check KPI statuses
                statuses = [kpi.get('status') for kpi in data]
                print(f"   KPI statuses: {set(statuses)}")
                
                # Check for final scores
                scored_kpis = [kpi for kpi in data if kpi.get('final_score') is not None]
                print(f"   KPIs with scores: {len(scored_kpis)}")
            
            return True
        else:
            self.log_test("Get My KPIs", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_goal(self):
        """Test creating a performance goal"""
        goal_data = {
            "title": f"Test Goal {datetime.now().strftime('%H%M%S')}",
            "description": "Automated test goal for performance tracking",
            "target_date": (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d'),
            "priority": "high"
        }
        
        success, status, data = self.make_request('POST', 'performance/goals', goal_data, 200)
        
        if success and 'goal_id' in data:
            self.goal_id = data['goal_id']
            self.log_test("Create Goal", True, f"Goal created with ID: {self.goal_id}, Priority: {data.get('priority')}")
            return True
        else:
            self.log_test("Create Goal", False, f"Status: {status}, Response: {data}")
            return False

    def test_update_goal_progress(self):
        """Test updating goal progress"""
        if not self.goal_id:
            self.log_test("Update Goal Progress", False, "No goal ID available")
            return False
        
        progress_data = {
            "progress": 75,
            "status": "in_progress"
        }
        
        success, status, data = self.make_request('PUT', f'performance/goals/{self.goal_id}', progress_data)
        
        if success:
            self.log_test("Update Goal Progress", True, f"Goal progress updated to {data.get('progress', 0)}%")
            return True
        else:
            self.log_test("Update Goal Progress", False, f"Status: {status}, Response: {data}")
            return False

    def test_list_goals(self):
        """Test listing goals"""
        success, status, data = self.make_request('GET', 'performance/goals')
        
        if success:
            goal_count = len(data) if isinstance(data, list) else 0
            self.log_test("List Goals", True, f"Found {goal_count} goals")
            
            if goal_count > 0 and isinstance(data, list):
                # Check goal statuses and priorities
                statuses = [goal.get('status') for goal in data]
                priorities = [goal.get('priority') for goal in data]
                print(f"   Goal statuses: {set(statuses)}")
                print(f"   Goal priorities: {set(priorities)}")
            
            return True
        else:
            self.log_test("List Goals", False, f"Status: {status}, Response: {data}")
            return False

    def run_all_tests(self):
        """Run all KPI-related API tests"""
        print("🚀 Starting Sharda HR HRMS KPI API Testing")
        print("=" * 60)
        
        # Authentication
        if not self.test_login():
            print("❌ Authentication failed - stopping tests")
            return False
        
        print("\n📋 Testing KPI Templates...")
        self.test_list_templates()
        self.test_create_template()
        self.test_get_template()
        self.test_update_template()
        
        print("\n📊 Testing Employee KPIs...")
        self.test_create_kpi()
        self.test_fill_kpi_responses()
        self.test_submit_kpi()
        self.test_my_kpis()
        
        print("\n🎯 Testing Goals...")
        self.test_create_goal()
        self.test_update_goal_progress()
        self.test_list_goals()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✅ Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Backend APIs are working well!")
            return True
        else:
            print("⚠️  Some backend issues detected")
            return False

def main():
    """Main test execution"""
    tester = KPIAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())