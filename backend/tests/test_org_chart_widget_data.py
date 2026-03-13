"""
Test: Org Chart API and Dashboard Widget Data Features
Testing iteration: 53

Features tested:
1. Org Chart API (GET /api/org-chart) - hierarchical employee structure with roots array and total_employees
2. Dashboard widget-data API (GET /api/dashboard/widget-data) - upcoming_holidays, team_birthdays, monthly_attendance
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestOrgChartAPI:
    """Test org chart endpoint returning hierarchical employee structure"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return response.cookies, data.get("access_token")
    
    def test_org_chart_returns_200(self, auth_token):
        """Test org chart endpoint returns 200 OK"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/org-chart",
            cookies=cookies,
            headers=headers
        )
        print(f"Org chart status: {response.status_code}")
        assert response.status_code == 200, f"Org chart failed: {response.text}"
    
    def test_org_chart_has_roots_array(self, auth_token):
        """Test org chart response contains roots array"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/org-chart",
            cookies=cookies,
            headers=headers
        )
        data = response.json()
        assert "roots" in data, "Response missing 'roots' field"
        assert isinstance(data["roots"], list), "roots should be a list"
        print(f"Org chart roots count: {len(data['roots'])}")
    
    def test_org_chart_has_total_employees(self, auth_token):
        """Test org chart response contains total_employees count"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/org-chart",
            cookies=cookies,
            headers=headers
        )
        data = response.json()
        assert "total_employees" in data, "Response missing 'total_employees' field"
        assert isinstance(data["total_employees"], int), "total_employees should be an integer"
        print(f"Total employees in org chart: {data['total_employees']}")
    
    def test_org_chart_node_structure(self, auth_token):
        """Test each org chart node has required fields: id, name, designation, department, children"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/org-chart",
            cookies=cookies,
            headers=headers
        )
        data = response.json()
        if data.get("roots") and len(data["roots"]) > 0:
            first_node = data["roots"][0]
            assert "id" in first_node, "Node missing 'id'"
            assert "name" in first_node, "Node missing 'name'"
            assert "designation" in first_node, "Node missing 'designation'"
            assert "department" in first_node, "Node missing 'department'"
            assert "children" in first_node, "Node missing 'children'"
            print(f"First root node: {first_node.get('name')} - {first_node.get('designation')}")


class TestWidgetDataAPI:
    """Test dashboard widget-data endpoint for holidays, birthdays, monthly attendance"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return response.cookies, data.get("access_token")
    
    def test_widget_data_returns_200(self, auth_token):
        """Test widget-data endpoint returns 200 OK"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/dashboard/widget-data",
            cookies=cookies,
            headers=headers
        )
        print(f"Widget data status: {response.status_code}")
        assert response.status_code == 200, f"Widget data failed: {response.text}"
    
    def test_widget_data_has_upcoming_holidays(self, auth_token):
        """Test widget-data response contains upcoming_holidays array"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/dashboard/widget-data",
            cookies=cookies,
            headers=headers
        )
        data = response.json()
        assert "upcoming_holidays" in data, "Response missing 'upcoming_holidays'"
        assert isinstance(data["upcoming_holidays"], list), "upcoming_holidays should be a list"
        print(f"Upcoming holidays count: {len(data['upcoming_holidays'])}")
        if len(data["upcoming_holidays"]) > 0:
            first_holiday = data["upcoming_holidays"][0]
            print(f"First holiday: {first_holiday.get('name')} on {first_holiday.get('date')}")
            # Verify holiday has name and date
            assert "name" in first_holiday or "date" in first_holiday, "Holiday should have name or date"
    
    def test_widget_data_has_team_birthdays(self, auth_token):
        """Test widget-data response contains team_birthdays array"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/dashboard/widget-data",
            cookies=cookies,
            headers=headers
        )
        data = response.json()
        assert "team_birthdays" in data, "Response missing 'team_birthdays'"
        assert isinstance(data["team_birthdays"], list), "team_birthdays should be a list"
        print(f"Team birthdays count: {len(data['team_birthdays'])} (may be empty if no birthdays this month)")
    
    def test_widget_data_has_monthly_attendance(self, auth_token):
        """Test widget-data response contains monthly_attendance object with correct fields"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/dashboard/widget-data",
            cookies=cookies,
            headers=headers
        )
        data = response.json()
        assert "monthly_attendance" in data, "Response missing 'monthly_attendance'"
        ma = data["monthly_attendance"]
        assert isinstance(ma, dict), "monthly_attendance should be an object"
        
        # Verify required fields in monthly_attendance
        expected_fields = ["present", "absent", "leave", "tour"]
        for field in expected_fields:
            assert field in ma, f"monthly_attendance missing '{field}'"
        
        print(f"Monthly attendance: present={ma.get('present')}, absent={ma.get('absent')}, leave={ma.get('leave')}, tour={ma.get('tour')}")


class TestDashboardStatsAPI:
    """Test existing dashboard stats endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth session"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@shardahr.com", "password": "password"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return response.cookies, data.get("access_token")
    
    def test_dashboard_stats_returns_200(self, auth_token):
        """Test dashboard stats endpoint returns 200 OK"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            cookies=cookies,
            headers=headers
        )
        print(f"Dashboard stats status: {response.status_code}")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
    
    def test_dashboard_employee_returns_200(self, auth_token):
        """Test dashboard employee endpoint returns 200 OK"""
        cookies, token = auth_token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        response = requests.get(
            f"{BASE_URL}/api/dashboard/employee",
            cookies=cookies,
            headers=headers
        )
        print(f"Dashboard employee status: {response.status_code}")
        assert response.status_code == 200, f"Dashboard employee failed: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
